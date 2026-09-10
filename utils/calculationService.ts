
import { Employee, PayrollResult, GlobalConfig, Role, PayrollType, Holiday, TaxBracket } from '../types';
import { STANDARD_HOLIDAYS } from '../constants';

// Helper to round to 2 decimal places matching Excel behavior
const round2 = (val: number): number => {
    return Number(Math.round(Number(val + 'e2')) + 'e-2');
};

// Helper to calculate active months for 13th salary (>= 15 days in a month)
const getMonthsWorkedInYear = (year: number, admissionDate: string, terminationDate?: string): number => {
  let monthsCount = 0;
  
  const admParts = admissionDate.split('-').map(Number);
  const admDateObj = new Date(admParts[0], admParts[1] - 1, admParts[2]);
  
  // Se não houver data de demissão, projetamos até o fim do ano (31/12)
  const finalDateStr = terminationDate || `${year}-12-31`;
  const resParts = finalDateStr.split('-').map(Number);
  const resDateObj = new Date(resParts[0], resParts[1] - 1, resParts[2]);

  for (let m = 0; m < 12; m++) {
      const daysInMonth = new Date(year, m + 1, 0).getDate();
      let activeDays = daysInMonth; 
      
      // Verifica Admissão
      if (admDateObj.getFullYear() > year) {
          activeDays = 0;
      } else if (admDateObj.getFullYear() === year && admDateObj.getMonth() === m) {
          activeDays = daysInMonth - admDateObj.getDate() + 1;
      } else if (admDateObj.getFullYear() === year && admDateObj.getMonth() > m) {
          activeDays = 0;
      }

      // Verifica Demissão
      if (resDateObj) {
          if (resDateObj.getFullYear() < year) {
              activeDays = 0;
          } else if (resDateObj.getFullYear() === year && resDateObj.getMonth() === m) {
              activeDays = resDateObj.getDate();
          } else if (resDateObj.getFullYear() === year && resDateObj.getMonth() < m) {
              activeDays = 0;
          }
      }

      // Regra: 15 dias ou mais contam como um mês integral para 13º
      if (activeDays >= 15) {
          monthsCount++;
      }
  }

  return monthsCount;
};

// Helper to calculate overlap days between a range and a specific month/period
const getVacationDaysInPeriod = (vacationStartStr: string, vacationDays: number, periodStart: Date, periodEnd: Date): number => {
    if (!vacationStartStr) return 0;
    
    const [vYear, vMonth, vDay] = vacationStartStr.split('-').map(Number);
    const vacStartUTC = Date.UTC(vYear, vMonth - 1, vDay);
    const vacEndUTC = vacStartUTC + (vacationDays * 24 * 60 * 60 * 1000); 
    
    const pStartUTC = Date.UTC(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate());
    const pEndUTC = Date.UTC(periodEnd.getFullYear(), periodEnd.getMonth(), periodEnd.getDate()) + (24 * 60 * 60 * 1000);
    
    const start = Math.max(vacStartUTC, pStartUTC);
    const end = Math.min(vacEndUTC, pEndUTC);
    
    if (start < end) {
        const diffMs = end - start;
        return Math.round(diffMs / (24 * 60 * 60 * 1000));
    }
    
    return 0;
};

const getVacationDaysInMonth = (vacationStartStr: string, vacationDays: number, currentMonthDate: Date, limitTo30Days: boolean = false): number => {
    const y = currentMonthDate.getFullYear();
    const m = currentMonthDate.getMonth();
    const firstDay = new Date(y, m, 1);
    let lastDayNum = new Date(y, m + 1, 0).getDate();
    if (limitTo30Days && lastDayNum === 31) lastDayNum = 30;
    const lastDay = new Date(y, m, lastDayNum);
    return getVacationDaysInPeriod(vacationStartStr, vacationDays, firstDay, lastDay);
};

export const calculateBusinessDays = (
  year: number,
  month: number, // 0-based
  ignoredHolidays: string[] = [],
  customHolidays: Holiday[] = []
) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let businessDays = 0;
    let dsrDays = 0;
    
    const activeHolidays = new Set<string>();
    STANDARD_HOLIDAYS.forEach(h => { if (!ignoredHolidays.includes(h.date)) activeHolidays.add(h.date); });
    customHolidays.forEach(h => activeHolidays.add(h.date));

    for (let d = 1; d <= daysInMonth; d++) {
        const cur = new Date(year, month, d);
        const wd = cur.getDay(); 
        const dStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
        const isHoliday = activeHolidays.has(dStr);

        if (wd !== 0 && wd !== 6 && !isHoliday) {
            businessDays++;
        }
        if (wd === 0 || isHoliday) {
            dsrDays++;
        }
    }
    // Fallback if month has no business days (very rare)
    if (businessDays === 0) businessDays = 22; 

    return { businessDays, dsrDays, totalDays: daysInMonth };
};

// Helper: INSS Calculation with Ceiling Handling
const calculateINSS = (value: number, table: TaxBracket[]): number => {
    if (!table || table.length === 0) return 0;
    if (value <= 0) return 0;

    const lastBracket = table[table.length - 1];
    
    // Check if value exceeds the ceiling (last bracket limit)
    // Note: INSS tables usually have a finite limit for the last bracket (Teto)
    if (lastBracket.limit !== null && value > lastBracket.limit) {
        return round2((lastBracket.limit * lastBracket.rate) - lastBracket.deduction);
    }

    // Normal Progressive Calculation
    for (const bracket of table) {
        if (value <= (bracket.limit || Infinity)) {
            return round2((value * bracket.rate) - bracket.deduction);
        }
    }

    // Fallback (e.g. if logic above fails, though it shouldn't if table is well formed)
    return round2((value * lastBracket.rate) - lastBracket.deduction);
};

export const calculatePayroll = (
  employee: Employee, 
  businessDays: number, 
  totalDays: number,
  config: GlobalConfig,
  hourlyRates: any, 
  dsrMultiplier: number = 8,
  currentDate?: Date, 
  payrollType: PayrollType = 'MONTHLY',
  savedAdvanceValue?: number,
  first13rdAverage?: number, 
  annualGrossAverage?: number,
  ignoredHolidays: string[] = [],
  vacationDetailedAverages?: { description: string, total: number, quantity: number }[],
  accumulatedFgtsBalance?: number,
  previousMonthEmployee?: Employee // NEW: To sum variables from previous month in termination
): PayrollResult => {
  
  let calculationDate = currentDate 
    ? new Date(currentDate.getFullYear(), currentDate.getMonth(), 1) 
    : new Date();

  // Guard admissão
  if (payrollType === 'MONTHLY' && currentDate && employee.admissionDate) {
      const [admY, admM] = employee.admissionDate.split('-').map(Number);
      const admissionMonthStart = new Date(admY, admM - 1, 1);
      const calcMonthStart = new Date(calculationDate.getFullYear(), calculationDate.getMonth(), 1);
      if (calcMonthStart < admissionMonthStart) {
          return {
              employee, earnings: [], deductions: [], nonTaxableEarnings: [],
              totals: { gross: 0, net: 0, totalDeductions: 0, fgts: 0, totalNonTaxable: 0 },
              metadata: { businessDays: 0, dsrMultiplier: 0, sundaysAndHolidays: 0, payrollType }
          };
      }
      if (employee.resignationDate) {
          const [resY, resM] = employee.resignationDate.split('-').map(Number);
          const resignationMonthStart = new Date(resY, resM - 1, 1);
          if (calcMonthStart > resignationMonthStart) {
               return {
                  employee, earnings: [], deductions: [], nonTaxableEarnings: [],
                  totals: { gross: 0, net: 0, totalDeductions: 0, fgts: 0, totalNonTaxable: 0 },
                  metadata: { businessDays: 0, dsrMultiplier: 0, sundaysAndHolidays: 0, payrollType }
              };
          }
      }
  }

  const rates = hourlyRates[employee.role];
  const earnings = [];
  const deductions = [];
  const nonTaxableEarnings = [];
  
  let proportionalFactor = 1; 
  let activeDays = 30; 
  let isProportional = false;
  let effectiveBusinessDays = businessDays;
  let effectiveDsrDays = dsrMultiplier;
  
  // --- RESCISÃO ---
  if (payrollType === 'TERMINATION' && employee.resignationDate) {
      const [resY, resM, resD] = employee.resignationDate.split('-').map(Number);
      const resignationDateObj = new Date(resY, resM - 1, resD);
      const terminationType = employee.terminationType || 'PEDIDO_TRABALHADO';

      activeDays = resD; 
      if (activeDays > 30) activeDays = 30; 

      const salaryFactorTerm = activeDays / 30;
      const fullBaseSalaryTerm = config.salaryBase[employee.role];
      const proportionalBaseSalary = round2(fullBaseSalaryTerm * salaryFactorTerm);

      earnings.push({ description: `SALDO DE SALÁRIO (${activeDays} DIAS)`, total: proportionalBaseSalary, isVariable: false });

      // Variable Accumulators for DSR and Periculosidade
      let totalVariableEarnings = 0;
      let totalHoursEarnings = 0;
      let valTriTre = 0;
      let valAdFuncao = 0;
      let valFolgaDeslocada = 0;

      const hoursMap = [
        { key: 'diurna', label: 'Hora diurna' }, { key: 'noturna', label: 'Hora noturna' },
        { key: 'espDiurno', label: 'Hora Esp.Diurno' }, { key: 'espNoturno', label: 'Hora Esp. Noturno' },
        { key: 'reDiurno', label: 'RE Diurno' }, { key: 'reNoturna', label: 'RE Noturna' },
        { key: 'reEspDiurno', label: 'RE Esp. Diurno' }, { key: 'reEspNoturno', label: 'RE Esp. Noturno' },
        { key: 'saDiurno', label: 'SA Diurno' }, { key: 'saNoturna', label: 'SA Noturna' },
        { key: 'saEspDiurno', label: 'SA Esp. Diurno' }, { key: 'saEspNoturno', label: 'SA Esp. Noturno' },
        { key: 'simulador', label: 'SIMULADOR' }, { key: 'horaSolo', label: 'HORA DE SOLO' },
      ];

      hoursMap.forEach(h => {
        // Sum current month (termination month + 2 variables) AND previous month (termination month + 1 variables)
        // @ts-ignore
        const qtyCurrent = employee.hours[h.key];
        // @ts-ignore
        const qtyPrev = previousMonthEmployee ? previousMonthEmployee.hours[h.key] : 0;
        
        const totalQty = qtyCurrent + qtyPrev;

        // @ts-ignore
        const rate = rates[h.key];
        const total = round2(totalQty * rate);
        
        if (total > 0) {
            earnings.push({ description: h.label, quantity: totalQty, rate: rate, total: total, isVariable: true });
            totalVariableEarnings += total;
            totalHoursEarnings += total;
        }
      });

      // Sum Folga Deslocada
      const fdCurrent = employee.folgaDeslocada;
      const fdPrev = previousMonthEmployee ? previousMonthEmployee.folgaDeslocada : 0;
      const totalFd = fdCurrent + fdPrev;

      if (totalFd > 0) {
        valFolgaDeslocada = round2(totalFd * config.fixedValues.FOLGA_DESLOCADA);
        earnings.push({ description: 'FOLGA DESLOCADA', total: valFolgaDeslocada, quantity: totalFd, isVariable: true });
        totalVariableEarnings += valFolgaDeslocada;
      }
      
      if (employee.triTre === 'TRE') {
        valTriTre = round2(config.fixedValues.TRE_SFE * salaryFactorTerm);
        earnings.push({ description: `Adicional TRE/SFE (${activeDays}d)`, total: valTriTre, isVariable: true });
        totalVariableEarnings += valTriTre;
      } else if (employee.triTre === 'TRI') {
        valTriTre = round2(config.fixedValues.TRI_SFI * salaryFactorTerm);
        earnings.push({ description: `Adicional TRI/SFI (${activeDays}d)`, total: valTriTre, isVariable: true });
        totalVariableEarnings += valTriTre;
      }

      if (employee.adFuncao !== 'NA') {
        let baseVal = 0;
        switch (employee.adFuncao) {
            case 'D.OPR': baseVal = config.fixedValues.D_OPR; break;
            case 'D.SAFETY': baseVal = config.fixedValues.D_SAFETY; break;
            case 'P.CHEFE': baseVal = config.fixedValues.P_CHEFE; break; 
            case 'G.KEEPER': baseVal = config.fixedValues.G_KEEPER; break;
            case 'D.GERAL': baseVal = config.fixedValues.D_GERAL; break;
            case 'ACORDO': baseVal = config.fixedValues.ACORDO; break;
        }
        if (baseVal > 0) {
            valAdFuncao = round2(baseVal * salaryFactorTerm);
            earnings.push({ description: `AD.FUNÇÃO (${activeDays}d)`, total: valAdFuncao, isVariable: true });
            totalVariableEarnings += valAdFuncao;
        }
      }

      if (employee.periculosidade) {
          // Periculosidade base: Salário Base + Todas as gratificações e horas (EXCETO Ad. Função)
          const pericBase = proportionalBaseSalary + totalHoursEarnings + valTriTre + valFolgaDeslocada;
          const valPeric = round2(pericBase * config.fixedValues.PERICULOSIDADE_PERCENT);
          earnings.push({ description: 'Periculosidade (S/ Saldo)', total: valPeric, isVariable: true });
          totalVariableEarnings += valPeric;
      }

      let valDsr = 0;
      if (effectiveBusinessDays > 0) {
           // DSR incide sobre todo o ganho variável acumulado (incluindo Periculosidade)
           valDsr = round2((totalVariableEarnings / effectiveBusinessDays) * effectiveDsrDays);
           earnings.push({ description: 'DSR (S/ Variáveis)', total: valDsr, isVariable: false });
      }

      const averageTotalGross = annualGrossAverage || fullBaseSalaryTerm;
      const averageVariablesOnly = Math.max(0, averageTotalGross - fullBaseSalaryTerm);
      const remunerationForIndemnity = fullBaseSalaryTerm + averageVariablesOnly;

      const [admY, admM, admD] = employee.admissionDate.split('-').map(Number);
      let yearsWorked = resY - admY;
      const anniversaryThisYear = new Date(resY, admM - 1, admD);
      if (resignationDateObj < anniversaryThisYear) yearsWorked--;
      if (yearsWorked < 0) yearsWorked = 0;
      
      const noticeDays = 30 + (yearsWorked * 3);
      const finalNoticeDays = Math.min(90, noticeDays);

      let projectedDate = new Date(resignationDateObj);
      let noticeValue = 0;
      
      if (terminationType === 'DEMISSAO_INDENIZADA') {
          projectedDate.setDate(projectedDate.getDate() + finalNoticeDays);
          noticeValue = round2((remunerationForIndemnity / 30) * finalNoticeDays);
          nonTaxableEarnings.push({ description: `AVISO PRÉVIO INDENIZADO (${finalNoticeDays} DIAS)`, total: noticeValue });
      } else if (terminationType === 'PEDIDO_INDENIZADO') {
          deductions.push({ description: `DESC. AVISO PRÉVIO (NÃO TRABALHADO)`, total: round2(fullBaseSalaryTerm) });
      }
      
      const projectedDateStr = projectedDate.toISOString().split('T')[0];
      const months13th = getMonthsWorkedInYear(resY, employee.admissionDate, projectedDateStr);
      const prop13thValue = round2((remunerationForIndemnity / 12) * months13th);
      
      if (months13th > 0) {
        earnings.push({ description: `13º SALÁRIO PROPORCIONAL (${months13th}/12)${terminationType === 'DEMISSAO_INDENIZADA' ? ' C/ PROJEÇÃO' : ''}`, total: prop13thValue, isVariable: false });
      }

      let currentPeriodStart = new Date(resY, admM - 1, admD);
      const projectedYearAnniversary = new Date(projectedDate.getFullYear(), admM - 1, admD);
      if (projectedDate >= projectedYearAnniversary) currentPeriodStart = projectedYearAnniversary;
      else currentPeriodStart = new Date(projectedDate.getFullYear() - 1, admM - 1, admD);

      let vacMonths = 0;
      let ptr = new Date(currentPeriodStart);
      while (ptr < projectedDate) {
          const nextMonth = new Date(ptr);
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          if (nextMonth > projectedDate) {
             const diffDays = Math.ceil(Math.abs(projectedDate.getTime() - ptr.getTime()) / (1000 * 60 * 60 * 24)); 
             if (diffDays >= 14) vacMonths++; 
          } else vacMonths++;
          ptr.setMonth(ptr.getMonth() + 1);
      }
      if (vacMonths > 12) vacMonths = 12;

      const propVacationValue = round2((remunerationForIndemnity / 12) * vacMonths);
      const oneThirdVac = round2(propVacationValue / 3);

      if (vacMonths > 0) {
        nonTaxableEarnings.push({ description: `FÉRIAS PROPORCIONAIS (${vacMonths}/12)${terminationType === 'DEMISSAO_INDENIZADA' ? ' C/ PROJEÇÃO' : ''}`, total: propVacationValue });
        nonTaxableEarnings.push({ description: `1/3 FÉRIAS PROPORCIONAIS`, total: oneThirdVac });
      }
      
      let inssSaldo = 0;
      if (proportionalBaseSalary + totalVariableEarnings + valDsr > 0) {
        const baseInss = proportionalBaseSalary + totalVariableEarnings + valDsr;
        inssSaldo = calculateINSS(baseInss, config.inssTable);
        deductions.push({ description: 'INSS S/ SALDO', total: inssSaldo });
      }

      let inss13 = 0;
      if (prop13thValue > 0) {
         inss13 = calculateINSS(prop13thValue, config.inssTable);
         deductions.push({ description: 'INSS S/ 13º SALÁRIO', total: inss13 });
      }

      let baseIrSaldo = (proportionalBaseSalary + totalVariableEarnings + valDsr) - inssSaldo;
      if (baseIrSaldo > 0) {
          let irBracket = config.irTable[0];
          for (const bracket of config.irTable) { if (bracket.limit === null || baseIrSaldo <= bracket.limit) { irBracket = bracket; break; } }
          const irTax = round2((baseIrSaldo * irBracket.rate) - irBracket.deduction);
          if (irTax > 0) deductions.push({ description: 'IRRF S/ SALDO', total: irTax, rate: irBracket.rate });
      }

      let baseIr13 = prop13thValue - inss13;
      if (baseIr13 > 0) {
          let irBracket = config.irTable[0];
          for (const bracket of config.irTable) { if (bracket.limit === null || baseIr13 <= bracket.limit) { irBracket = bracket; break; } }
          const irTax = round2((baseIr13 * irBracket.rate) - irBracket.deduction);
          if (irTax > 0) deductions.push({ description: 'IRRF S/ 13º SALÁRIO', total: irTax, rate: irBracket.rate });
      }

      const totalTaxable = round2((proportionalBaseSalary + totalVariableEarnings + valDsr) + prop13thValue);
      const totalNonTaxable = round2(nonTaxableEarnings.reduce((acc, curr) => acc + curr.total, 0));
      const totalDeductions = round2(deductions.reduce((acc, curr) => acc + curr.total, 0));
      const netValue = round2((totalTaxable + totalNonTaxable) - totalDeductions);
      
      let baseFgtsTerm = (proportionalBaseSalary + totalVariableEarnings + valDsr) + prop13thValue;
      if (terminationType === 'DEMISSAO_INDENIZADA') baseFgtsTerm += noticeValue;
      const fgtsTerm = round2(baseFgtsTerm * 0.08);

      return {
          employee: { ...employee, baseSalary: proportionalBaseSalary },
          earnings, deductions, nonTaxableEarnings,
          totals: { gross: totalTaxable, net: netValue, totalDeductions, fgts: fgtsTerm, totalNonTaxable: totalNonTaxable, fgtsFine: round2((accumulatedFgtsBalance || 0 + fgtsTerm) * 0.4) },
          metadata: { businessDays: effectiveBusinessDays, dsrMultiplier: effectiveDsrDays, sundaysAndHolidays: 0, payrollType: 'TERMINATION', monthsWorked13th: months13th, terminationMeta: { noticeDays: finalNoticeDays, vacationVestingMonths: vacMonths } }
      };
  }

  // --- LÓGICA MENSAL / 13º / FÉRIAS ---
  let monthsWorked13th = getMonthsWorkedInYear(calculationDate.getFullYear(), employee.admissionDate, employee.resignationDate);

  let vacationDaysInCalculationMonth = 0;
  if (payrollType === 'MONTHLY' && currentDate) {
      if (employee.vacationStartDate) vacationDaysInCalculationMonth = getVacationDaysInMonth(employee.vacationStartDate, employee.vacationDays || 30, calculationDate, false);
      if (employee.vacationHistory) {
          employee.vacationHistory.forEach(rec => {
              if (rec.startDate !== employee.vacationStartDate) vacationDaysInCalculationMonth += getVacationDaysInMonth(rec.startDate, rec.days, calculationDate, false);
          });
      }
      const daysInCalcMonth = new Date(calculationDate.getFullYear(), calculationDate.getMonth() + 1, 0).getDate();
      if (vacationDaysInCalculationMonth > daysInCalcMonth) vacationDaysInCalculationMonth = daysInCalcMonth;
  }

  if (payrollType === 'MONTHLY' && currentDate && employee.admissionDate) {
    const [admY, admM, admD] = employee.admissionDate.split('-').map(Number);
    if (calculationDate.getFullYear() === admY && (calculationDate.getMonth() + 1) === admM) {
        activeDays = 30 - admD;
        if (activeDays < 0) activeDays = 0;
        if (activeDays > 30) activeDays = 30;
        proportionalFactor = activeDays / 30;
        isProportional = true;
        effectiveBusinessDays = Math.max(1, Math.round(businessDays * proportionalFactor));
        effectiveDsrDays = Math.max(1, Math.round(dsrMultiplier * proportionalFactor));
    }
  }

  let paidDays = activeDays; 
  const realDaysInMonth = new Date(calculationDate.getFullYear(), calculationDate.getMonth() + 1, 0).getDate();
  if (vacationDaysInCalculationMonth > 0) {
      paidDays = Math.max(0, (isProportional ? activeDays : realDaysInMonth) - vacationDaysInCalculationMonth);
      if (paidDays > 30) paidDays = 30;
  }
  
  const salaryFactor = paidDays / 30;
  const fullBaseSalary = config.salaryBase[employee.role];
  const calculatedBaseSalary = round2(fullBaseSalary * salaryFactor);

  const hoursMapReverse: Record<string, number> = {
    'Hora diurna': rates.diurna, 'Hora noturna': rates.noturna, 'Hora Esp.Diurno': rates.espDiurno, 'Hora Esp. Noturno': rates.espNoturno,
    'RE Diurno': rates.reDiurno, 'RE Noturna': rates.reNoturna, 'RE Esp. Diurno': rates.reEspDiurno, 'RE Esp. Noturno': rates.reEspNoturno,
    'SA Diurno': rates.saDiurno, 'SA Noturna': rates.saNoturna, 'SA Esp. Diurno': rates.saEspDiurno, 'SA Esp. Noturno': rates.saEspNoturno,
    'SIMULADOR': rates.simulador, 'HORA DE SOLO': rates.horaSolo,
  };

  // --- RECIBO DE FÉRIAS ---
  if (payrollType === 'VACATION') {
      const currentVacation = employee.vacationHistory?.find(v => {
          if (!currentDate) return false;
          const [vY, vM] = v.startDate.split('-').map(Number);
          return vY === currentDate.getFullYear() && (vM - 1) === currentDate.getMonth();
      });
      const vacationDays = currentVacation ? currentVacation.days : (employee.vacationDays || 30);
      const vacationFactor = vacationDays / 30;
      const vacationBaseSalary = round2(fullBaseSalary * vacationFactor);
      earnings.push({ description: `SALÁRIO FIXO FÉRIAS (${vacationDays} DIAS)`, total: vacationBaseSalary, isVariable: false });
      let totalVariables = 0;
      let totalVariablesForPeric = 0;
      if (vacationDetailedAverages) {
          vacationDetailedAverages.forEach(avg => {
              const itemRate = hoursMapReverse[avg.description] || (avg.description === 'FOLGA DESLOCADA' ? config.fixedValues.FOLGA_DESLOCADA : 0);
              const itemTotal = itemRate > 0 ? round2(avg.quantity * vacationFactor * itemRate) : round2(avg.total * vacationFactor);
              earnings.push({ description: avg.description, quantity: itemRate > 0 ? (avg.quantity * vacationFactor) : undefined, rate: itemRate > 0 ? itemRate : undefined, total: itemTotal, isVariable: true });
              totalVariables += itemTotal;

              // Adicional de Função is Excluded from Periculosidade Base
              if (avg.description !== 'AD.FUNÇÃO' && !['D.OPR', 'D.SAFETY', 'P.CHEFE', 'G.KEEPER', 'D.GERAL', 'ACORDO'].some(opt => avg.description.includes(opt))) {
                  totalVariablesForPeric += itemTotal;
              }
          });
      }
      let pericValue = 0;
      if (employee.periculosidade) {
          pericValue = round2((vacationBaseSalary + totalVariablesForPeric) * config.fixedValues.PERICULOSIDADE_PERCENT);
          earnings.push({ description: `PERICULOSIDADE`, total: pericValue, isVariable: false });
      }
      const subTotal = vacationBaseSalary + totalVariables + pericValue;
      earnings.push({ description: '1/3 CONSTITUCIONAL DE FÉRIAS', total: round2(subTotal / 3), isVariable: false });
      const finalGross = round2(subTotal + (subTotal / 3));
      
      const inss = calculateINSS(finalGross, config.inssTable);
      deductions.push({ description: 'INSS S/ FÉRIAS', total: inss });
      
      const irBase = finalGross - inss; 
      let irBracket = config.irTable[0];
      for (const bracket of config.irTable) { if (bracket.limit === null || irBase <= bracket.limit) { irBracket = bracket; break; } }
      const irTax = round2((irBase * irBracket.rate) - irBracket.deduction);
      if (irTax > 0) deductions.push({ description: 'IRRF S/ FÉRIAS', total: irTax, rate: irBracket.rate });
      return { employee: { ...employee, baseSalary: calculatedBaseSalary }, earnings, deductions, nonTaxableEarnings: [], totals: { gross: finalGross, net: round2(finalGross - (deductions.reduce((acc, curr) => acc + curr.total, 0))), totalDeductions: round2(deductions.reduce((acc, curr) => acc + curr.total, 0)), fgts: round2(finalGross * 0.08), totalNonTaxable: 0 }, metadata: { businessDays: 0, dsrMultiplier: 0, sundaysAndHolidays: 0, payrollType } };
  }

  // --- FOLHA MENSAL ---
  if (payrollType === 'MONTHLY') {
      earnings.push({ description: isProportional ? `Salário Base (${paidDays} dias - Adm ${employee.admissionDate.split('-').reverse().join('/')})` : `Salário Base (${paidDays} dias) + Comp. Orgânica`, total: calculatedBaseSalary, isVariable: false });
      
      if (config.valeAlimentacao > 0 && employee.admissionDate) {
          const [admY, admM, admD] = employee.admissionDate.split('-').map(Number);
          const vestingDate = new Date(admY, admM - 1, admD + 90);
          
          let vaDays = 0;
          // Se o 1º dia do mês de cálculo for posterior à data de carência (90 dias), paga integral (proporcional aos dias trabalhados/férias)
          if (calculationDate > vestingDate) {
             vaDays = paidDays;
          } 
          // Se cair no mesmo mês que completa 90 dias
          else if (calculationDate.getFullYear() === vestingDate.getFullYear() && calculationDate.getMonth() === vestingDate.getMonth()) {
              const daysInMonth = new Date(calculationDate.getFullYear(), calculationDate.getMonth() + 1, 0).getDate();
              // Dias elegíveis = do dia do vesting até o fim do mês
              const eligibleDays = daysInMonth - vestingDate.getDate() + 1;
              vaDays = Math.min(Math.max(0, eligibleDays), paidDays);
          }
          
          if (vaDays > 0 && !config.valeAlimentacaoSeparate) {
              nonTaxableEarnings.push({ description: vaDays < 30 ? `VALE ALIMENTAÇÃO (${vaDays} DIAS)` : 'VALE ALIMENTAÇÃO', total: round2((config.valeAlimentacao / 30) * vaDays) });
          }
      }
  }

  const hoursMap = [
    { key: 'diurna', label: 'Hora diurna' }, { key: 'noturna', label: 'Hora noturna' },
    { key: 'espDiurno', label: 'Hora Esp.Diurno' }, { key: 'espNoturno', label: 'Hora Esp. Noturno' },
    { key: 'reDiurno', label: 'RE Diurno' }, { key: 'reNoturna', label: 'RE Noturna' },
    { key: 'reEspDiurno', label: 'RE Esp. Diurno' }, { key: 'reEspNoturno', label: 'RE Esp. Noturno' },
    { key: 'saDiurno', label: 'SA Diurno' }, { key: 'saNoturna', label: 'SA Noturna' },
    { key: 'saEspDiurno', label: 'SA Esp. Diurno' }, { key: 'saEspNoturno', label: 'SA Esp. Noturno' },
    { key: 'simulador', label: 'SIMULADOR' }, { key: 'horaSolo', label: 'HORA DE SOLO' },
  ];

  let totalVariableEarnings = 0;
  let totalHoursEarnings = 0;
  let valTriTre = 0;
  let valAdFuncao = 0;
  let valFolgaDeslocada = 0;

  hoursMap.forEach(h => {
    // @ts-ignore
    const qty = employee.hours[h.key];
    // @ts-ignore
    const rate = rates[h.key];
    const total = round2(qty * rate);
    if (payrollType === 'MONTHLY') earnings.push({ description: h.label, quantity: qty, rate: rate, total: total, isVariable: true });
    totalVariableEarnings += total;
    totalHoursEarnings += total;
  });

  if (employee.folgaDeslocada > 0) {
    valFolgaDeslocada = round2(employee.folgaDeslocada * config.fixedValues.FOLGA_DESLOCADA);
    if (payrollType === 'MONTHLY') earnings.push({ description: 'FOLGA DESLOCADA', total: valFolgaDeslocada, quantity: employee.folgaDeslocada, rate: config.fixedValues.FOLGA_DESLOCADA, isVariable: true });
    totalVariableEarnings += valFolgaDeslocada;
  }

  if (employee.triTre === 'TRE') {
    valTriTre = round2(config.fixedValues.TRE_SFE * salaryFactor);
    if (payrollType === 'MONTHLY') earnings.push({ description: `Adicional TRE/SFE`, total: valTriTre, isVariable: true });
    totalVariableEarnings += valTriTre;
  } else if (employee.triTre === 'TRI') {
    valTriTre = round2(config.fixedValues.TRI_SFI * salaryFactor);
    if (payrollType === 'MONTHLY') earnings.push({ description: `Adicional TRI/SFI`, total: valTriTre, isVariable: true });
    totalVariableEarnings += valTriTre;
  }

  if (employee.adFuncao !== 'NA') {
    let baseVal = 0;
    switch (employee.adFuncao) {
        case 'D.OPR': baseVal = config.fixedValues.D_OPR; break;
        case 'D.SAFETY': baseVal = config.fixedValues.D_SAFETY; break;
        case 'P.CHEFE': baseVal = config.fixedValues.P_CHEFE; break; 
        case 'G.KEEPER': baseVal = config.fixedValues.G_KEEPER; break;
        case 'D.GERAL': baseVal = config.fixedValues.D_GERAL; break;
        case 'ACORDO': baseVal = config.fixedValues.ACORDO; break;
    }
    if (baseVal > 0) {
        valAdFuncao = round2(baseVal * salaryFactor);
        if (payrollType === 'MONTHLY') earnings.push({ description: `AD.FUNÇÃO`, total: valAdFuncao, isVariable: true });
        totalVariableEarnings += valAdFuncao;
    }
  }

  if (employee.periculosidade && (calculationDate.getFullYear() > 2024 || (calculationDate.getFullYear() === 2024 && calculationDate.getMonth() >= 9))) {
    // Periculosidade sobre: Salário Base + Horas + Gratificações (TRI/TRE + Folga) - EXCETO Ad. Função
    const valPeric = round2((calculatedBaseSalary + totalHoursEarnings + valTriTre + valFolgaDeslocada) * config.fixedValues.PERICULOSIDADE_PERCENT);
    if (payrollType === 'MONTHLY') earnings.push({ description: 'Periculosidade', total: valPeric, isVariable: true });
    totalVariableEarnings += valPeric;
  }

  let valDsr = 0;
  if (effectiveBusinessDays > 0) {
      // DSR sobre tudo que é variável e adicionais (Incluindo Periculosidade)
      valDsr = round2((totalVariableEarnings / effectiveBusinessDays) * effectiveDsrDays);
  }
  if (employee.dsrOverride) valDsr = employee.dsrOverride;
  if (payrollType === 'MONTHLY') earnings.push({ description: 'DSR', total: valDsr, isVariable: false });

  // --- LÓGICA 13º SALÁRIO ---
  let finalGross = round2(earnings.reduce((acc, curr) => acc + curr.total, 0));

  if (payrollType === '13_1ST') {
      // Regra: (Média * Avos / 12) / 2
      const avg = first13rdAverage || finalGross;
      const totalProp = (avg * monthsWorked13th) / 12;
      finalGross = round2(totalProp / 2);
      earnings.length = 0; // Limpa brutos mensais se estiver gerando apenas 13o
      earnings.push({ description: `13º SALÁRIO - 1ª PARCELA (${monthsWorked13th}/12 AVOS)`, total: finalGross, isVariable: false });
  } else if (payrollType === '13_2ND') {
      // Regra: (Média * Avos / 12) - Adiantamento
      const avg = annualGrossAverage || finalGross;
      const totalProp = (avg * monthsWorked13th) / 12;
      finalGross = round2(totalProp);
      earnings.length = 0;
      earnings.push({ description: `13º SALÁRIO - VALOR INTEGRAL (${monthsWorked13th}/12 AVOS)`, total: finalGross, isVariable: false });
      deductions.push({ description: 'ADIANTAMENTO 13º SALÁRIO', total: (savedAdvanceValue || round2(finalGross / 2)) });
  }

  // Deduções Legais
  let inss = 0;
  if (payrollType !== '13_1ST') {
      inss = calculateINSS(finalGross, config.inssTable);
      deductions.push({ description: payrollType === '13_2ND' ? 'INSS S/ 13º' : 'INSS', total: inss });
  }

  if (payrollType !== '13_1ST') {
      const irBase = finalGross - inss;
      let irBracket = config.irTable[0];
      for (const b of config.irTable) { if (b.limit === null || irBase <= b.limit) { irBracket = b; break; } }
      // FIX: Corrected variable name from 'bracket' to 'irBracket' to match declaration above
      const irTax = round2((irBase * irBracket.rate) - irBracket.deduction);
      if (irTax > 0) deductions.push({ description: payrollType === '13_2ND' ? 'IRRF S/ 13º' : 'IRRF', total: irTax, rate: irBracket.rate });
  }

  const totalDeductions = round2(deductions.reduce((acc, curr) => acc + curr.total, 0));
  const totalNonTaxable = round2(nonTaxableEarnings.reduce((a,c)=>a+c.total,0));
  
  // FGTS: 8% do bruto tributável
  const baseFgts = payrollType === '13_2ND' ? (finalGross - (savedAdvanceValue || round2(finalGross / 2))) : finalGross;
  const fgts = round2(baseFgts * 0.08);

  return {
    employee: { ...employee, baseSalary: calculatedBaseSalary }, 
    earnings, deductions, nonTaxableEarnings,
    totals: { gross: finalGross, net: round2((finalGross + totalNonTaxable) - totalDeductions), totalDeductions, fgts, totalNonTaxable },
    metadata: { businessDays: effectiveBusinessDays, dsrMultiplier: effectiveDsrDays, sundaysAndHolidays: totalDays - businessDays, payrollType, monthsWorked13th }
  };
};
