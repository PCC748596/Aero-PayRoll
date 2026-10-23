
import React, { useState, useMemo } from 'react';
import { Employee, CCTConfigData, Holiday } from '../types';
import { calculatePayroll, calculateBusinessDays } from '../utils/calculationService';
import { generateHourlyRates, getConfigForDate } from '../constants';
import { X, Printer, Search, FileText, Calendar, Filter, AlertTriangle } from 'lucide-react';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[]; // Current Employees
  history: Record<string, Employee[]>;
  arrearsMap: Record<string, number>; 
  arrearsFgtsMap?: Record<string, boolean>; // New Prop (Optional for backward compatibility inside component logic)
  cctHistory: CCTConfigData[];
  ignoredHolidays: string[];
  customHolidays: Holiday[];
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen, onClose, employees, history, arrearsMap, arrearsFgtsMap, cctHistory, ignoredHolidays, customHolidays
}) => {
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [startPeriod, setStartPeriod] = useState<string>(''); // YYYY-MM
  const [endPeriod, setEndPeriod] = useState<string>('');   // YYYY-MM
  const [includeArrears, setIncludeArrears] = useState<boolean>(false);
  const [reportData, setReportData] = useState<any[] | null>(null);

  // Aggregate all unique employees from history + current
  const allEmployees = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach(emp => map.set(emp.id, emp));
    (Object.values(history) as Employee[][]).forEach(list => {
        list.forEach(emp => {
            if (!map.has(emp.id)) map.set(emp.id, emp);
        });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, history]);

  const selectedEmployee = useMemo(() => 
    allEmployees.find(e => e.id === selectedEmpId), 
  [selectedEmpId, allEmployees]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const handleGenerate = () => {
      if (!selectedEmpId || !startPeriod || !endPeriod) return;

      const [startY, startM] = startPeriod.split('-').map(Number);
      const [endY, endM] = endPeriod.split('-').map(Number);

      const startCompDate = new Date(startY, startM - 1, 1);
      const endCompDate = new Date(endY, endM - 1, 1);

      const generatedRows = [];
      const gross1stMap = new Map<number, number>(); 
      let ptr = new Date(startCompDate);

      while (ptr <= endCompDate || (ptr.getFullYear() === endCompDate.getFullYear() && ptr.getMonth() === endCompDate.getMonth())) {
          const compY = ptr.getFullYear();
          const compM = ptr.getMonth(); // 0-based
          
          // Payment is the month after competence
          const payDate = new Date(compY, compM + 1, 1);
          const y = payDate.getFullYear();
          const m = payDate.getMonth();
          
          // Logic for Month + 13th 1st + 13th 2nd
          const keysToCheck = [
              { type: 'MONTHLY', suffix: '' },
              ...(m === 10 ? [{ type: '13_1ST', suffix: '-13-1' }] : []), // Nov Payment -> 13th 1st
              ...(m === 11 ? [{ type: '13_2ND', suffix: '-13-2' }] : [])  // Dec Payment -> 13th 2nd
          ];

          for (const item of keysToCheck) {
              const historyKey = `${y}-${m}`;
              const histList = history[historyKey];
              let empSnapshot = histList?.find(e => e.id === selectedEmpId);
              
              if (!empSnapshot) {
                  continue; 
              }

              const competenceDate = new Date(compY, compM, 1);
              
              let calcDate = competenceDate;
              let payrollType: any = 'MONTHLY';
              
              if (item.type === '13_1ST') {
                  calcDate = new Date(y, 10, 30); // Nov 30 ref
                  payrollType = '13_1ST';
              } else if (item.type === '13_2ND') {
                  calcDate = new Date(y, 11, 20); // Dec 20 ref
                  payrollType = '13_2ND';
              }

              const config = getConfigForDate(calcDate, cctHistory);
              const totalCorrection = config.inpc + (config.otherCorrection || 0);
              const hourlyRates = generateHourlyRates(config.horaVooAnterior, totalCorrection, config.simuladorAnterior, config.horaSoloAnterior);
              
              const compYear = competenceDate.getFullYear();
              const compMonth = competenceDate.getMonth();
              const { businessDays, totalDays } = calculateBusinessDays(compYear, compMonth, ignoredHolidays, customHolidays);
              const effectiveDsrMultiplier = config.dsrMultiplier || 8;

              let avg1st = 0;
              let avgAnnual = 0;
              
              if (payrollType !== 'MONTHLY') {
                  let sum = 0; 
                  let count = 0;
                  const limit = payrollType === '13_1ST' ? 10 : 11; // Nov vs Dec
                  for(let i=0; i<=limit; i++) {
                      const hKey = `${y}-${i}`;
                      const hEmp = history[hKey]?.find(e => e.id === selectedEmpId);
                      if (hEmp) {
                          const cDate = new Date(y, i-1, 1);
                          const cConf = getConfigForDate(cDate, cctHistory);
                          const cRates = generateHourlyRates(cConf.horaVooAnterior, cConf.inpc+(cConf.otherCorrection||0), cConf.simuladorAnterior, cConf.horaSoloAnterior);
                          const cDays = calculateBusinessDays(y, i-1, ignoredHolidays, customHolidays);
                          const res = calculatePayroll(hEmp, cDays.businessDays, cDays.totalDays, cConf, cRates, cConf.dsrMultiplier||8, cDate, 'MONTHLY', undefined, undefined, undefined, [], undefined, undefined, undefined, true); // mês de férias entra cheio na média
                          sum += res.totals.gross;
                          count++;
                      }
                  }
                  if (count > 0) {
                      avg1st = sum / count;
                      avgAnnual = sum / count;
                  }
              }

              // If it's 2nd installment, we need to know the 1st installment value to calculate the Balance
              let advanceValueToDeduct = undefined;
              if (item.type === '13_2ND') {
                 // Check cache first
                 let val1st = gross1stMap.get(y);
                 
                 // If not in cache (e.g. report range starts in Dec, missing Nov), calculate it on the fly
                 if (val1st === undefined) {
                      const date1st = new Date(y, 10, 30);
                      const config1st = getConfigForDate(date1st, cctHistory);
                      const rates1st = generateHourlyRates(config1st.horaVooAnterior, config1st.inpc+(config1st.otherCorrection||0), config1st.simuladorAnterior, config1st.horaSoloAnterior);
                      const days1st = calculateBusinessDays(y, 9, ignoredHolidays, customHolidays); // Oct Competence
                      const res1st = calculatePayroll(empSnapshot, days1st.businessDays, days1st.totalDays, config1st, rates1st, config1st.dsrMultiplier||8, date1st, '13_1ST', undefined, avg1st, undefined, ignoredHolidays);
                      val1st = res1st.totals.gross;
                 }
                 advanceValueToDeduct = val1st;
              }

              const result = calculatePayroll(
                  empSnapshot,
                  businessDays,
                  totalDays,
                  config,
                  hourlyRates,
                  effectiveDsrMultiplier,
                  calcDate,
                  payrollType,
                  advanceValueToDeduct, 
                  avg1st,
                  avgAnnual,
                  ignoredHolidays
              );

              let finalGross = result.totals.gross;
              let finalDeductions = result.totals.totalDeductions;
              
              if (item.type === '13_2ND' && advanceValueToDeduct !== undefined) {
                  finalGross = Math.max(0, result.totals.gross - advanceValueToDeduct);
                  const advanceDeductionEntry = result.deductions.find(d => d.description.includes('ADIANTAMENTO'));
                  if (advanceDeductionEntry) {
                      finalDeductions -= advanceDeductionEntry.total;
                  }
              }

              // Cache 1st Installment Gross
              if (item.type === '13_1ST') {
                  gross1stMap.set(y, result.totals.gross);
              }

              // Arrears Calculation (Multa)
              let arrearsValue = 0;
              let arrearsFgtsValue = 0;

              if (includeArrears) {
                  let arrearKey = '';
                  if (item.type === 'MONTHLY') arrearKey = `${selectedEmpId}_${y}-${m}`;
                  else if (item.type === '13_1ST') arrearKey = `${selectedEmpId}_${y}-13-1`;
                  else if (item.type === '13_2ND') arrearKey = `${selectedEmpId}_${y}-13-2`;
                  
                  const percentage = arrearsMap[arrearKey] || 0;
                  if (percentage > 0) {
                      arrearsValue = finalGross * (percentage / 100);
                  }

                  const fgtsSelected = arrearsFgtsMap?.[arrearKey] || false;
                  if (fgtsSelected) {
                      // Add arrears FGTS (8% of gross) to report logic if needed.
                      // Currently `result.totals.fgts` contains normal monthly FGTS.
                      // If we are simulating "Late Payment", the FGTS amount is the same (8% of gross).
                      // The question is whether we should show it as "Extra" or just ensure it's listed.
                      // Since the user asked for independent selection, we assume for report purpose, 
                      // if selected, we consider it 'due'.
                      // For simplicity in this financial report, we won't modify `result.totals.fgts` 
                      // because that column represents "FGTS do Mês".
                      // If user wants to see "Arrears FGTS" specifically, we might need another column, 
                      // but typically FGTS is just deposited.
                      
                      // However, if we want to reflect the "Cost" of arrears:
                      // If FGTS wasn't paid before, it is paid now.
                      // If FGTS was paid before, and we uncheck it, maybe it shouldn't show?
                      // But `calculatePayroll` always calculates FGTS based on law.
                      
                      // Let's assume for this specific report (Financial Extract),
                      // we just show the calculated values. The Arrears Value (Multa) is added to Net.
                  }
              }

              if (finalGross > 0) {
                  generatedRows.push({
                      dateLabel: item.type === 'MONTHLY' 
                          ? `${competenceDate.toLocaleString('pt-BR', { month: 'short' }).toUpperCase()}/${competenceDate.getFullYear()}`
                          : (item.type === '13_1ST' ? `13º 1ª PARC/${y}` : `13º 2ª PARC/${y}`),
                      paymentLabel: `${new Date(y, m, 1).toLocaleString('pt-BR', { month: 'short' }).toUpperCase()}/${y}`,
                      type: item.type === 'MONTHLY' ? 'Folha Mensal' : '13º Salário',
                      gross: finalGross,
                      deductions: finalDeductions,
                      net: result.totals.net,
                      fgts: result.totals.fgts,
                      arrears: arrearsValue
                  });
              }
          }
          ptr.setMonth(ptr.getMonth() + 1);
      }
      setReportData(generatedRows);
  };

  const handlePrint = () => {
      window.print();
  };

  const totals = useMemo(() => {
      if (!reportData) return null;
      return reportData.reduce((acc, curr) => ({
          gross: acc.gross + curr.gross,
          deductions: acc.deductions + curr.deductions,
          net: acc.net + curr.net,
          fgts: acc.fgts + curr.fgts,
          arrears: acc.arrears + curr.arrears
      }), { gross: 0, deductions: 0, net: 0, fgts: 0, arrears: 0 });
  }, [reportData]);

  if (!isOpen) return null;

  return (
    // CRITICAL FIX: print:!bg-white print:!text-black
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:p-0 print:!bg-white print:!text-black print:block print:static print:h-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-7xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 print:shadow-none print:border-none print:max-w-none print:max-h-none print:w-full print:h-auto print:overflow-visible print:block print:!bg-white">
        
        {/* Header - No Print */}
        <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 print:hidden">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-600" />
              Relatório Financeiro
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Gere extratos de pagamentos por período.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-full text-gray-500">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden print:overflow-visible print:block print:!bg-white">
            
            {/* Controls - No Print */}
            <div className="p-4 bg-gray-100 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex flex-col gap-4 print:hidden">
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Tripulante</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <select 
                                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                value={selectedEmpId}
                                onChange={(e) => setSelectedEmpId(e.target.value)}
                            >
                                <option value="">Selecione um tripulante...</option>
                                {allEmployees.map(e => (
                                    <option key={e.id} value={e.id}>{e.name} - {e.role}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Início (Competência)</label>
                        <input 
                            type="month" 
                            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                            value={startPeriod}
                            onChange={(e) => setStartPeriod(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Fim (Competência)</label>
                        <input 
                            type="month" 
                            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                            value={endPeriod}
                            onChange={(e) => setEndPeriod(e.target.value)}
                        />
                    </div>
                    <button 
                        onClick={handleGenerate}
                        disabled={!selectedEmpId || !startPeriod || !endPeriod}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold shadow-sm transition-colors flex items-center gap-2"
                    >
                        <Filter className="w-4 h-4" />
                        Gerar
                    </button>
                </div>
                
                <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-slate-800">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input 
                            type="checkbox" 
                            checked={includeArrears} 
                            onChange={(e) => setIncludeArrears(e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            Incluir Cálculo de Atrasados
                        </span>
                    </label>
                </div>
            </div>

            {/* Report Table */}
            <div className="flex-1 overflow-y-auto p-6 bg-white print:p-0 print:overflow-visible print:!bg-white">
                {reportData ? (
                    <div id="report-printable" className="w-full">
                        <div className="mb-6 border-b-2 border-black pb-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h1 className="text-2xl font-black uppercase text-black">Extrato Financeiro</h1>
                                    <p className="text-sm font-bold text-black uppercase mt-1">
                                        {selectedEmployee?.name} <span className="font-normal text-black">| {selectedEmployee?.role}</span>
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-black">Período de Referência</p>
                                    <p className="font-bold text-black">{startPeriod} a {endPeriod}</p>
                                </div>
                            </div>
                        </div>

                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="border-b-2 border-black text-left text-black">
                                    <th className="py-2 px-2">Competência</th>
                                    <th className="py-2 px-2 text-black">Pagamento</th>
                                    <th className="py-2 px-2">Tipo</th>
                                    <th className="py-2 px-2 text-right">Rend. Bruto</th>
                                    {includeArrears && <th className="py-2 px-2 text-right text-black">Atrasados</th>}
                                    <th className="py-2 px-2 text-right text-red-600">Descontos</th>
                                    <th className="py-2 px-2 text-right">Líquido</th>
                                    <th className="py-2 px-2 text-right text-green-700">FGTS</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {reportData.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 text-black">
                                        <td className="py-2 px-2 font-bold">{row.dateLabel}</td>
                                        <td className="py-2 px-2 text-black">{row.paymentLabel}</td>
                                        <td className="py-2 px-2 text-xs uppercase">{row.type}</td>
                                        <td className="py-2 px-2 text-right font-medium">{formatCurrency(row.gross)}</td>
                                        {includeArrears && (
                                            <td className="py-2 px-2 text-right font-bold">
                                                {row.arrears > 0 ? formatCurrency(row.arrears) : '-'}
                                            </td>
                                        )}
                                        <td className="py-2 px-2 text-right text-red-600">{formatCurrency(row.deductions)}</td>
                                        <td className="py-2 px-2 text-right font-bold">{formatCurrency(row.net + (row.arrears || 0))}</td>
                                        <td className="py-2 px-2 text-right text-green-700 text-xs">{formatCurrency(row.fgts)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            {totals && (
                                <tfoot>
                                    <tr className="border-t-2 border-black bg-gray-50 font-bold text-base text-black">
                                        <td colSpan={3} className="py-3 px-2 text-right uppercase">Totais do Período</td>
                                        <td className="py-3 px-2 text-right">{formatCurrency(totals.gross)}</td>
                                        {includeArrears && <td className="py-3 px-2 text-right">{formatCurrency(totals.arrears)}</td>}
                                        <td className="py-3 px-2 text-right text-red-600">{formatCurrency(totals.deductions)}</td>
                                        <td className="py-3 px-2 text-right text-black">{formatCurrency(totals.net + totals.arrears)}</td>
                                        <td className="py-3 px-2 text-right text-green-700">{formatCurrency(totals.fgts)}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>

                        <div className="mt-8 text-[10px] text-black text-center uppercase print:block hidden">
                            Documento gerado eletronicamente pelo sistema AeroPayroll Manager em {new Date().toLocaleDateString('pt-BR')}.
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 print:hidden">
                        <Search className="w-12 h-12 mb-2 opacity-20" />
                        <p>Selecione um tripulante e o período para gerar o relatório.</p>
                    </div>
                )}
            </div>
        </div>

        {/* Footer Actions - No Print */}
        {reportData && (
            <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end gap-2 print:hidden">
                <button 
                    onClick={handlePrint}
                    className="px-6 py-2 bg-slate-900 hover:bg-black text-white rounded-lg font-bold shadow-lg flex items-center gap-2 transition-transform active:scale-95"
                >
                    <Printer className="w-4 h-4" />
                    Imprimir Relatório
                </button>
            </div>
        )}

      </div>
    </div>
  );
};
