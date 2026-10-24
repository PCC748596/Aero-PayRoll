
import React, { useState, useEffect, useMemo } from 'react';
import { PayrollResult, Employee, PayrollType, Holiday, VacationRecord, CCTConfigData } from '../types';
import { calculatePayroll, calculateBusinessDays } from '../utils/calculationService';
import { ArrowLeft, Plane, FileText, Calendar, Coins, Calculator, Palmtree, UserX, Printer } from 'lucide-react';
import { generateHourlyRates, getConfigForDate, STANDARD_HOLIDAYS } from '../constants';

interface PayslipProps {
  data: PayrollResult; 
  onBack: () => void;
  currentDate: Date;
  employees: Employee[];
  onSelectEmployee: (id: string) => void;
  history: Record<string, Employee[]>; 
  customHolidays: Holiday[];
  ignoredHolidays: string[];
  cctHistory: CCTConfigData[]; 
  businessDays: number; // New Prop to respect manual override
  hideControls?: boolean; // New prop for Batch Printing
  forcePayrollType?: PayrollType; // Override for Batch Printing
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const AD_FUNCAO_OPTIONS = ['D.OPR', 'D.SAFETY', 'P.CHEFE', 'G.KEEPER', 'D.GERAL', 'ACORDO'];

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

const Payslip: React.FC<PayslipProps> = ({ 
  data: initialData, 
  onBack, 
  currentDate: uiDate, 
  employees, 
  onSelectEmployee,
  history,
  customHolidays,
  ignoredHolidays,
  cctHistory,
  businessDays, // Prop
  hideControls = false,
  forcePayrollType
}) => {
  
  // CRITICAL CHANGE: The selected date (uiDate) represents the PAYMENT MONTH.
  // The COMPETENCE MONTH is (Payment Month - 1).
  const competenceDate = useMemo(() => {
    return new Date(uiDate.getFullYear(), uiDate.getMonth() - 1, 1);
  }, [uiDate]);

  const year = competenceDate.getFullYear();
  const month = competenceDate.getMonth(); 
  const lastDay = new Date(year, month + 1, 0).getDate();
  const startDateStr = `01/${(month + 1).toString().padStart(2, '0')}/${year}`;
  const endDateStr = `${lastDay}/${(month + 1).toString().padStart(2, '0')}/${year}`;
  
  // Payment Date is what is selected in UI
  const paymentDate = new Date(uiDate.getFullYear(), uiDate.getMonth(), 1);
  const paymentMonthName = paymentDate.toLocaleString('pt-BR', { month: 'long' }).toUpperCase();
  const paymentYear = paymentDate.getFullYear();

  // If Competence is Nov (10) or later, it's the start of CCT for next year cycle
  const cctStartYear = month >= 10 ? year : year - 1;
  const cctStr = `${cctStartYear}-${cctStartYear + 1}`;
  const holeriteLabel = `REFERÊNCIA: ${competenceDate.toLocaleString('pt-BR', { month: 'long' }).toUpperCase()}/${competenceDate.getFullYear()}`;

  const isTerminationSettlementMonth = useMemo(() => {
     if (!initialData.employee.resignationDate) return false;
     const [rY, rM] = initialData.employee.resignationDate.split('-').map(Number);
     // Rescisão month logic check against PAYMENT month
     return (uiDate.getFullYear() * 12 + uiDate.getMonth()) === (rY * 12 + (rM - 1) + 2);
  }, [initialData.employee.resignationDate, uiDate]);

  const [activePayrollType, setActivePayrollType] = useState<PayrollType>('MONTHLY');

  useEffect(() => {
    if (forcePayrollType) {
        setActivePayrollType(forcePayrollType);
    } else {
        if (isTerminationSettlementMonth) setActivePayrollType('TERMINATION');
        else setActivePayrollType('MONTHLY');
    }
  }, [competenceDate, initialData.employee.id, isTerminationSettlementMonth, forcePayrollType]);

  const calculationStats = useMemo(() => {
      const empRaw = employees.find(e => e.id === initialData.employee.id) || initialData.employee;
      const currentYear = competenceDate.getFullYear();
      let sumGrossJanNov = 0, countJanNov = 0, sumGrossJanDec = 0, countJanDec = 0;
      // Composição da média do 13º (por verba), para mostrar no contracheque de onde vem a média base
      const compositionNov: Record<string, { total: number, quantity: number }> = {};
      const compositionDec: Record<string, { total: number, quantity: number }> = {};
      const addToComposition = (target: Record<string, { total: number, quantity: number }>, item: { description: string, total: number, quantity?: number }) => {
          if (!item.total) return;
          const desc = item.description.startsWith('Salário Base') ? 'Salário Base' : item.description;
          if (!target[desc]) target[desc] = { total: 0, quantity: 0 };
          target[desc].total += item.total;
          target[desc].quantity += item.quantity || 0;
      };

      for (let m = 0; m < 12; m++) {
          const mKey = `${currentYear}-${m}`;
          const paymentM = m + 1;
          const paymentY = paymentM > 11 ? currentYear + 1 : currentYear;
          const paymentM_normalized = paymentM > 11 ? 0 : paymentM;
          
          const histKey = `${paymentY}-${paymentM_normalized}`;
          const histEmps = history[histKey];
          const empInMonth = (histKey === `${uiDate.getFullYear()}-${uiDate.getMonth()}`) ? empRaw : (histEmps?.find(e => e.id === empRaw.id) || empRaw);
          const activeDaysInMonth = getActiveDaysInMonth(currentYear, m, empRaw.admissionDate, empRaw.resignationDate);
          
          if (empInMonth && activeDaysInMonth >= 15) {
              const hDate = new Date(currentYear, m, 1); // Competence
              const hConfig = getConfigForDate(hDate, cctHistory);
              const hCorrection = hConfig.inpc + (hConfig.otherCorrection || 0);
              const hRates = generateHourlyRates(hConfig.horaVooAnterior, hCorrection, hConfig.simuladorAnterior, hConfig.horaSoloAnterior);
              
              const { businessDays: hBusinessDays } = calculateBusinessDays(currentYear, m, ignoredHolidays, customHolidays);
              
              const hTotalDays = new Date(currentYear, m + 1, 0).getDate();
              // ignoreVacationDeduction: mês de férias entra cheio na média do 13º
              const hResult = calculatePayroll(empInMonth, hBusinessDays, hTotalDays, hConfig, hRates, hConfig.dsrMultiplier || 8, hDate, 'MONTHLY', undefined, undefined, undefined, [], undefined, undefined, undefined, true);

              sumGrossJanDec += hResult.totals.gross;
              countJanDec++;
              hResult.earnings.forEach(item => addToComposition(compositionDec, item));
              if (m <= 10) {
                  sumGrossJanNov += hResult.totals.gross; countJanNov++;
                  hResult.earnings.forEach(item => addToComposition(compositionNov, item));
              }
          }
      }

      let vacationVestingPeriodStr = "", vacationTotalSum = 0;
      let vacationDetailedMap: Record<string, { total: number, quantity: number }> = {};

      const currentVacation = empRaw.vacationHistory?.find(v => {
          const [vY, vM] = v.startDate.split('-').map(Number);
          return vY === uiDate.getFullYear() && (vM - 1) === uiDate.getMonth();
      });

      if (currentVacation) {
          const relevantRecord = currentVacation;
          if (relevantRecord) {
              const [startY, startM] = relevantRecord.periodStart.split('-').map(Number);
              const [endY, endM] = relevantRecord.periodEnd.split('-').map(Number);
              vacationVestingPeriodStr = `${relevantRecord.periodStart.split('-').reverse().join('/')} a ${relevantRecord.periodEnd.split('-').reverse().join('/')}`;
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
                 let empInHist = histEmps?.find(e => e.id === empRaw.id) || (histKey === `${uiDate.getFullYear()}-${uiDate.getMonth()}` ? empRaw : null);
                 
                 if (empInHist) {
                     const hConfig = getConfigForDate(iterDate, cctHistory);
                     const hRates = generateHourlyRates(hConfig.horaVooAnterior, hConfig.inpc + (hConfig.otherCorrection || 0), hConfig.simuladorAnterior, hConfig.horaSoloAnterior);
                     
                     const { businessDays: hBusinessDays } = calculateBusinessDays(iYear, iMonth, ignoredHolidays, customHolidays);
                     
                     const hTotalDays = new Date(iYear, iMonth + 1, 0).getDate();
                     const hResult = calculatePayroll(empInHist, hBusinessDays, hTotalDays, hConfig, hRates, hConfig.dsrMultiplier || 8, iterDate, 'MONTHLY');
                     hResult.earnings.forEach(item => {
                         if (item.isVariable && item.description !== 'Periculosidade' && item.description !== 'DSR') {
                             let desc = item.description.replace(' (Prop.)', '');
                             if (AD_FUNCAO_OPTIONS.includes(desc) || desc === 'AD.FUNÇÃO') desc = 'AD.FUNÇÃO';
                             if (vacationDetailedMap[desc] === undefined) vacationDetailedMap[desc] = { total: 0, quantity: 0 };
                             vacationDetailedMap[desc].total += item.total;
                             if (item.quantity) vacationDetailedMap[desc].quantity += item.quantity;
                             vacationTotalSum += item.total;
                         }
                     });
                 }
                 iterDate.setMonth(iterDate.getMonth() + 1); safety++;
             }
         }
      }

      return { 
          sumGrossJanNov, countJanNov, sumGrossJanDec, countJanDec,
          compositionNov, compositionDec,
          first13rdAverage: countJanNov > 0 ? sumGrossJanNov / countJanNov : 0, 
          annualGrossAverage: countJanDec > 0 ? sumGrossJanDec / countJanDec : 0, 
          vacationVariableAverage: vacationTotalSum / 12, 
          vacationDetailedAverages: Object.keys(vacationDetailedMap).map(key => ({ description: key, total: vacationDetailedMap[key].total / 12, quantity: vacationDetailedMap[key].quantity / 12 })),
          vacationVestingPeriodStr 
      };
  }, [competenceDate, employees, history, initialData.employee.id, cctHistory, ignoredHolidays, customHolidays, uiDate]);

  const displayData = useMemo(() => {
      const calculationDate = activePayrollType === 'VACATION' ? uiDate : competenceDate;
      const config = getConfigForDate(calculationDate, cctHistory);
      const totalCorrection = config.inpc + (config.otherCorrection || 0);
      const hourlyRates = generateHourlyRates(config.horaVooAnterior, totalCorrection, config.simuladorAnterior, config.horaSoloAnterior);
      
      const totalDays = new Date(calculationDate.getFullYear(), calculationDate.getMonth() + 1, 0).getDate();
      let empRaw = employees.find(e => e.id === initialData.employee.id) || initialData.employee;

      const advanceValue = (activePayrollType === '13_2ND') ? (calculationStats.first13rdAverage * calculationStats.countJanDec / 12) / 2 : undefined;
      const effectiveDsrMultiplier = config.dsrMultiplier || 8;

      // --- FIX FOR TERMINATION SUMMING PREVIOUS MONTH IN PAYSLIP VIEW ---
      let previousMonthEmployee = undefined;
      if (activePayrollType === 'TERMINATION' && empRaw.resignationDate) {
          const [rY, rM] = empRaw.resignationDate.split('-').map(Number);
          const currentAbs = uiDate.getFullYear() * 12 + uiDate.getMonth();
          const resAbs = rY * 12 + (rM - 1);
          
          if (currentAbs === resAbs + 2) {
              const prevMonthDate = new Date(uiDate.getFullYear(), uiDate.getMonth() - 1, 1);
              const prevKey = `${prevMonthDate.getFullYear()}-${prevMonthDate.getMonth()}`;
              const prevHistoryList = history[prevKey];
              previousMonthEmployee = prevHistoryList?.find(e => e.id === empRaw.id);
          }
      }
      // ------------------------------------------------------------------

      return calculatePayroll(
          empRaw, businessDays, totalDays, config, hourlyRates, effectiveDsrMultiplier, 
          activePayrollType === 'VACATION' ? uiDate : competenceDate, 
          activePayrollType,
          advanceValue, calculationStats.first13rdAverage, calculationStats.annualGrossAverage, ignoredHolidays,
          calculationStats.vacationDetailedAverages, undefined, previousMonthEmployee
      );
  }, [activePayrollType, initialData, competenceDate, employees, year, month, calculationStats, ignoredHolidays, isTerminationSettlementMonth, history, cctHistory, businessDays, uiDate]);

  const isPaymentNov = uiDate.getMonth() === 10; 
  const isPaymentDec = uiDate.getMonth() === 11;

  const hasVacationStartingInCurrentMonth = useMemo(() => {
      const empRaw = employees.find(e => e.id === initialData.employee.id) || initialData.employee;
      return empRaw.vacationHistory?.some(v => {
          const [vY, vM] = v.startDate.split('-').map(Number);
          return vY === uiDate.getFullYear() && (vM - 1) === uiDate.getMonth();
      });
  }, [employees, initialData.employee.id, uiDate]);
  
  const getTitle = () => {
      if (activePayrollType === '13_1ST') return `13º SALÁRIO - 1ª PARCELA - NOV/${paymentYear}`;
      if (activePayrollType === '13_2ND') return `13º SALÁRIO - 2ª PARCELA - DEZ/${paymentYear}`;
      if (activePayrollType === 'VACATION') return `RECIBO DE FÉRIAS`;
      if (activePayrollType === 'TERMINATION') return `TERMO DE RESCISÃO DO CONTRATO DE TRABALHO`;
      
      return `FOLHA DE PAGAMENTO ${paymentMonthName} / ${paymentYear}`;
  };

  const getHeaderColor = () => {
      if (activePayrollType === '13_1ST') return 'bg-amber-600 print:bg-amber-600';
      if (activePayrollType === '13_2ND') return 'bg-green-600 print:bg-green-600'; 
      if (activePayrollType === 'VACATION') return 'bg-teal-600 print:bg-teal-600';
      if (activePayrollType === 'TERMINATION') return 'bg-red-700 print:bg-red-700';
      return 'bg-green-800 print:bg-green-800';
  }

  const handlePrint = () => {
      window.print();
  };

  return (
    <div className={`flex flex-col items-center print:block print:w-full print:h-auto print:m-0 print:p-0 ${hideControls ? '' : 'pb-10'}`}>
      {!hideControls && (
      <div className="w-full max-w-4xl flex flex-col md:flex-row justify-between mb-6 no-print gap-4 items-center px-4">
        <button type="button" onClick={onBack} className="bg-gray-600 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md transition-all active:scale-95 font-semibold text-sm cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> <span>Voltar ao Painel</span>
        </button>
        <div className="flex items-center gap-3">
            <div className="flex bg-white dark:bg-slate-800 rounded-lg p-1 shadow-sm border border-gray-200 dark:border-slate-700 flex-wrap justify-center gap-1">
                {!isTerminationSettlementMonth && (
                    <button onClick={() => setActivePayrollType('MONTHLY')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-colors ${activePayrollType === 'MONTHLY' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
                        <FileText className="w-4 h-4" /> Folha Mensal
                    </button>
                )}
                {isPaymentNov && (
                    <button onClick={() => setActivePayrollType('13_1ST')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-colors ${activePayrollType === '13_1ST' ? 'bg-amber-500 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
                        <Coins className="w-4 h-4" /> 13º (1ª Parc)
                    </button>
                )}
                {isPaymentDec && (
                    <button onClick={() => setActivePayrollType('13_2ND')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-colors ${activePayrollType === '13_2ND' ? 'bg-green-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
                        <Coins className="w-4 h-4" /> 13º (2ª Parc)
                    </button>
                )}
                {hasVacationStartingInCurrentMonth && (
                    <button onClick={() => setActivePayrollType('VACATION')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-colors ${activePayrollType === 'VACATION' ? 'bg-teal-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
                        <Palmtree className="w-4 h-4" /> Recibo Férias
                    </button>
                )}
                {isTerminationSettlementMonth && (
                    <button onClick={() => setActivePayrollType('TERMINATION')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-colors ${activePayrollType === 'TERMINATION' ? 'bg-red-600 text-white animate-pulse' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
                        <UserX className="w-4 h-4" /> Rescisão
                    </button>
                )}
            </div>
            
            <button onClick={handlePrint} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-md transition-all active:scale-95 font-bold text-sm">
                <Printer className="w-4 h-4" /> <span>Imprimir</span>
            </button>
        </div>
      </div>
      )}

      {/* Payslip Container with adjusted print padding to save space */}
      {/* ADDED: print:p-4 (Reduced padding), print:border-none (Optional clean up) */}
      <div id={hideControls ? undefined : "payslip-to-print"} className={`relative bg-white border border-gray-300 w-full max-w-4xl p-8 shadow-2xl text-slate-950 overflow-hidden ${hideControls ? 'print:border print:border-black print:w-full print:max-w-none print:m-0 print:p-4' : 'print:shadow-none print:border print:border-black print:w-full print:max-w-none print:m-0 print:p-4'}`}>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 opacity-10">
            <div className="transform -rotate-[35deg] flex flex-col items-center text-gray-400">
                <Plane className="w-[450px] h-[450px]" />
                <span className="text-6xl font-black tracking-tighter uppercase whitespace-nowrap mt-4">AeroPayroll Manager</span>
            </div>
        </div>

        <div className="relative z-10">
            {/* ADJUSTED: Font size for print header */}
            <div className="flex justify-between text-[10px] print:text-[9px] font-bold mb-2 text-slate-950 uppercase tracking-wider bg-transparent">
              <div className="flex gap-4">
                  {activePayrollType === 'VACATION' ? (
                      <><span>INÍCIO FÉRIAS: {displayData.employee.vacationStartDate?.split('-').reverse().join('/')}</span><span>DIAS: {displayData.employee.vacationDays}</span></>
                  ) : activePayrollType === 'TERMINATION' ? (
                      <><span>DATA DEMISSÃO: {displayData.employee.resignationDate?.split('-').reverse().join('/')}</span><span>{(displayData.employee.terminationType || 'PEDIDO_TRABALHADO').replace(/_/g, ' ')}</span></>
                  ) : (activePayrollType === '13_1ST' || activePayrollType === '13_2ND') ? (
                      <span>13º SALÁRIO - REFERÊNCIA: ANO {paymentYear}</span>
                  ) : (<><span>DE: {startDateStr}</span><span>ATÉ: {endDateStr}</span></>)}
              </div>
              <div className="flex items-center gap-1 font-bold"><span>AeroPayroll Manager</span><Plane className="w-3 h-3 text-green-800" /></div>
              <div>ADMISSÃO: {displayData.employee.admissionDate?.split('-').reverse().join('/')}</div>
            </div>

            {/* ADJUSTED: Vertical padding for title block */}
            <div className={`text-white text-center font-bold py-2 print:py-1 print:text-[12px] mb-0 border border-black shadow-inner flex flex-col items-center justify-center ${getHeaderColor()}`}>
              <span>{getTitle()}</span>
              {activePayrollType === 'MONTHLY' && (
                  <span className="text-[10px] print:text-[8px] font-normal opacity-90 uppercase tracking-wider border-t border-white/30 pt-0.5 mt-0.5 px-4">
                      {holeriteLabel} - CCT {cctStr}
                  </span>
              )}
            </div>

            <div className="flex border-l border-r border-black bg-gray-100/60 text-slate-950">
              <div className="flex-1 p-2 border-b border-black font-bold text-xs print:text-[10px] flex items-center uppercase">FUNCIONÁRIO:</div>
              <div className="flex-[3] p-2 border-b border-black text-sm print:text-[12px] bg-white/40 relative">
                 <select className={`w-full h-full bg-transparent outline-none cursor-pointer font-bold uppercase text-base ${hideControls ? 'hidden' : 'print:hidden'}`} value={displayData.employee.id} onChange={(e) => onSelectEmployee(e.target.value)}>
                   {employees.map(emp => (<option key={emp.id} value={emp.id}>{emp.name}</option>))}
                 </select>
                 <span className={`${hideControls ? 'block' : 'hidden print:block'} font-bold uppercase`}>{displayData.employee.name}</span>
              </div>
              <div className="flex-1 p-2 border-b border-black font-bold text-xs print:text-[10px] flex items-center justify-end px-2 uppercase">FUNÇÃO:</div>
              <div className="flex-1 p-2 border-b border-black text-sm print:text-[12px] bg-white/40 text-right px-2 flex items-center justify-end font-bold uppercase">{displayData.employee.role}</div>
            </div>

            <div className="grid grid-cols-12 bg-green-700 text-white text-[10px] print:text-[9px] font-bold text-center border-l border-r border-black">
              {/* ADJUSTED: Header padding */}
              <div className="col-span-6 py-1.5 print:py-0.5 border-r border-white/30 uppercase">Base de Cálculo</div>
              <div className="col-span-3 py-1.5 print:py-0.5 border-r border-white/30 uppercase">Valor Unit.</div>
              <div className="col-span-1 py-1.5 print:py-0.5 border-r border-white/30 uppercase">Qtde</div>
              <div className="col-span-2 py-1.5 print:py-0.5 uppercase">Total</div>
            </div>

            <div className="text-[11px] print:text-[9px] border-l border-r border-b border-black text-slate-950 min-h-[300px] print:min-h-[250px]">
              {displayData.earnings.map((item, idx) => (
                <div key={idx} className={`grid grid-cols-12 border-b border-gray-100 ${idx % 2 === 0 ? 'bg-gray-50/30' : 'bg-transparent'}`}>
                  {/* ADJUSTED: Row padding */}
                  <div className="col-span-6 px-3 py-1.5 print:py-0.5 border-r border-gray-100 font-medium truncate uppercase">{item.description}</div>
                  <div className="col-span-3 px-3 py-1.5 print:py-0.5 border-r border-gray-100 text-right">{item.rate ? formatCurrency(item.rate) : ''}</div>
                  <div className="col-span-1 px-3 py-1.5 print:py-0.5 border-r border-gray-100 text-center font-semibold">{item.quantity ? item.quantity.toFixed(2).replace('.', ',') : ''}</div>
                  <div className="col-span-2 px-3 py-1.5 print:py-0.5 text-right font-bold">{formatCurrency(item.total)}</div>
                </div>
              ))}
              {(activePayrollType === '13_1ST' || activePayrollType === '13_2ND') && (() => {
                  const is1st = activePayrollType === '13_1ST';
                  const composition = is1st ? calculationStats.compositionNov : calculationStats.compositionDec;
                  const monthsCount = is1st ? calculationStats.countJanNov : calculationStats.countJanDec;
                  const rows = Object.entries(composition);
                  if (monthsCount === 0 || rows.length === 0) return null;
                  return (
                    <>
                      <div className="grid grid-cols-12 bg-gray-200/60 border-y border-gray-300 text-[9px] font-bold uppercase mt-2">
                        <div className="col-span-12 px-3 py-1 print:py-0.5">Composição da média base — {monthsCount} meses de {competenceDate.getFullYear()} (informativo, já incluído acima)</div>
                      </div>
                      <div className="grid grid-cols-12 text-[9px] font-bold uppercase text-gray-500 border-b border-gray-200">
                        <div className="col-span-6 px-3 py-0.5">Verba</div>
                        <div className="col-span-3 px-3 py-0.5 text-right">Total no período</div>
                        <div className="col-span-1 px-3 py-0.5 text-center">Qtde méd.</div>
                        <div className="col-span-2 px-3 py-0.5 text-right">Média mensal</div>
                      </div>
                      {rows.map(([desc, v]) => (
                        <div key={`comp-${desc}`} className="grid grid-cols-12 border-b border-gray-100 text-gray-700">
                          <div className="col-span-6 px-3 py-1 print:py-0.5 truncate uppercase">{desc}</div>
                          <div className="col-span-3 px-3 py-1 print:py-0.5 text-right">{formatCurrency(v.total)}</div>
                          <div className="col-span-1 px-3 py-1 print:py-0.5 text-center">{v.quantity ? (v.quantity / monthsCount).toFixed(2).replace('.', ',') : ''}</div>
                          <div className="col-span-2 px-3 py-1 print:py-0.5 text-right font-semibold">{formatCurrency(v.total / monthsCount)}</div>
                        </div>
                      ))}
                    </>
                  );
              })()}
              {activePayrollType === 'TERMINATION' && displayData.nonTaxableEarnings.length > 0 && (
                <>
                  <div className="grid grid-cols-12 bg-gray-200/60 border-y border-gray-300 text-[9px] font-bold uppercase">
                    <div className="col-span-12 px-3 py-1 print:py-0.5">Verbas indenizatórias (isentas de IRRF/INSS)</div>
                  </div>
                  {displayData.nonTaxableEarnings.map((item, idx) => (
                    <div key={`nt-${idx}`} className="grid grid-cols-12 border-b border-gray-100">
                      <div className="col-span-6 px-3 py-1.5 print:py-0.5 border-r border-gray-100 font-medium truncate uppercase">{item.description}</div>
                      <div className="col-span-3 px-3 py-1.5 print:py-0.5 border-r border-gray-100"></div>
                      <div className="col-span-1 px-3 py-1.5 print:py-0.5 border-r border-gray-100"></div>
                      <div className="col-span-2 px-3 py-1.5 print:py-0.5 text-right font-bold">{formatCurrency(item.total)}</div>
                    </div>
                  ))}
                </>
              )}
            </div>

            <div className="mt-0 border-l border-r border-b border-black text-slate-950 text-xs print:text-[9px] bg-white/40">
               <div className="grid grid-cols-12 bg-gray-200/60 font-bold border-b border-black">
                 {/* ADJUSTED: Totals padding */}
                 <div className="col-span-10 px-3 py-2 print:py-1 text-right border-r border-black uppercase">{activePayrollType === 'TERMINATION' ? 'Total Geral de Verbas:' : 'Total Vencimentos (Bruto):'}</div>
                 <div className="col-span-2 px-3 py-2 print:py-1 text-right">{formatCurrency(activePayrollType === 'TERMINATION' ? displayData.totals.gross + (displayData.totals.totalNonTaxable || 0) : displayData.totals.gross)}</div>
               </div>
               <div className="grid grid-cols-12 bg-red-800 text-white text-[10px] print:text-[9px] font-bold text-center border-b border-black uppercase">
                 <div className="col-span-10 py-1.5 print:py-0.5 border-r border-white/30">Descontos Legais</div><div className="col-span-2 py-1.5 print:py-0.5">Valor</div>
               </div>
               {displayData.deductions.map((item, idx) => (
                 <div key={idx} className="grid grid-cols-12 border-b border-gray-100 bg-transparent">
                   <div className="col-span-10 px-3 py-2 print:py-0.5 border-r border-gray-100 uppercase font-medium">{item.description} {item.rate ? `(${ (item.rate * 100).toFixed(2) }%)` : ''}</div>
                   <div className="col-span-2 px-3 py-2 print:py-0.5 text-right font-bold text-red-700">{formatCurrency(item.total)}</div>
                 </div>
               ))}
               <div className="grid grid-cols-12 bg-gray-50/60 font-bold border-b border-black">
                 <div className="col-span-10 px-3 py-2 print:py-1 text-right border-r border-black uppercase">Total Descontos:</div>
                 <div className="col-span-2 px-3 py-2 print:py-1 text-right text-red-700">{formatCurrency(displayData.totals.totalDeductions)}</div>
               </div>
               <div className="grid grid-cols-12 bg-green-900 text-white font-black text-lg print:text-base border-b border-black">
                 <div className="col-span-10 px-3 py-4 print:py-2 text-right border-r border-white/20 uppercase tracking-widest">Líquido a Receber:</div>
                 <div className="col-span-2 px-3 py-4 print:py-2 text-right flex items-center justify-end">{formatCurrency(displayData.totals.net)}</div>
               </div>

               {(activePayrollType === '13_1ST' || activePayrollType === '13_2ND') && (
                 <div className="grid grid-cols-4 bg-yellow-50/80 text-[10px] print:text-[8px] border-b border-black text-slate-900">
                    <div className="p-2 border-r border-black col-span-4 bg-yellow-100 font-bold flex items-center gap-2"><Calculator className="w-3 h-3" /> MEMÓRIA DE CÁLCULO DO 13º SALÁRIO</div>
                    <div className="p-2 border-r border-black"><div className="uppercase text-[8px] font-bold text-gray-600">Média Base</div><div className="font-bold">{formatCurrency(activePayrollType === '13_1ST' ? calculationStats.first13rdAverage : calculationStats.annualGrossAverage)}</div></div>
                    <div className="p-2 border-r border-black"><div className="uppercase text-[8px] font-bold text-gray-600">Meses Elegíveis</div><div className="font-bold">{activePayrollType === '13_1ST' ? calculationStats.countJanNov : calculationStats.countJanDec}</div></div>
                    <div className="p-2 border-r border-black"><div className="uppercase text-[8px] font-bold text-gray-600">Avos Calculados</div><div className="font-bold">{displayData.metadata.monthsWorked13th}/12 AVOS</div></div>
                    <div className="p-2"><div className="uppercase text-[8px] font-bold text-gray-600">Valor Proporcional</div><div className="font-bold">{formatCurrency((activePayrollType === '13_1ST' ? calculationStats.first13rdAverage : calculationStats.annualGrossAverage) * (displayData.metadata.monthsWorked13th || 0) / 12)}</div></div>
                 </div>
               )}

               <div className="grid grid-cols-4 bg-gray-100/80 text-sm print:text-[11px] font-bold uppercase">
                 <div className="p-2 border-r border-black"><div className="text-gray-500 text-[11px] print:text-[9px]">Base FGTS</div><div>{formatCurrency(activePayrollType === '13_2ND' ? displayData.totals.gross - (displayData.deductions.find(d => d.description.includes('ADIANTAMENTO'))?.total || 0) : displayData.totals.gross)}</div></div>
                 <div className="p-2 border-r border-black"><div className="text-gray-500 text-[11px] print:text-[9px]">FGTS do Mês</div><div className="text-blue-700">{formatCurrency(displayData.totals.fgts)}</div></div>
                 <div className="p-2 border-r border-black"><div className="text-gray-500 text-[11px] print:text-[9px]">Base IRRF</div><div>{formatCurrency(activePayrollType === '13_1ST' ? 0 : displayData.totals.gross - (displayData.deductions.find(d => d.description.includes('INSS'))?.total || 0))}</div></div>
                 <div className="p-2"><div className="text-gray-500 text-[11px] print:text-[9px]">Base INSS</div><div>{formatCurrency(activePayrollType === '13_1ST' ? 0 : displayData.totals.gross)}</div></div>
               </div>
            </div>

            {/* ADJUSTED: Signature margin */}
            <div className={`mt-12 print:mt-4 flex justify-between items-end px-10 ${hideControls ? '' : 'no-print-flex'}`}>
               <div className="flex flex-col items-center">
                  <div className="w-64 border-t border-black mb-1"></div>
                  <div className="text-[10px] print:text-[8px] uppercase font-bold text-gray-500">Assinatura do Funcionário</div>
               </div>
               <div className="text-right flex flex-col items-end">
                  <div className="flex items-center gap-1 text-[10px] text-gray-500 font-bold uppercase"><span>AeroPayroll Manager</span><Plane className="w-3 h-3 text-gray-400" /></div>
                  <p className="text-[9px] text-gray-400 italic">Gerado eletronicamente em {new Date().toLocaleString('pt-BR')}</p>
               </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Payslip;
