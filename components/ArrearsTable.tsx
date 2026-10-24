
import React, { useMemo, useState } from 'react';
import { Employee, Holiday, CCTConfigData } from '../types';
import { calculatePayroll, calculateBusinessDays, calculateValeAlimentacaoDevido } from '../utils/calculationService';
import { generateHourlyRates, getConfigForDate, STANDARD_HOLIDAYS } from '../constants';
import { AlertTriangle, Printer, FileText, CheckCircle, RotateCcw } from 'lucide-react';

interface ArrearsTableProps {
  employees: Employee[];
  history: Record<string, Employee[]>;
  arrearsMap: Record<string, number>; // Key: "empId_monthKey", Value: 0 | 10 | 20
  arrearsFgtsMap: Record<string, boolean>; // Key: "empId_monthKey", Value: boolean
  arrearsPaidMap: Record<string, boolean>; // Key: "empId_monthKey", Value: boolean
  arrearsVaMap: Record<string, boolean>; // Key: "empId_monthKey", Value: VA (vale alimentação) em atraso
  onUpdateArrearVa: (key: string, value: boolean) => void;
  onUpdateArrear: (key: string, value: number) => void;
  onUpdateArrearFgts: (key: string, value: boolean) => void;
  onUpdateArrearPaid: (key: string, value: boolean) => void;
  ignoredHolidays?: string[]; // Prop to respect ignored holidays
  customHolidays?: Holiday[]; // Prop to respect custom holidays
  currentDate: Date; // Passed from App to determine range end
  cctHistory: CCTConfigData[]; // New Prop: Customized CCT History
  manualBusinessDays: number; // New Prop: Current Manual Business Days
}

// CCT dos Aeronautas: vale alimentação devido a toda a categoria a partir da competência DEZ/2024
const VA_START_DATE = new Date(2024, 11, 1);

// Linhas do cálculo da rescisão, usadas no detalhamento da impressão
interface TerminationLines {
    earnings: { description: string, total: number }[];
    nonTaxable: { description: string, total: number }[];
    deductions: { description: string, total: number }[];
}

// Rescisão cai na coluna do mês de pagamento = mês do desligamento + 2 (key "ano-mês-R")
const isTerminationPaymentMonth = (emp: Employee, year: number, month: number): boolean => {
    if (!emp.resignationDate) return false;
    const [resY, resM] = emp.resignationDate.split('-').map(Number);
    return resY * 12 + (resM - 1) + 2 === year * 12 + month;
};

// Sufixo da marcação extra da rescisão (guardada no mesmo mapa booleano do VA, chave "empId_mês-R:F40")
const TERMINATION_EXTRA_FGTS40 = ':F40'; // Multa de 40% do FGTS não paga junto da rescisão

const getActiveDaysInMonth = (year: number, month: number, admissionDate: string, resignationDate?: string): number => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const admParts = admissionDate.split('-').map(Number);
    const admDateObj = new Date(admParts[0], admParts[1] - 1, admParts[2]);

    let resDateObj: Date | null = null;
    if (resignationDate) {
        const resParts = resignationDate.split('-').map(Number);
        resDateObj = new Date(resParts[0], resParts[1] - 1, resParts[2]);
    }

    let activeDays = daysInMonth;

    if (admDateObj.getFullYear() > year) activeDays = 0;
    else if (admDateObj.getFullYear() === year && admDateObj.getMonth() === month) activeDays = daysInMonth - admDateObj.getDate() + 1;
    else if (admDateObj.getFullYear() === year && admDateObj.getMonth() > month) activeDays = 0;

    if (resDateObj) {
        if (resDateObj.getFullYear() < year) activeDays = 0;
        else if (resDateObj.getFullYear() === year && resDateObj.getMonth() === month) activeDays = resDateObj.getDate();
        else if (resDateObj.getFullYear() === year && resDateObj.getMonth() < month) activeDays = 0;
    }
    return activeDays < 0 ? 0 : activeDays;
};

const ArrearsTable: React.FC<ArrearsTableProps> = ({ 
  employees, 
  history, 
  arrearsMap, 
  arrearsFgtsMap,
  arrearsPaidMap,
  arrearsVaMap,
  onUpdateArrearVa,
  onUpdateArrear,
  onUpdateArrearFgts,
  onUpdateArrearPaid,
  ignoredHolidays = [],
  customHolidays = [],
  currentDate,
  cctHistory,
  manualBusinessDays
}) => {
  const [filterStartDate, setFilterStartDate] = useState<string>('2024-01');
  const [unselectedForPrint, setUnselectedForPrint] = useState<Set<string>>(new Set());

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handlePrint = () => {
    window.print();
  };

  // Multa fixa por descumprimento da CCT vigente na competência da coluna (R$ 150,48 na CCT 24-25, R$ 157,52 na 25-26)
  const getBreachValue = (key: string): number => {
    const parts = key.split('-').map(p => (p === 'V' ? NaN : Number(p)));
    let refDate: Date;
    if (key.includes('-13-')) {
        refDate = parts[2] === 1 ? new Date(parts[0], 10, 30) : new Date(parts[0], 11, 20);
    } else if (key.endsWith('-V')) {
        refDate = new Date(parts[0], parts[1], 1);
    } else {
        refDate = new Date(parts[0], parts[1] - 1, 1);
    }
    return getConfigForDate(refDate, cctHistory).cctBreachFine || 0;
  };

  // Marca como atrasado (multa) todas as competências de DEZ/24 em diante ainda sem marcação, por causa do VA da CCT
  const handleMarkAllVaLate = (percentage: number) => {
    displayedEmployees.forEach(emp => {
      sortedMonths.forEach(mKey => {
        if (mKey.includes('-13-') || mKey.endsWith('-V') || mKey.endsWith('-R')) return;
        if (!isEligibleForMonth(emp, mKey)) return;
        const [y, m] = mKey.split('-').map(Number);
        if (new Date(y, m - 1, 1) < VA_START_DATE) return;
        if (!(salariesData[mKey]?.[emp.id]?.va)) return;
        const arrearKey = `${emp.id}_${mKey}`;
        if (arrearsVaMap[arrearKey] === undefined) onUpdateArrearVa(arrearKey, true);
        if (arrearsMap[arrearKey] === undefined) onUpdateArrear(arrearKey, percentage);
      });
    });
  };

  // 1. Agregar TODOS os funcionários únicos
  const allEmployees = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach(emp => map.set(emp.id, emp));
    (Object.values(history) as Employee[][]).forEach(list => {
        list.forEach(emp => {
            if (!map.has(emp.id)) {
                map.set(emp.id, emp);
            }
        });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, history]);

  // 2. Gerar colunas de JAN/24 até a Data Atual (currentDate) INCLUINDO 13º e Férias
  const sortedMonths = useMemo(() => {
    const keys: string[] = [];
    
    // Start form filterStartDate
    const [startYear, startMonth] = filterStartDate.split('-').map(Number);
    const start = new Date(startYear, startMonth - 1, 1); 
    
    // Target end date: Current Date (Selected in App)
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    const ptr = new Date(start);
    
    let safety = 0;
    while (ptr <= end && safety < 120) {
        const y = ptr.getFullYear();
        const m = ptr.getMonth();
        
        keys.push(`${y}-${m}`); // Mês Normal

        // Inserir Férias se algum funcionário tiver férias neste mês
        const hasVacation = allEmployees.some(emp => {
            if (emp.vacationHistory?.some(v => {
                const [vy, vm] = v.startDate.split('-').map(Number);
                return vy === y && (vm - 1) === m;
            })) return true;
            if (emp.vacationStartDate) {
                const [vy, vm] = emp.vacationStartDate.split('-').map(Number);
                return vy === y && (vm - 1) === m;
            }
            return false;
        });

        if (hasVacation) {
            keys.push(`${y}-${m}-V`);
        }

        // Rescisão: acerto pago 2 meses após o desligamento (mesma regra da geração dos contracheques)
        if (allEmployees.some(emp => isTerminationPaymentMonth(emp, y, m))) {
            keys.push(`${y}-${m}-R`);
        }

        // Inserir 13º após Novembro (1ª Parc) e Dezembro (2ª Parc)
        if (m === 10) { // Novembro
            keys.push(`${y}-13-1`);
        }
        if (m === 11) { // Dezembro
            keys.push(`${y}-13-2`);
        }

        ptr.setMonth(ptr.getMonth() + 1);
        safety++;
    }

    // Rescisões cujo mês de pagamento (desligamento + 2) é depois do mês selecionado também ganham coluna
    const endAbs = end.getFullYear() * 12 + end.getMonth();
    const startAbs = start.getFullYear() * 12 + start.getMonth();
    allEmployees.forEach(emp => {
        if (!emp.resignationDate) return;
        const [resY, resM] = emp.resignationDate.split('-').map(Number);
        const payAbs = resY * 12 + (resM - 1) + 2;
        if (payAbs <= endAbs || payAbs < startAbs) return;
        const key = `${Math.floor(payAbs / 12)}-${payAbs % 12}-R`;
        if (!keys.includes(key)) keys.push(key);
    });

    return keys;
  }, [currentDate, filterStartDate, allEmployees]);

  // 3. Função de Elegibilidade
  const isEligibleForMonth = (emp: Employee, key: string): boolean => {
      if (key.endsWith('-R')) {
          const [ry, rm] = key.split('-').map(Number);
          return isTerminationPaymentMonth(emp, ry, rm);
      }

      let currentMonthDate: Date;

      if (key.includes('-13-')) {
          const [y, type, part] = key.split('-').map(Number);
          currentMonthDate = part === 1 ? new Date(y, 10, 30) : new Date(y, 11, 20);
      } else if (key.endsWith('-V')) {
          const [y, m] = key.split('-').map(Number);
          currentMonthDate = new Date(y, m, 1);
          
          const hasVacation = emp.vacationHistory?.some(v => {
              const [vy, vm] = v.startDate.split('-').map(Number);
              return vy === y && (vm - 1) === m;
          }) || (emp.vacationStartDate && (() => {
              const [vy, vm] = emp.vacationStartDate.split('-').map(Number);
              return vy === y && (vm - 1) === m;
          })());
          
          if (!hasVacation) return false;
      } else {
          const [year, month] = key.split('-').map(Number);
          currentMonthDate = new Date(year, month, 1);
      }

      // Regra 1: A partir do mês seguinte à admissão
      if (emp.admissionDate) {
          const [admY, admM] = emp.admissionDate.split('-').map(Number);
          const admMonthIndex = admM - 1; 
          const admDateObj = new Date(admY, admMonthIndex, 1);
          
          if (currentMonthDate.getTime() <= admDateObj.getTime()) {
              return false;
          }
      }

      // Regra 2: Até 1 mês após desligamento
      if (emp.resignationDate) {
          const [resY, resM, resD] = emp.resignationDate.split('-').map(Number);
          const resDateObj = new Date(resY, resM - 1, resD);
          
          if (key.includes('-13-')) {
              if (currentMonthDate > resDateObj) return false;
          } else {
              const limitDate = new Date(resY, resM - 1, 1);
              limitDate.setMonth(limitDate.getMonth() + 1);
              if (currentMonthDate > limitDate) return false;
          }
      }

      return true;
  };

  // 4. Filtrar funcionários
  const displayedEmployees = useMemo(() => {
      if (sortedMonths.length === 0) return [];
      
      const lastKey = sortedMonths[sortedMonths.length - 1];
      let lastDate: Date;
      if (lastKey.includes('-13-')) {
          const [y] = lastKey.split('-').map(Number);
          lastDate = new Date(y, 11, 31);
      } else {
          const [y, m] = lastKey.split('-').map(Number);
          lastDate = new Date(y, m + 1, 0);
      }

      return allEmployees.filter(emp => {
          if (sortedMonths.some(mKey => isEligibleForMonth(emp, mKey))) return true;
          if (emp.admissionDate) {
             const [admY, admM] = emp.admissionDate.split('-').map(Number);
             const admDate = new Date(admY, admM - 1, 1);
             if (admDate > lastDate) return true;
          }
          return false;
      });
  }, [allEmployees, sortedMonths]);

  // Formatters
  const formatHeader = (key: string) => {
    const parts = key.split('-');
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    if (parts.length === 3 && parts[1] === '13') {
        const p = Number(parts[2]);
        return <span className="text-indigo-200">13º {p}ª<br/><span className="text-[9px] opacity-75">{y}</span></span>;
    }
    if (parts.length === 3 && parts[2] === 'V') {
        const date = new Date(y, m, 1); 
        const ms = date.toLocaleString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
        const ys = date.toLocaleString('pt-BR', { year: '2-digit' });
        return <span className="text-orange-200">FÉRIAS<br/><span className="text-[9px] opacity-75">{ms}{ys}</span></span>;
    }
    if (parts.length === 3 && parts[2] === 'R') {
        const date = new Date(y, m - 1, 1);
        const ms = date.toLocaleString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
        const ys = date.toLocaleString('pt-BR', { year: '2-digit' });
        return <span className="text-rose-200">RESCISÃO<br/><span className="text-[9px] opacity-75">{ms}{ys}</span></span>;
    }
    const date = new Date(y, m - 1, 1);
    const ms = date.toLocaleString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
    const ys = date.toLocaleString('pt-BR', { year: '2-digit' });
    return `H_${ms}${ys}`;
  };

  const getMonthName = (key: string) => {
      const parts = key.split('-');
      const y = Number(parts[0]);
      const m = Number(parts[1]);
      if (parts.length === 3 && parts[1] === '13') {
          const p = Number(parts[2]);
          return `13º SALÁRIO - ${p}ª PARCELA / ${y}`;
      }
      if (parts.length === 3 && parts[2] === 'V') {
          const date = new Date(y, m, 1);
          return `FÉRIAS - ${date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}`;
      }
      if (parts.length === 3 && parts[2] === 'R') {
          const date = new Date(y, m - 1, 1);
          return `RESCISÃO - ${date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}`;
      }
      const date = new Date(y, m - 1, 1);
      return date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
  };

  // 5. CÁLCULO DOS VALORES BRUTOS E LÍQUIDOS (MENSAL + 13º)
  const salariesData = useMemo(() => {
    const monthlyCache: Record<string, Record<string, { gross: number, net: number, va?: number, avgGross?: number, fgts?: number, fgtsBase?: number, fgtsRate?: number, termination?: TerminationLines }>> = {};
    const finalCache: Record<string, Record<string, { gross: number, net: number, va?: number, avgGross?: number, fgts?: number, fgtsBase?: number, fgtsRate?: number, termination?: TerminationLines }>> = {};

    const yearsToCalc = new Set<number>();
    sortedMonths.forEach(k => yearsToCalc.add(parseInt(k.split('-')[0])));

    // Rescisão: o saldo do FGTS acumulado precisa dos meses desde a admissão
    allEmployees.forEach(emp => {
        if (!emp.resignationDate || !emp.admissionDate) return;
        if (!sortedMonths.some(k => k.endsWith('-R') && isEligibleForMonth(emp, k))) return;
        const admYear = Number(emp.admissionDate.split('-')[0]);
        const resYear = Number(emp.resignationDate.split('-')[0]);
        for (let y = admYear; y <= resYear + 1; y++) yearsToCalc.add(y);
    });

    const fullYearMonths: string[] = [];
    yearsToCalc.forEach(y => {
        for (let m = 0; m < 12; m++) fullYearMonths.push(`${y}-${m}`);
    });

    fullYearMonths.forEach(monthKey => {
        const [uiYear, uiMonth] = monthKey.split('-').map(Number);
        
        const isCurrentContextMonth = 
            uiYear === currentDate.getFullYear() && 
            uiMonth === currentDate.getMonth();

        const competenceDate = new Date(uiYear, uiMonth - 1, 1);
        const compYear = competenceDate.getFullYear();
        const compMonth = competenceDate.getMonth();

        const config = getConfigForDate(competenceDate, cctHistory); 
        const totalCorrection = config.inpc + (config.otherCorrection || 0);
        const hourlyRates = generateHourlyRates(config.horaVooAnterior, totalCorrection, config.simuladorAnterior, config.horaSoloAnterior);
        
        let businessDays, totalDays;
        
        if (isCurrentContextMonth) {
            totalDays = new Date(compYear, compMonth + 1, 0).getDate(); 
            businessDays = manualBusinessDays; 
        } else {
            const calculated = calculateBusinessDays(compYear, compMonth, ignoredHolidays, customHolidays);
            businessDays = calculated.businessDays;
            totalDays = calculated.totalDays;
        }

        const effectiveDsrMultiplier = config.dsrMultiplier || 8;
        const daysInCompetenceMonth = totalDays; 

        const histList = isCurrentContextMonth ? employees : history[monthKey]; 
        const monthMap: Record<string, { gross: number, net: number, va?: number, avgGross?: number, fgts?: number, fgtsBase?: number, fgtsRate?: number, termination?: TerminationLines }> = {};

        allEmployees.forEach(emp => {
            let empToCalc = histList?.find(h => h.id === emp.id);
            if (!empToCalc) {
                empToCalc = { ...emp, hours: { diurna:0, noturna:0, espDiurno:0, espNoturno:0, reDiurno:0, reNoturna:0, reEspDiurno:0, reEspNoturno:0, saDiurno:0, saNoturna:0, saEspDiurno:0, saEspNoturno:0, simulador:0, horaSolo:0 }, folgaDeslocada: 0 };
            }
            if (emp.admissionDate) {
                const [ay, am] = emp.admissionDate.split('-').map(Number);
                const aDate = new Date(ay, am-1, 1);
                if (competenceDate < aDate) {
                    monthMap[emp.id] = { gross: 0, net: 0 };
                    return;
                }
            }
            const result = calculatePayroll(empToCalc, businessDays, daysInCompetenceMonth, config, hourlyRates, effectiveDsrMultiplier, competenceDate, 'MONTHLY');
            // VA pago à parte (não está na folha): entra como verba indenizatória, sem FGTS/INSS/IR
            const va = (config.valeAlimentacaoSeparate && competenceDate >= VA_START_DATE)
                ? calculateValeAlimentacaoDevido(empToCalc, config, competenceDate)
                : 0;
            // Média do 13º: mês de férias entra cheio (dias de férias contam como trabalhados)
            const avgGross = calculatePayroll(empToCalc, businessDays, daysInCompetenceMonth, config, hourlyRates, effectiveDsrMultiplier, competenceDate, 'MONTHLY', undefined, undefined, undefined, [], undefined, undefined, undefined, true).totals.gross;
            monthMap[emp.id] = { gross: result.totals.gross, net: result.totals.net, va, avgGross };
        });
        monthlyCache[monthKey] = monthMap;
    });

    sortedMonths.forEach(key => {
        const parts = key.split('-');
        const y = Number(parts[0]);
        const m = Number(parts[1]);
        const finalMap: Record<string, { gross: number, net: number, va?: number, avgGross?: number, fgts?: number, fgtsBase?: number, fgtsRate?: number, termination?: TerminationLines }> = {};

        if (parts.length === 3 && parts[1] === '13') {
            const p = Number(parts[2]);
            const isSecond = p === 2;
            const refDate = isSecond ? new Date(y, 11, 20) : new Date(y, 10, 30);
            
            const config = getConfigForDate(refDate, cctHistory); 
            const totalCorrection = config.inpc + (config.otherCorrection || 0);
            const hourlyRates = generateHourlyRates(config.horaVooAnterior, totalCorrection, config.simuladorAnterior, config.horaSoloAnterior);
            
            const refMonthIndex = p === 1 ? 9 : 10;
            const { businessDays, totalDays } = calculateBusinessDays(y, refMonthIndex, ignoredHolidays, customHolidays);
            
            const effectiveDsrMultiplier = config.dsrMultiplier || 8;

            allEmployees.forEach(emp => {
                if (!isEligibleForMonth(emp, key)) { finalMap[emp.id] = { gross: 0, net: 0 }; return; }

                let sumGross = 0;
                let countMonths = 0;
                const limitMonth = isSecond ? 11 : 10; 

                for (let i = 0; i <= limitMonth; i++) {
                    const mKey = `${y}-${i}`;
                    const val = monthlyCache[mKey]?.[emp.id]?.avgGross ?? monthlyCache[mKey]?.[emp.id]?.gross ?? 0;
                    const activeDays = getActiveDaysInMonth(y, i, emp.admissionDate, emp.resignationDate);

                    if (val > 0 && activeDays >= 15) {
                        sumGross += val;
                        countMonths++;
                    }
                }
                const avg = countMonths > 0 ? sumGross / countMonths : 0;
                if (avg === 0) { finalMap[emp.id] = { gross: 0, net: 0 }; return; }

                // 2ª parcela: o adiantamento descontado é o valor real da 1ª parcela
                const gross1st = isSecond ? (finalCache[`${y}-13-1`]?.[emp.id]?.gross || 0) : 0;

                const res = calculatePayroll(
                    emp,
                    businessDays,
                    totalDays,
                    config,
                    hourlyRates,
                    effectiveDsrMultiplier,
                    refDate,
                    isSecond ? '13_2ND' : '13_1ST',
                    gross1st > 0 ? gross1st : undefined,
                    avg,
                    avg,
                    ignoredHolidays
                );

                let grossValue = res.totals.gross;
                // O líquido da 2ª parcela já vem com o adiantamento, INSS e IRRF descontados pelo cálculo
                const netValue = res.totals.net;

                if (isSecond) {
                    grossValue = Math.max(0, grossValue - gross1st);
                }
                
                finalMap[emp.id] = { gross: grossValue, net: netValue };
            });

        } else if (parts.length === 3 && parts[2] === 'V') {
            allEmployees.forEach(emp => {
                if (!isEligibleForMonth(emp, key)) { finalMap[emp.id] = { gross: 0, net: 0 }; return; }
                
                const vRecord = emp.vacationHistory?.find(v => {
                    const [vy, vm] = v.startDate.split('-').map(Number);
                    return vy === y && (vm - 1) === m;
                }) || (emp.vacationStartDate && (() => {
                    const [vy, vm] = emp.vacationStartDate.split('-').map(Number);
                    if (vy === y && (vm - 1) === m) {
                        return { startDate: emp.vacationStartDate, days: emp.vacationDays || 30, periodStart: '', periodEnd: '' };
                    }
                    return null;
                })());
                
                if (!vRecord) { finalMap[emp.id] = { gross: 0, net: 0 }; return; }
                
                let vacationDetailedMap: Record<string, { total: number, quantity: number }> = {};
                
                if (vRecord.periodStart && vRecord.periodEnd) {
                    const [startY, startM] = vRecord.periodStart.split('-').map(Number);
                    const [endY, endM] = vRecord.periodEnd.split('-').map(Number);
                    const iterDate = new Date(startY, startM - 1, 1);
                    const targetEnd = new Date(endY, endM - 1, 1);
                    let safety = 0;
                    while(iterDate <= targetEnd && safety < 12) {
                        const iYear = iterDate.getFullYear(), iMonth = iterDate.getMonth();
                        let pM = iMonth + 1;
                        let pY = iYear;
                        if(pM > 11) { pM = 0; pY++; }
                        
                        const histKey = `${pY}-${pM}`;
                        const histEmps = history[histKey];
                        let empInHist = histEmps?.find(e => e.id === emp.id) || (histKey === `${currentDate.getFullYear()}-${currentDate.getMonth()}` ? emp : null);
                        
                        if (empInHist) {
                            const hConfig = getConfigForDate(iterDate, cctHistory);
                            const hRates = generateHourlyRates(hConfig.horaVooAnterior, hConfig.inpc + (hConfig.otherCorrection || 0), hConfig.simuladorAnterior, hConfig.horaSoloAnterior);
                            const { businessDays: hBusinessDays } = calculateBusinessDays(iYear, iMonth, ignoredHolidays, customHolidays);
                            const hTotalDays = new Date(iYear, iMonth + 1, 0).getDate();
                            const hResult = calculatePayroll(empInHist, hBusinessDays, hTotalDays, hConfig, hRates, hConfig.dsrMultiplier || 8, iterDate, 'MONTHLY');
                            
                            hResult.earnings.forEach(item => {
                                if (item.isVariable && item.description !== 'Periculosidade' && item.description !== 'DSR') {
                                    let desc = item.description.replace(' (Prop.)', '');
                                    if (['D.OPR', 'D.SAFETY', 'P.CHEFE', 'G.KEEPER', 'D.GERAL', 'ACORDO'].some(opt => desc.includes(opt)) || desc === 'AD.FUNÇÃO') desc = 'AD.FUNÇÃO';
                                    if (vacationDetailedMap[desc] === undefined) vacationDetailedMap[desc] = { total: 0, quantity: 0 };
                                    vacationDetailedMap[desc].total += item.total;
                                    if (item.quantity) vacationDetailedMap[desc].quantity += item.quantity;
                                }
                            });
                        }
                        iterDate.setMonth(iterDate.getMonth() + 1); safety++;
                    }
                }
                
                const vacationDetailedAverages = Object.keys(vacationDetailedMap).map(k => ({ description: k, total: vacationDetailedMap[k].total / 12, quantity: vacationDetailedMap[k].quantity / 12 }));
                
                const refDate = new Date(y, m, 1);
                const config = getConfigForDate(refDate, cctHistory);
                const totalCorrection = config.inpc + (config.otherCorrection || 0);
                const hourlyRates = generateHourlyRates(config.horaVooAnterior, totalCorrection, config.simuladorAnterior, config.horaSoloAnterior);
                
                const result = calculatePayroll(
                    emp, 
                    0, 
                    30, 
                    config, 
                    hourlyRates, 
                    config.dsrMultiplier || 8, 
                    refDate, 
                    'VACATION', 
                    undefined, 
                    undefined, 
                    undefined, 
                    ignoredHolidays, 
                    vacationDetailedAverages
                );
                
                finalMap[emp.id] = { gross: result.totals.gross, net: result.totals.net };
            });

        } else if (parts.length === 3 && parts[2] === 'R') {
            // RESCISÃO: acerto calculado como no contracheque de rescisão (sem variáveis do mês anterior)
            allEmployees.forEach(emp => {
                if (!isEligibleForMonth(emp, key) || !emp.resignationDate) { finalMap[emp.id] = { gross: 0, net: 0 }; return; }

                const [resY, resM] = emp.resignationDate.split('-').map(Number);
                const resCompetence = new Date(resY, resM - 1, 1);
                const config = getConfigForDate(resCompetence, cctHistory);
                const hourlyRates = generateHourlyRates(config.horaVooAnterior, config.inpc + (config.otherCorrection || 0), config.simuladorAnterior, config.horaSoloAnterior);
                const { businessDays: resBusinessDays, totalDays: resTotalDays } = calculateBusinessDays(resY, resM - 1, ignoredHolidays, customHolidays);

                // Média anual do bruto (mês com 15+ dias ativos), igual à média usada no contracheque de rescisão
                let sumGross = 0;
                let countMonths = 0;
                for (let i = 0; i < 12; i++) {
                    const payKey = i + 1 > 11 ? `${resY + 1}-0` : `${resY}-${i + 1}`;
                    const val = monthlyCache[payKey]?.[emp.id]?.avgGross ?? monthlyCache[payKey]?.[emp.id]?.gross ?? 0;
                    if (val > 0 && getActiveDaysInMonth(resY, i, emp.admissionDate, emp.resignationDate) >= 15) {
                        sumGross += val;
                        countMonths++;
                    }
                }
                const avg = countMonths > 0 ? sumGross / countMonths : 0;

                // Saldo do FGTS acumulado = 8% do bruto de cada mês trabalhado antes do mês do desligamento
                // + 8% dos 13º dos anos anteriores (mês de férias entra cheio; o 1/3 de férias não está incluído)
                const [admY, admM] = emp.admissionDate.split('-').map(Number);
                const resAbs = resY * 12 + (resM - 1);
                const monthlyBase = (cy: number, cm: number): number => {
                    const payKey = cm + 1 > 11 ? `${cy + 1}-0` : `${cy}-${cm + 1}`;
                    return monthlyCache[payKey]?.[emp.id]?.avgGross ?? monthlyCache[payKey]?.[emp.id]?.gross ?? 0;
                };
                let accumulatedFgts = 0;
                for (let abs = admY * 12 + (admM - 1); abs < resAbs; abs++) {
                    accumulatedFgts += monthlyBase(Math.floor(abs / 12), abs % 12) * 0.08;
                }
                for (let py = admY; py < resY; py++) {
                    let ySum = 0, yCount = 0;
                    for (let pm = 0; pm < 12; pm++) {
                        const v = monthlyBase(py, pm);
                        if (v > 0 && getActiveDaysInMonth(py, pm, emp.admissionDate) >= 15) { ySum += v; yCount++; }
                    }
                    if (yCount > 0) accumulatedFgts += (ySum / 12) * 0.08; // média × avos ÷ 12 = soma ÷ 12
                }

                const snapshot = history[key]?.find(h => h.id === emp.id) || { ...emp, hours: { diurna:0, noturna:0, espDiurno:0, espNoturno:0, reDiurno:0, reNoturna:0, reEspDiurno:0, reEspNoturno:0, saDiurno:0, saNoturna:0, saEspDiurno:0, saEspNoturno:0, simulador:0, horaSolo:0 }, folgaDeslocada: 0 };
                const employeeForTerm: Employee = { ...snapshot, resignationDate: emp.resignationDate, terminationType: emp.terminationType || snapshot.terminationType };

                const res = calculatePayroll(
                    employeeForTerm, resBusinessDays, resTotalDays, config, hourlyRates, config.dsrMultiplier || 8,
                    resCompetence, 'TERMINATION', undefined, undefined, avg, ignoredHolidays, undefined, accumulatedFgts
                );

                finalMap[emp.id] = {
                    gross: res.totals.gross + (res.totals.totalNonTaxable || 0), // total das verbas, base das multas
                    net: res.totals.net,
                    fgts: res.totals.fgts,
                    // Base da multa do FGTS: saldo acumulado + FGTS da rescisão (encargos do FGTS em atraso entram depois)
                    fgtsBase: accumulatedFgts + res.totals.fgts,
                    fgtsRate: (['DEMISSAO_INDENIZADA', 'DEMISSAO_TRABALHADA', 'RESCISAO_INDIRETA'].includes(employeeForTerm.terminationType || '')) ? 0.4
                        : employeeForTerm.terminationType === 'ACORDO_484A' ? 0.2 : 0,
                    termination: {
                        earnings: res.earnings.map(e => ({ description: e.description, total: e.total })),
                        nonTaxable: res.nonTaxableEarnings.map(e => ({ description: e.description, total: e.total })),
                        deductions: res.deductions.map(d => ({ description: d.description, total: d.total }))
                    }
                };
            });

        } else {
            Object.assign(finalMap, monthlyCache[key] || {});
        }

        finalCache[key] = finalMap;
    });

    return finalCache;
  }, [history, sortedMonths, allEmployees, ignoredHolidays, customHolidays, cctHistory, currentDate, employees, manualBusinessDays]);

  // FGTS da competência: na rescisão vem do cálculo (inclui aviso indenizado), nas demais é 8% do bruto
  const getFgtsValue = (mKey: string, empId: string, gross: number): number =>
      salariesData[mKey]?.[empId]?.fgts ?? gross * 0.08;

  // Encargos do FGTS em atraso (Lei 8.036/90, art. 22): multa de 5% se pago no mês do vencimento ou 10% a partir do mês seguinte
  // + juros de mora de 0,5% ao mês ou fração, sobre os 8% de cada competência marcada com FGTS. A TR não está incluída.
  // Vencimento do FGTS: dia 7 do mês seguinte à competência (13º: 1ª parcela em dez, 2ª em jan; férias: mês seguinte)
  const getFgtsArrearsCharges = (empId: string): number => {
      const now = new Date();
      let charges = 0;
      sortedMonths.forEach(k => {
          if (k.endsWith('-R') || !arrearsFgtsMap[`${empId}_${k}`]) return;
          const nominal = (salariesData[k]?.[empId]?.gross || 0) * 0.08;
          if (nominal <= 0) return;
          const [ky, km] = k.split('-').map(Number);
          let due: Date;
          if (k.includes('-13-')) due = km === 13 && k.endsWith('-2') ? new Date(ky + 1, 0, 7) : new Date(ky, 11, 7);
          else if (k.endsWith('-V')) due = new Date(ky, km + 1, 7);
          else due = new Date(ky, km, 7);
          if (now <= due) return;
          const monthsLate = Math.max(1, (now.getFullYear() - due.getFullYear()) * 12 + (now.getMonth() - due.getMonth()));
          const sameMonth = now.getFullYear() === due.getFullYear() && now.getMonth() === due.getMonth();
          charges += nominal * ((sameMonth ? 0.05 : 0.10) + 0.005 * monthsLate);
      });
      return charges;
  };

  // Multa extra da rescisão: 40% do FGTS sobre todos os depósitos (saldo acumulado + rescisão) mais os encargos dos atrasos, quando marcada
  const getTerminationExtras = (mKey: string, empId: string, arrearKey: string) => {
      if (!mKey.endsWith('-R')) return { fineFgts40: 0, total: 0 };
      const cell = salariesData[mKey]?.[empId];
      const fineBase = (cell?.fgtsBase || 0) + getFgtsArrearsCharges(empId);
      const fineFgts40 = arrearsVaMap[`${arrearKey}${TERMINATION_EXTRA_FGTS40}`] ? fineBase * (cell?.fgtsRate || 0) : 0;
      return { fineFgts40, total: fineFgts40 };
  };

  // Calcular totais (PENDENTES e QUITADOS separadamente)
  const employeeTotals: Record<string, { finePending: number; fgtsPending: number; finePaid: number; fgtsPaid: number; breachPending: number; breachPaid: number; grossTotal: number; netTotal: number }> = useMemo(() => {
    const totals: Record<string, { finePending: number; fgtsPending: number; finePaid: number; fgtsPaid: number; breachPending: number; breachPaid: number; grossTotal: number; netTotal: number }> = {};
    displayedEmployees.forEach(emp => {
      let finePending = 0;
      let fgtsPending = 0;
      let finePaid = 0;
      let fgtsPaid = 0;
      let breachPending = 0;
      let breachPaid = 0;
      let grossTotal = 0;
      let netTotal = 0;

      sortedMonths.forEach(mKey => {
        if (!isEligibleForMonth(emp, mKey)) return;
        const arrearKey = `${emp.id}_${mKey}`;
        const percentage = arrearsMap[arrearKey] || 0;
        const fgtsSelected = arrearsFgtsMap[arrearKey] || false; 
        const isPaid = arrearsPaidMap[arrearKey] || false;

        const gross = salariesData[mKey]?.[emp.id]?.gross || 0;
        const vaSelected = arrearsVaMap[arrearKey] || false;
        const va = vaSelected ? (salariesData[mKey]?.[emp.id]?.va || 0) : 0;
        const net = (salariesData[mKey]?.[emp.id]?.net || 0) + va;

        const extras = getTerminationExtras(mKey, emp.id, arrearKey);

        // Qualquer item em atraso gera a multa fixa por descumprimento de CCT
        const hasAnyItem = percentage > 0 || fgtsSelected || vaSelected || extras.total > 0;
        const currentBreach = hasAnyItem ? getBreachValue(mKey) : 0;

        if (hasAnyItem) {
            grossTotal += gross;
            netTotal += net;
        }

        let currentFine = 0;
        let currentFgts = extras.fineFgts40; // multa de 40% do FGTS da rescisão soma na coluna do FGTS

        if (percentage > 0) {
          // Multa incide sobre tudo que está em atraso, inclusive o VA
          currentFine = (gross + va) * (percentage / 100);
        }
        if (fgtsSelected) {
          currentFgts += getFgtsValue(mKey, emp.id, gross);
        }

        if (isPaid) {
            finePaid += currentFine;
            fgtsPaid += currentFgts;
            breachPaid += currentBreach;
        } else {
            finePending += currentFine;
            fgtsPending += currentFgts;
            breachPending += currentBreach;
        }
      });
      totals[emp.id] = { finePending, fgtsPending, finePaid, fgtsPaid, breachPending, breachPaid, grossTotal, netTotal };
    });
    return totals;
  }, [displayedEmployees, sortedMonths, arrearsMap, arrearsFgtsMap, arrearsVaMap, arrearsPaidMap, salariesData, cctHistory]);

  const selectedEmployees = useMemo(() => {
      return displayedEmployees.filter(emp => !unselectedForPrint.has(emp.id));
  }, [displayedEmployees, unselectedForPrint]);

  // Totais Gerais PENDENTES (Para exibição principal e impressão)
  const grandTotalFinePending = selectedEmployees.reduce((acc, emp) => acc + (employeeTotals[emp.id]?.finePending || 0), 0);
  const grandTotalFgtsPending = selectedEmployees.reduce((acc, emp) => acc + (employeeTotals[emp.id]?.fgtsPending || 0), 0);
  const grandTotalBreachPending = selectedEmployees.reduce((acc, emp) => acc + (employeeTotals[emp.id]?.breachPending || 0), 0);
  const grandTotalGross = selectedEmployees.reduce((acc, emp) => acc + (employeeTotals[emp.id]?.grossTotal || 0), 0);
  const grandTotalNet = selectedEmployees.reduce((acc, emp) => acc + (employeeTotals[emp.id]?.netTotal || 0), 0);

  return (
    <>
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow border border-gray-300 dark:border-slate-800 flex flex-col h-full no-print">
        
        {/* Cabeçalho */}
        <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-amber-50 dark:bg-amber-950/20 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5" />
            <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-950 dark:text-white uppercase flex items-center gap-2">
                    Cálculo de Atrasados (Incluindo 13º Salário)
                    <div className="flex items-center">
                        <div className="ml-4 flex items-center gap-2">
                            <label className="text-xs text-gray-500 dark:text-slate-400 font-bold uppercase">A partir de:</label>
                            <input 
                                type="month" 
                                value={filterStartDate}
                                onChange={(e) => setFilterStartDate(e.target.value)}
                                className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <button 
                            type="button"
                            onClick={handlePrint}
                            className="ml-4 px-3 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs flex items-center gap-2 shadow-sm transition-colors"
                        >
                            <Printer className="w-3 h-3" /> Imprimir Relatório
                        </button>
                        <div className="ml-4 flex items-center gap-1">
                            <span className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase">VA DEZ/24+ atrasado:</span>
                            <button type="button" onClick={() => handleMarkAllVaLate(10)} className="px-2 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded text-[10px] font-bold">10%</button>
                            <button type="button" onClick={() => handleMarkAllVaLate(20)} className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold">20%</button>
                        </div>
                    </div>
                </h3>
                <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">
                    Selecione o percentual de multa e FGTS. Use o botão <CheckCircle className="w-3 h-3 inline text-green-600"/> para dar baixa nos pagamentos realizados. Apenas tripulantes marcados aparecerão na impressão e nos totais.
                </p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900 px-4 py-2 rounded-lg shadow-sm text-right flex gap-6">
                <div>
                    <span className="text-[10px] text-gray-500 dark:text-slate-400 uppercase font-bold block">Total Multas (A Pagar)</span>
                    <span className="text-xl font-black text-red-600 dark:text-red-400">{formatCurrency(grandTotalFinePending)}</span>
                </div>
                <div>
                    <span className="text-[10px] text-gray-500 dark:text-slate-400 uppercase font-bold block">Total FGTS (A Pagar)</span>
                    <span className="text-xl font-black text-blue-600 dark:text-blue-400">{formatCurrency(grandTotalFgtsPending)}</span>
                </div>
                <div>
                    <span className="text-[10px] text-gray-500 dark:text-slate-400 uppercase font-bold block">Total Descumprimento CCT</span>
                    <span className="text-xl font-black text-purple-600 dark:text-purple-400">{formatCurrency(grandTotalBreachPending)}</span>
                </div>
            </div>
        </div>

        {/* Tabela */}
        <div className="overflow-auto flex-1 relative custom-scrollbar">
            <table className="border-collapse w-full text-xs text-left whitespace-nowrap">
                <thead className="bg-slate-800 text-white font-bold uppercase sticky top-0 z-40">
                    <tr>
                        <th className="p-3 sticky left-0 z-50 bg-slate-800 border-r border-slate-600 w-64 shadow-xl">
                            <div className="flex items-center gap-2">
                                <input 
                                    type="checkbox" 
                                    checked={unselectedForPrint.size === 0 && displayedEmployees.length > 0}
                                    ref={input => { if (input) input.indeterminate = unselectedForPrint.size > 0 && unselectedForPrint.size < displayedEmployees.length; }}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setUnselectedForPrint(new Set());
                                        } else {
                                            setUnselectedForPrint(new Set(displayedEmployees.map(emp => emp.id)));
                                        }
                                    }}
                                    className="w-4 h-4 rounded border-gray-500 bg-slate-700 text-blue-500 focus:ring-blue-500 cursor-pointer"
                                    title="Selecionar todos"
                                />
                                <span>Tripulante</span>
                            </div>
                        </th>
                        {sortedMonths.map(mKey => {
                            const is13th = mKey.includes('-13-');
                            const isVacation = mKey.endsWith('-V');
                            const isTerminationCol = mKey.endsWith('-R');
                            return (
                                <th key={mKey} className={`p-2 border-r border-slate-600 min-w-[160px] text-center ${is13th ? 'bg-indigo-900' : (isVacation ? 'bg-orange-900' : (isTerminationCol ? 'bg-rose-900' : ''))}`}>
                                    {formatHeader(mKey)}
                                </th>
                            );
                        })}
                        <th className="p-3 sticky right-0 z-40 bg-slate-900 border-l border-slate-600 w-32 text-right">
                            Totais Pendentes
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                    {displayedEmployees.map((emp, idx) => {
                        const empTotal = employeeTotals[emp.id] || { finePending: 0, fgtsPending: 0, finePaid: 0, fgtsPaid: 0, breachPending: 0, breachPaid: 0 };
                        return (
                        <tr key={emp.id} className={`${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-gray-50 dark:bg-slate-800/50'} hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors`}>
                            
                            <td className="p-0 sticky left-0 z-30 bg-inherit border-r border-gray-200 dark:border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                <div className="px-3 py-3 flex items-center gap-3 h-full">
                                    <input 
                                        type="checkbox"
                                        checked={!unselectedForPrint.has(emp.id)}
                                        onChange={(e) => {
                                            const newSet = new Set(unselectedForPrint);
                                            if (e.target.checked) {
                                                newSet.delete(emp.id);
                                            } else {
                                                newSet.add(emp.id);
                                            }
                                            setUnselectedForPrint(newSet);
                                        }}
                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <div className="flex flex-col justify-center overflow-hidden">
                                        <span className="font-bold text-slate-950 dark:text-white uppercase truncate w-48 block">{emp.name}</span>
                                        <span className="text-[10px] text-gray-500 dark:text-slate-400 font-semibold">{emp.role}</span>
                                    </div>
                                </div>
                            </td>

                            {sortedMonths.map(mKey => {
                                const eligible = isEligibleForMonth(emp, mKey);
                                if (!eligible) {
                                    return <td key={mKey} className="p-2 border-r border-gray-200 dark:border-slate-800 text-center bg-gray-100 dark:bg-slate-950/50"><span className="text-gray-300">-</span></td>;
                                }

                                const gross = salariesData[mKey]?.[emp.id]?.gross || 0;
                                const vaAvailable = salariesData[mKey]?.[emp.id]?.va || 0;
                                const arrearKey = `${emp.id}_${mKey}`;
                                const selected = arrearsMap[arrearKey] || 0;
                                const isFgtsSelected = arrearsFgtsMap[arrearKey] || false;
                                const isVaSelected = (arrearsVaMap[arrearKey] || false) && vaAvailable > 0;
                                const isPaid = arrearsPaidMap[arrearKey] || false;
                                const va = isVaSelected ? vaAvailable : 0;
                                const net = (salariesData[mKey]?.[emp.id]?.net || 0) + va;

                                const isTermination = mKey.endsWith('-R');
                                const cellData = salariesData[mKey]?.[emp.id];
                                const extras = getTerminationExtras(mKey, emp.id, arrearKey);
                                const fineValue = (gross + va) * (selected / 100);
                                const fgtsValue = isFgtsSelected ? getFgtsValue(mKey, emp.id, gross) : 0;
                                const is13th = mKey.includes('-13-');
                                const isVacation = mKey.endsWith('-V');
                                const hasDebt = selected > 0 || isFgtsSelected || isVaSelected || extras.total > 0;
                                const breachValue = getBreachValue(mKey);

                                let cellBg = '';
                                if (isPaid) cellBg = 'bg-emerald-100 dark:bg-emerald-900/30';
                                else if (hasDebt) cellBg = 'bg-red-50 dark:bg-red-900/10';
                                else if (isVacation) cellBg = 'bg-orange-50 dark:bg-orange-900/10';
                                else if (is13th) cellBg = 'bg-indigo-50 dark:bg-indigo-900/10';
                                else if (isTermination) cellBg = 'bg-rose-50 dark:bg-rose-900/10';

                                return (
                                    <td key={mKey} className={`p-2 border-r border-gray-200 dark:border-slate-800 text-center align-top ${cellBg}`}>
                                        <div className="flex flex-col gap-2 items-center">
                                            <div className="flex flex-col items-center">
                                                <div className="text-[10px] text-gray-400 dark:text-slate-500">{isTermination ? 'Total verbas' : 'Bruto'}: {formatCurrency(gross)}</div>
                                                {va > 0 && <div className="text-[10px] font-semibold text-teal-600 dark:text-teal-400">VA: {formatCurrency(va)}</div>}
                                                <div className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">Líq: {formatCurrency(net)}</div>
                                            </div>
                                            
                                            {isPaid ? (
                                                <div className="flex flex-col items-center gap-1 w-full animate-in zoom-in duration-200">
                                                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider border border-emerald-200 bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded">Quitado</span>
                                                    <div className="flex flex-col text-xs opacity-75">
                                                        {selected > 0 && <span className="font-bold text-emerald-700 dark:text-emerald-500">+ {formatCurrency(fineValue)}</span>}
                                                        {isFgtsSelected && <span className="font-medium text-emerald-600 dark:text-emerald-400 text-[10px]">FGTS: {formatCurrency(fgtsValue)}</span>}
                                                        {extras.fineFgts40 > 0 && <span className="font-medium text-emerald-600 dark:text-emerald-400 text-[10px]">FGTS 40%: {formatCurrency(extras.fineFgts40)}</span>}
                                                        {hasDebt && breachValue > 0 && <span className="font-medium text-emerald-600 dark:text-emerald-400 text-[10px]">CCT: {formatCurrency(breachValue)}</span>}
                                                    </div>
                                                    <button 
                                                        onClick={() => onUpdateArrearPaid(arrearKey, false)}
                                                        className="mt-1 text-[9px] text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                                                        title="Reabrir Cobrança"
                                                    >
                                                        <RotateCcw className="w-3 h-3" /> Desfazer
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex bg-gray-200 dark:bg-slate-700 rounded p-0.5 gap-0.5">
                                                        <button onClick={() => onUpdateArrear(arrearKey, 0)} className={`px-2 py-1 rounded text-[10px] font-bold ${selected === 0 ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-800'}`}>OK</button>
                                                        <button onClick={() => onUpdateArrear(arrearKey, 10)} className={`px-2 py-1 rounded text-[10px] font-bold ${selected === 10 ? 'bg-yellow-500 text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-yellow-600'}`}>10%</button>
                                                        <button onClick={() => onUpdateArrear(arrearKey, 20)} className={`px-2 py-1 rounded text-[10px] font-bold ${selected === 20 ? 'bg-red-600 text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-red-600'}`}>20%</button>
                                                        <button onClick={() => onUpdateArrearFgts(arrearKey, !isFgtsSelected)} className={`px-2 py-1 rounded text-[10px] font-bold ${isFgtsSelected ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-blue-600'}`}>FGTS</button>
                                                        {vaAvailable > 0 && (
                                                            <button onClick={() => onUpdateArrearVa(arrearKey, !isVaSelected)} title={`Vale alimentação: ${formatCurrency(vaAvailable)}`} className={`px-2 py-1 rounded text-[10px] font-bold ${isVaSelected ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-teal-600'}`}>VA</button>
                                                        )}
                                                    </div>
                                                    {isTermination && (cellData?.fgtsRate || 0) > 0 && (
                                                        <div className="flex bg-gray-200 dark:bg-slate-700 rounded p-0.5 gap-0.5">
                                                            <button
                                                                onClick={() => onUpdateArrearVa(`${arrearKey}${TERMINATION_EXTRA_FGTS40}`, !arrearsVaMap[`${arrearKey}${TERMINATION_EXTRA_FGTS40}`])}
                                                                title={`Multa de ${((cellData?.fgtsRate || 0) * 100).toFixed(0)}% do FGTS: ${formatCurrency(((cellData?.fgtsBase || 0) + getFgtsArrearsCharges(emp.id)) * (cellData?.fgtsRate || 0))} (8% dos brutos de cada mês + FGTS da rescisão + encargos dos atrasos)`}
                                                                className={`px-2 py-1 rounded text-[10px] font-bold ${extras.fineFgts40 > 0 ? 'bg-rose-600 text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-rose-600'}`}>FGTS 40%</button>
                                                        </div>
                                                    )}
                                                    {hasDebt && (
                                                        <div className="flex flex-col text-xs mt-1 w-full">
                                                            {selected > 0 && <span className="font-bold text-red-600 dark:text-red-400">+ {formatCurrency(fineValue)}</span>}
                                                            {extras.fineFgts40 > 0 && <span className="font-medium text-blue-600 dark:text-blue-400 text-[10px]">FGTS 40%: {formatCurrency(extras.fineFgts40)}</span>}
                                                            {isFgtsSelected && <span className="font-medium text-blue-600 dark:text-blue-400 text-[10px]">FGTS: {formatCurrency(fgtsValue)}</span>}
                                                            {breachValue > 0 && <span className="font-medium text-purple-600 dark:text-purple-400 text-[10px]">CCT: {formatCurrency(breachValue)}</span>}

                                                            <button
                                                                onClick={() => onUpdateArrearPaid(arrearKey, true)}
                                                                className="mt-2 w-full py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shadow-sm flex items-center justify-center gap-1 transition-all active:scale-95"
                                                                title="Dar Baixa (Quitar)"
                                                            >
                                                                <CheckCircle className="w-3 h-3" /> Dar Baixa
                                                            </button>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                );
                            })}

                            <td className="p-3 sticky right-0 z-30 bg-inherit border-l border-gray-200 dark:border-slate-800 text-right shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                <div className="flex flex-col gap-1 items-end">
                                    <div className="flex justify-between w-full text-[10px] text-gray-500 dark:text-slate-400">
                                        <span>Multa:</span>
                                        <span className="font-bold text-red-600 dark:text-red-400">{formatCurrency(empTotal.finePending)}</span>
                                    </div>
                                    <div className="flex justify-between w-full text-[10px] text-gray-500 dark:text-slate-400">
                                        <span>FGTS:</span>
                                        <span className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(empTotal.fgtsPending)}</span>
                                    </div>
                                    <div className="flex justify-between w-full text-[10px] text-gray-500 dark:text-slate-400">
                                        <span>CCT:</span>
                                        <span className="font-bold text-purple-600 dark:text-purple-400">{formatCurrency(empTotal.breachPending)}</span>
                                    </div>
                                    <div className="w-full h-px bg-gray-200 dark:bg-slate-700 my-0.5"></div>
                                    <div className="font-black text-slate-950 dark:text-white text-sm">
                                        {formatCurrency(empTotal.finePending + empTotal.fgtsPending + empTotal.breachPending)}
                                    </div>
                                    {/* Optional: Show Paid amount for reference */}
                                    {(empTotal.finePaid + empTotal.fgtsPaid + empTotal.breachPaid) > 0 && (
                                        <div className="mt-2 pt-2 border-t border-dashed border-gray-300 w-full text-[9px] text-emerald-600 dark:text-emerald-500 text-right">
                                            Quitado: {formatCurrency(empTotal.finePaid + empTotal.fgtsPaid + empTotal.breachPaid)}
                                        </div>
                                    )}
                                </div>
                            </td>
                        </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    </div>

    {/* Impressão */}
    <div id="arrears-printable" className="hidden print:block w-full bg-white text-black p-8 font-sans">
        {/* Tabela de cada tripulante pode quebrar entre páginas (evita página em branco antes do 1º nome); linhas e cabeçalho do nome não se partem */}
        <style>{`@page { size: A4 portrait; margin: 8mm; } @media print { #arrears-printable { padding: 0 !important; max-width: none !important; width: 100% !important; } #arrears-printable .emp-block { padding: 8px !important; box-shadow: none !important; } #arrears-printable table { width: 100%; table-layout: auto; font-size: 9.5px; } #arrears-printable th, #arrears-printable td { padding: 2px 4px !important; } #arrears-printable tbody td:first-child { white-space: nowrap; } #arrears-printable tr { break-inside: avoid; } #arrears-printable thead { display: table-header-group; } #arrears-printable .emp-name { break-after: avoid; } #arrears-printable .emp-block + .emp-block { break-before: page; } }`}</style>
        <div className="text-center border-b-2 border-black pb-4 mb-6">
            <h1 className="text-2xl font-bold uppercase">Relatório de Cálculo de Atrasados</h1>
            <p className="text-sm text-gray-600">Referência: CCT 24-25 / CCT 25-26 (Multas + FGTS)</p>
            <p className="text-xs mt-1">Data de Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
        </div>
        <div className="space-y-8">
            {selectedEmployees.map((emp) => {
                const totalEmp = employeeTotals[emp.id];
                // Show if there is ANY activity (Pending OR Paid)
                const hasActivity = (totalEmp.finePending + totalEmp.fgtsPending + totalEmp.finePaid + totalEmp.fgtsPaid + totalEmp.breachPending + totalEmp.breachPaid + totalEmp.netTotal) > 0;
                if (!totalEmp || !hasActivity) return null;
                
                return (
                    <div key={emp.id} className="emp-block border border-gray-300 rounded p-4 shadow-sm mb-4">
                        <div className="emp-name flex justify-between items-center mb-3 bg-gray-100 p-2 rounded">
                            <span className="font-bold text-lg uppercase">{emp.name}</span>
                            <span className="text-sm font-semibold">{emp.role}</span>
                        </div>
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="border-b border-black text-left">
                                    <th className="py-1 px-2">Competência</th>
                                    <th className="py-1 px-2 text-right">Base Bruta</th>
                                    <th className="py-1 px-2 text-right">Base Líquida</th>
                                    <th className="py-1 px-2 text-center">5.1 CCT</th>
                                    <th className="py-1 px-2 text-right">Valor Multa</th>
                                    <th className="py-1 px-2 text-right">2.4 CCT</th>
                                    <th className="py-1 px-2 text-right">5.3 CCT</th>
                                    <th className="py-1 px-2 text-right">FGTS (8% + multa 40%)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedMonths.map(mKey => {
                                    const arrearKey = `${emp.id}_${mKey}`;
                                    const percentage = arrearsMap[arrearKey] || 0;
                                    const fgtsSelected = arrearsFgtsMap[arrearKey] || false;
                                    const isPaid = arrearsPaidMap[arrearKey] || false;
                                    const vaSelectedPrint = arrearsVaMap[arrearKey] || false;

                                    const extrasPrint = getTerminationExtras(mKey, emp.id, arrearKey);

                                    if (percentage === 0 && !fgtsSelected && !vaSelectedPrint && extrasPrint.total === 0) return null;

                                    const gross = salariesData[mKey]?.[emp.id]?.gross || 0;
                                    const vaPrint = vaSelectedPrint ? (salariesData[mKey]?.[emp.id]?.va || 0) : 0;
                                    const net = (salariesData[mKey]?.[emp.id]?.net || 0) + vaPrint;
                                    const fineValue = (gross + vaPrint) * (percentage / 100);
                                    const fgtsValue = fgtsSelected ? getFgtsValue(mKey, emp.id, gross) : 0;
                                    const is13th = mKey.includes('-13-');
                                    const isVacation = mKey.endsWith('-V');
                                    const isTerminationRow = mKey.endsWith('-R');

                                    let rowBg = isPaid ? 'bg-emerald-50' : '';
                                    if (!isPaid) {
                                        if (isVacation) rowBg = 'bg-orange-50';
                                        else if (is13th) rowBg = 'bg-indigo-50';
                                        else if (isTerminationRow) rowBg = 'bg-rose-50';
                                    }
                                    
                                    return (
                                        <tr key={mKey} className={`border-b border-gray-100 ${rowBg}`}>
                                            <td className="py-1 px-2">{getMonthName(mKey)}</td>
                                            <td className="py-1 px-2 text-right text-gray-600">{formatCurrency(gross)}</td>
                                            <td className="py-1 px-2 text-right text-gray-800 font-semibold">{formatCurrency(net)}</td>
                                            <td className="py-1 px-2 text-center font-bold">
                                                {isPaid ? <span className="text-emerald-700 text-xs border border-emerald-500 px-1 rounded">QUITADO</span> : (percentage > 0 ? `${percentage}%` : '-')}
                                            </td>
                                            <td className={`py-1 px-2 text-right font-bold ${isPaid ? 'text-gray-400 line-through' : 'text-red-700'}`}>
                                                {fineValue > 0 ? formatCurrency(fineValue) : '-'}
                                            </td>
                                            <td className={`py-1 px-2 text-right font-bold ${isPaid ? 'text-gray-400 line-through' : 'text-teal-700'}`}>{vaPrint > 0 ? formatCurrency(vaPrint) : '-'}</td>
                                            <td className={`py-1 px-2 text-right font-bold ${isPaid ? 'text-gray-400 line-through' : 'text-purple-700'}`}>{getBreachValue(mKey) > 0 ? formatCurrency(getBreachValue(mKey)) : '-'}</td>
                                            <td className={`py-1 px-2 text-right font-bold ${isPaid ? 'text-gray-400 line-through' : 'text-blue-700'}`}>
                                                {(fgtsValue + extrasPrint.fineFgts40) > 0 ? formatCurrency(fgtsValue + extrasPrint.fineFgts40) : '-'}
                                                {extrasPrint.fineFgts40 > 0 && <div className="text-[9px] font-normal">inclui FGTS 40%: {formatCurrency(extrasPrint.fineFgts40)}</div>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="border-t border-black">
                                    <td className="py-2 px-2 text-left font-bold uppercase">Total Pendente:</td>
                                    <td className="py-2 px-2 text-right font-black">{formatCurrency(totalEmp.grossTotal)}</td>
                                    <td className="py-2 px-2 text-right font-black">{formatCurrency(totalEmp.netTotal)}</td>
                                    <td className="py-2 px-2 text-center">-</td>
                                    <td className="py-2 px-2 text-right font-black">{formatCurrency(totalEmp.finePending)}</td>
                                    <td className="py-2 px-2 text-right font-black">{formatCurrency(sortedMonths.reduce((acc, mKey) => (arrearsVaMap[`${emp.id}_${mKey}`] && isEligibleForMonth(emp, mKey)) ? acc + (salariesData[mKey]?.[emp.id]?.va || 0) : acc, 0))}</td>
                                    <td className="py-2 px-2 text-right font-black">{formatCurrency(totalEmp.breachPending)}</td>
                                    <td className="py-2 px-2 text-right font-black">{formatCurrency(totalEmp.fgtsPending)}</td>
                                </tr>
                                {(totalEmp.finePaid + totalEmp.fgtsPaid + totalEmp.breachPaid) > 0 && (
                                    <tr className="text-emerald-700">
                                        <td colSpan={4} className="py-1 px-2 text-right font-bold uppercase text-xs">Total Quitado:</td>
                                        <td className="py-1 px-2 text-right font-bold text-xs">{formatCurrency(totalEmp.finePaid)}</td>
                                        <td className="py-1 px-2"></td>
                                        <td className="py-1 px-2 text-right font-bold text-xs">{formatCurrency(totalEmp.breachPaid)}</td>
                                        <td className="py-1 px-2 text-right font-bold text-xs">{formatCurrency(totalEmp.fgtsPaid)}</td>
                                    </tr>
                                )}
                                <tr className="bg-gray-50">
                                    <td colSpan={7} className="py-2 px-2 text-right font-bold uppercase">Total Geral Devido:</td>
                                    <td className="py-2 px-2 text-right font-black text-lg">{formatCurrency(totalEmp.netTotal + totalEmp.finePending + totalEmp.fgtsPending + totalEmp.breachPending)}</td>
                                </tr>
                            </tfoot>
                        </table>

                        {/* Detalhamento da rescisão em atraso: verbas, descontos e o que é devido pelo atraso */}
                        {sortedMonths.filter(k => k.endsWith('-R')).map(mKey => {
                            const cell = salariesData[mKey]?.[emp.id];
                            if (!cell?.termination || !isEligibleForMonth(emp, mKey)) return null;
                            const arrearKey = `${emp.id}_${mKey}`;
                            const percentage = arrearsMap[arrearKey] || 0;
                            const fgtsSelected = arrearsFgtsMap[arrearKey] || false;
                            const extras = getTerminationExtras(mKey, emp.id, arrearKey);
                            if (percentage === 0 && !fgtsSelected && extras.total === 0) return null;

                            const isPaid = arrearsPaidMap[arrearKey] || false;
                            const fineValue = cell.gross * (percentage / 100);
                            const fgtsValue = fgtsSelected ? getFgtsValue(mKey, emp.id, cell.gross) : 0;
                            const breach = getBreachValue(mKey);
                            const totalLate = fineValue + extras.total + fgtsValue + breach;

                            return (
                                <div key={`term-${mKey}`} className="mt-4 break-inside-avoid border border-rose-300 rounded p-3 bg-rose-50/40">
                                    <div className="font-bold uppercase text-sm mb-2">{getMonthName(mKey)} — Verbas rescisórias {isPaid && <span className="text-emerald-700 text-xs border border-emerald-500 px-1 rounded ml-2">QUITADO</span>}</div>
                                    <table className="w-full text-xs border-collapse">
                                        <tbody>
                                            {cell.termination.earnings.map((e, i) => (
                                                <tr key={`e-${i}`} className="border-b border-gray-100"><td className="py-0.5 px-2 uppercase">{e.description}</td><td className="py-0.5 px-2 text-right">{formatCurrency(e.total)}</td></tr>
                                            ))}
                                            {cell.termination.nonTaxable.map((e, i) => (
                                                <tr key={`n-${i}`} className="border-b border-gray-100"><td className="py-0.5 px-2 uppercase">{e.description} <span className="text-[9px] text-gray-500">(indenizatória)</span></td><td className="py-0.5 px-2 text-right">{formatCurrency(e.total)}</td></tr>
                                            ))}
                                            <tr className="font-bold bg-gray-100"><td className="py-1 px-2 uppercase">Total das verbas</td><td className="py-1 px-2 text-right">{formatCurrency(cell.gross)}</td></tr>
                                            {cell.termination.deductions.map((d, i) => (
                                                <tr key={`d-${i}`} className="border-b border-gray-100 text-red-700"><td className="py-0.5 px-2 uppercase">(-) {d.description}</td><td className="py-0.5 px-2 text-right">{formatCurrency(d.total)}</td></tr>
                                            ))}
                                            <tr className="font-black bg-gray-100"><td className="py-1 px-2 uppercase">Líquido da rescisão</td><td className="py-1 px-2 text-right">{formatCurrency(cell.net)}</td></tr>
                                            <tr><td colSpan={2} className="pt-2 px-2 font-bold uppercase text-[10px] text-rose-800">Devido pelo atraso</td></tr>
                                            {percentage > 0 && <tr><td className="py-0.5 px-2 uppercase">Multa CCT {percentage}% s/ total das verbas</td><td className="py-0.5 px-2 text-right font-bold text-red-700">{formatCurrency(fineValue)}</td></tr>}
                                            {extras.fineFgts40 > 0 && <tr><td className="py-0.5 px-2 uppercase">Multa 40% do FGTS (saldo acumulado + rescisão)</td><td className="py-0.5 px-2 text-right font-bold text-red-700">{formatCurrency(extras.fineFgts40)}</td></tr>}
                                            {fgtsSelected && <tr><td className="py-0.5 px-2 uppercase">FGTS da rescisão (8%)</td><td className="py-0.5 px-2 text-right font-bold text-blue-700">{formatCurrency(fgtsValue)}</td></tr>}
                                            {breach > 0 && <tr><td className="py-0.5 px-2 uppercase">Descumprimento CCT</td><td className="py-0.5 px-2 text-right font-bold text-purple-700">{formatCurrency(breach)}</td></tr>}
                                            <tr className="font-black border-t border-black"><td className="py-1 px-2 uppercase">Total devido pelo atraso <span className="text-[9px] font-normal normal-case">(= colunas Valor Multa + 5.3 CCT + FGTS da linha acima)</span></td><td className="py-1 px-2 text-right">{formatCurrency(totalLate)}</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}
                    </div>
                );
            })}
        </div>
        <div className="mt-10 border-t-4 border-black pt-4 break-inside-avoid">
            <div className="flex justify-between items-center mb-2">
                <span className="text-xl font-bold uppercase text-gray-700">Total Geral Base Bruta:</span>
                <span className="text-2xl font-black">{formatCurrency(grandTotalGross)}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
                <span className="text-xl font-bold uppercase text-gray-700">Total Geral Base Líquida:</span>
                <span className="text-2xl font-black">{formatCurrency(grandTotalNet)}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
                <span className="text-xl font-bold uppercase text-gray-700">Total Geral Multas (Pendente):</span>
                <span className="text-2xl font-black">{formatCurrency(grandTotalFinePending)}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
                <span className="text-xl font-bold uppercase text-gray-700">Total Geral FGTS (Pendente):</span>
                <span className="text-2xl font-black">{formatCurrency(grandTotalFgtsPending)}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
                <span className="text-xl font-bold uppercase text-gray-700">Total Geral Descumprimento CCT (Pendente):</span>
                <span className="text-2xl font-black">{formatCurrency(grandTotalBreachPending)}</span>
            </div>
            <div className="flex justify-between items-center border-t border-gray-300 pt-2">
                <span className="text-2xl font-black uppercase">Total Geral Devido:</span>
                <span className="text-4xl font-black">{formatCurrency(grandTotalNet + grandTotalFinePending + grandTotalFgtsPending + grandTotalBreachPending)}</span>
            </div>
        </div>
    </div>
    </>
  );
};

export default ArrearsTable;
