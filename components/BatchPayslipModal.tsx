import React, { useState, useMemo, useEffect } from 'react';
import { Employee, CCTConfigData, Holiday, PayrollType } from '../types';
import { calculateBusinessDays } from '../utils/calculationService';
import { getEmptyEmployees } from '../constants';
import { X, Printer, Search, Filter, Layers } from 'lucide-react';
import Payslip from './Payslip';

interface BatchPayslipModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[]; // Current Employees
  history: Record<string, Employee[]>;
  cctHistory: CCTConfigData[];
  ignoredHolidays: string[];
  customHolidays: Holiday[];
  manualBusinessDays: number; // Value from App state
  currentPaymentDate: Date;   // Value from App state
  initialEmpId?: string;      // Pré-seleção vinda do Relatório Financeiro
  initialStart?: string;      // YYYY-MM (mês de pagamento)
  initialEnd?: string;        // YYYY-MM (mês de pagamento)
}

interface BatchItem {
    id: string;
    employee: Employee; // Historical snapshot
    date: Date;
    payrollType: PayrollType;
    businessDays: number; // Correct business days for that month
}

const BatchPayslipModal: React.FC<BatchPayslipModalProps> = ({
  isOpen, onClose, employees, history, cctHistory, ignoredHolidays, customHolidays, manualBusinessDays, currentPaymentDate,
  initialEmpId, initialStart, initialEnd
}) => {
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [startPeriod, setStartPeriod] = useState<string>(''); // YYYY-MM
  const [endPeriod, setEndPeriod] = useState<string>('');   // YYYY-MM
  const [generatedBatch, setGeneratedBatch] = useState<BatchItem[] | null>(null);

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

  const handleGenerate = () => generateBatch(selectedEmpId, startPeriod, endPeriod);

  // Quando aberto pelo Relatório Financeiro, já vem com tripulante e período preenchidos e gera a visualização
  useEffect(() => {
      if (!isOpen || !initialEmpId || !initialStart || !initialEnd) return;
      setSelectedEmpId(initialEmpId);
      setStartPeriod(initialStart);
      setEndPeriod(initialEnd);
      generateBatch(initialEmpId, initialStart, initialEnd);
  }, [isOpen, initialEmpId, initialStart, initialEnd]);

  const generateBatch = (empId: string, startP: string, endP: string) => {
      if (!empId || !startP || !endP) return;

      const [startY, startM] = startP.split('-').map(Number);
      const [endY, endM] = endP.split('-').map(Number);

      const startDate = new Date(startY, startM - 1, 1);
      const endDate = new Date(endY, endM - 1, 1);

      const items: BatchItem[] = [];
      let ptr = new Date(startDate);

      while (ptr <= endDate || (ptr.getFullYear() === endDate.getFullYear() && ptr.getMonth() === endDate.getMonth())) {
          const y = ptr.getFullYear();
          const m = ptr.getMonth(); // 0-based
          
          // History Key
          const historyKey = `${y}-${m}`;
          
          // Determine if this is the CURRENT active month in the App
          const isCurrentContext = y === currentPaymentDate.getFullYear() && m === currentPaymentDate.getMonth();
          
          let empSnapshot: Employee | undefined;
          
          if (isCurrentContext) {
              empSnapshot = employees.find(e => e.id === empId);
          } else {
              const histList = history[historyKey];
              empSnapshot = histList?.find(e => e.id === empId);
          }

          // Mês nunca salvo no histórico: usa o registro mais próximo do tripulante, sem horas variáveis,
          // desde que ele já estivesse admitido na competência (mesmo que o app faz ao abrir um mês novo)
          if (!empSnapshot) {
              const target = y * 12 + m;
              let nearest: Employee | undefined;
              let bestDist = Infinity;
              Object.keys(history).forEach(k => {
                  const candidate = history[k]?.find(e => e.id === empId);
                  if (!candidate) return;
                  const [ky, km] = k.split('-').map(Number);
                  const kv = ky * 12 + km;
                  const dist = Math.abs(kv - target) + (kv > target ? 0.5 : 0); // empata a favor do mês anterior
                  if (dist < bestDist) { bestDist = dist; nearest = candidate; }
              });
              if (nearest?.admissionDate) {
                  const [ay, am] = nearest.admissionDate.split('-').map(Number);
                  const competenceVal = y * 12 + (m - 1);
                  if (ay * 12 + (am - 1) <= competenceVal) {
                      empSnapshot = getEmptyEmployees([JSON.parse(JSON.stringify(nearest))])[0];
                  }
              }
          }

          if (empSnapshot) {
              const paymentDate = new Date(y, m, 1); 
              const compYear = y;
              const compMonth = m - 1; // Competence
              
              let effectiveBusinessDays = 0;
              
              if (isCurrentContext) {
                  effectiveBusinessDays = manualBusinessDays;
              } else {
                  const { businessDays } = calculateBusinessDays(compYear, compMonth, ignoredHolidays, customHolidays);
                  effectiveBusinessDays = businessDays;
              }

              // --- LOGIC FOR TERMINATION / ACTIVE STATUS ---
              let isTerminationMonth = false; // Is this the specific month to pay termination?
              let isPostResignation = false; // Is this month AFTER the employee has fully left?

              if (empSnapshot.resignationDate) {
                  const [rY, rM] = empSnapshot.resignationDate.split('-').map(Number);
                  // Normalize to absolute month index (Year * 12 + MonthIndex)
                  const resAbs = rY * 12 + (rM - 1);
                  const currentAbs = y * 12 + m;

                  // Rule: Termination Calc happens 2 months after resignation (Variables window)
                  if (currentAbs === resAbs + 2) {
                      isTerminationMonth = true;
                  }
                  
                  // Rule: Don't generate normal monthly slips after resignation month
                  // Note: If it IS the termination month, we generate TERMINATION type instead of MONTHLY
                  if (currentAbs > resAbs) {
                      isPostResignation = true;
                  }
              }

              // 1. Generate Main Payslip (Termination OR Monthly)
              if (isTerminationMonth) {
                   items.push({
                      id: `termination-${y}-${m}`,
                      employee: empSnapshot,
                      date: paymentDate,
                      payrollType: 'TERMINATION',
                      businessDays: effectiveBusinessDays
                  });
              } else if (!isPostResignation) {
                  // Standard Monthly (or Proportional Last Month)
                  items.push({
                      id: `monthly-${y}-${m}`,
                      employee: empSnapshot,
                      date: paymentDate, 
                      payrollType: 'MONTHLY',
                      businessDays: effectiveBusinessDays
                  });
              }

              // For 13th and Vacation, suppress if post-resignation (usually included in termination)
              // Unless it's the resignation month itself or before
              const canGenerateExtras = !isPostResignation && !isTerminationMonth;

              // 2. 13th Salary
              if (canGenerateExtras) {
                  if (m === 10) { // Nov -> 1st Installment
                      items.push({
                          id: `13-1st-${y}`,
                          employee: empSnapshot,
                          date: paymentDate, 
                          payrollType: '13_1ST',
                          businessDays: effectiveBusinessDays
                      });
                  }
                  if (m === 11) { // Dec -> 2nd Installment
                      items.push({
                          id: `13-2nd-${y}`,
                          employee: empSnapshot,
                          date: paymentDate,
                          payrollType: '13_2ND',
                          businessDays: effectiveBusinessDays
                      });
                  }
              }

              // 3. Vacation: um recibo para cada férias do histórico que começa neste mês (e a vigente, se não estiver no histórico)
              if (canGenerateExtras) {
                  const vacationStarts = new Set<string>();
                  (empSnapshot.vacationHistory || []).forEach(v => vacationStarts.add(v.startDate));
                  if (empSnapshot.vacationStartDate) vacationStarts.add(empSnapshot.vacationStartDate);

                  vacationStarts.forEach(startDate => {
                      const [vY, vM] = startDate.split('-').map(Number);
                      if (vY === y && vM === (m + 1)) {
                          items.push({
                              id: `vacation-${startDate}`,
                              employee: empSnapshot as Employee,
                              date: paymentDate,
                              payrollType: 'VACATION',
                              businessDays: 0
                          });
                      }
                  });
              }
          }

          ptr.setMonth(ptr.getMonth() + 1);
      }

      // 4. Rescisão: se o desligamento cai no período, o termo de rescisão entra mesmo que o mês de pagamento (desligamento + 2) seja depois do fim
      const anySnapshot = employees.find(e => e.id === empId) || (Object.values(history) as Employee[][]).flat().find(e => e.id === empId);
      if (anySnapshot?.resignationDate) {
          const [rY, rM] = anySnapshot.resignationDate.split('-').map(Number);
          const resAbs = rY * 12 + (rM - 1);
          const startAbs = startY * 12 + (startM - 1);
          const endAbs = endY * 12 + (endM - 1);
          const payAbs = resAbs + 2;
          const termId = `termination-${Math.floor(payAbs / 12)}-${payAbs % 12}`;
          const inPeriod = resAbs >= startAbs - 1 && resAbs <= endAbs;
          if (inPeriod && !items.some(i => i.id === termId)) {
              const payY = Math.floor(payAbs / 12);
              const payM = payAbs % 12;
              const payKey = `${payY}-${payM}`;
              const isCurrent = payY === currentPaymentDate.getFullYear() && payM === currentPaymentDate.getMonth();
              const termSnapshot = (isCurrent ? employees.find(e => e.id === empId) : history[payKey]?.find(e => e.id === empId)) || anySnapshot;
              items.push({
                  id: termId,
                  employee: termSnapshot,
                  date: new Date(payY, payM, 1),
                  payrollType: 'TERMINATION',
                  businessDays: isCurrent ? manualBusinessDays : calculateBusinessDays(payY, payM - 1, ignoredHolidays, customHolidays).businessDays
              });
          }
      }

      // Ordem cronológica de pagamento (a rescisão pode ter sido adicionada no fim)
      items.sort((a, b) => a.date.getTime() - b.date.getTime());
      setGeneratedBatch(items);
  };

  const handlePrint = () => {
      window.print();
  };

  if (!isOpen) return null;

  return (
    // CRITICAL FIX: print:!bg-white print:!text-black print:min-h-screen
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:p-0 print:!bg-white print:!text-black print:static print:w-full print:h-auto print:block">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 print:shadow-none print:border-none print:max-w-none print:max-h-none print:w-full print:h-auto print:overflow-visible print:block print:!bg-white print:!text-black">
        
        {/* Header - No Print */}
        <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 print:hidden">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-6 h-6 text-purple-600" />
              Impressão de Holerites em Lote
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Gere e imprima múltiplos holerites (Mensal, 13º, Férias e Rescisão) de uma só vez.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-full text-gray-500">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden print:overflow-visible print:block print:!bg-white">
            
            {/* Controls - No Print */}
            <div className="p-4 bg-gray-100 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex flex-wrap gap-4 items-end print:hidden">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Tripulante</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <select 
                            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 outline-none"
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
                    <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Início (Pagamento)</label>
                    <input 
                        type="month" 
                        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                        value={startPeriod}
                        onChange={(e) => setStartPeriod(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Fim (Pagamento)</label>
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
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold shadow-sm transition-colors flex items-center gap-2"
                >
                    <Filter className="w-4 h-4" />
                    Gerar Visualização
                </button>
            </div>

            {/* Preview Area */}
            <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50 dark:bg-slate-950 p-6 print:p-0 print:overflow-visible print:!bg-white">
                {generatedBatch ? (
                    <div id="batch-print-container" className="flex flex-col gap-8 print:block print:gap-0">
                        {generatedBatch.length > 0 && (
                            <div className="print:hidden text-xs font-bold text-gray-500 dark:text-slate-400 uppercase">
                                {generatedBatch.length} contracheque(s) no período: {generatedBatch.map(i => `${i.payrollType === 'MONTHLY' ? '' : i.payrollType + ' '}${String(i.date.getMonth() + 1).padStart(2, '0')}/${i.date.getFullYear()}`).join(' · ')}
                            </div>
                        )}
                        {generatedBatch.length === 0 && (
                            <div className="text-center text-gray-500 py-10">Nenhum holerite encontrado para o período selecionado.</div>
                        )}
                        {generatedBatch.map((item, index) => (
                            <div 
                                key={item.id} 
                                className="mb-8 last:mb-0 print:mb-0 print:w-full print:block print:min-h-screen"
                                style={{ 
                                    pageBreakAfter: index < generatedBatch.length - 1 ? 'always' : 'auto',
                                    breakAfter: index < generatedBatch.length - 1 ? 'page' : 'auto',
                                    breakInside: 'avoid'
                                }}
                            >
                                <PayslipWrapper 
                                    item={item} 
                                    employees={employees} // Current list needed for lookups inside Payslip
                                    history={history}
                                    cctHistory={cctHistory}
                                    ignoredHolidays={ignoredHolidays}
                                    customHolidays={customHolidays}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 print:hidden">
                        <Layers className="w-12 h-12 mb-2 opacity-20" />
                        <p>Selecione os parâmetros e clique em Gerar.</p>
                    </div>
                )}
            </div>
        </div>

        {/* Footer Actions - No Print */}
        {generatedBatch && generatedBatch.length > 0 && (
            <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end gap-2 print:hidden">
                <button 
                    onClick={handlePrint}
                    className="px-6 py-2 bg-slate-900 hover:bg-black text-white rounded-lg font-bold shadow-lg flex items-center gap-2 transition-transform active:scale-95"
                >
                    <Printer className="w-4 h-4" />
                    Imprimir Todos ({generatedBatch.length})
                </button>
            </div>
        )}

      </div>
    </div>
  );
};

// Internal Wrapper to calculate data for Payslip component
const PayslipWrapper: React.FC<{
    item: BatchItem, 
    employees: Employee[], 
    history: Record<string, Employee[]>,
    cctHistory: CCTConfigData[],
    ignoredHolidays: string[],
    customHolidays: Holiday[]
}> = ({ item, employees, history, cctHistory, ignoredHolidays, customHolidays }) => {
    
    // Pass dummy data, actual calculation happens inside Payslip based on 'currentDate'
    const dummyResult: any = {
        employee: item.employee,
        earnings: [],
        deductions: [],
        nonTaxableEarnings: [],
        totals: { gross:0, net:0, totalDeductions:0, fgts:0, totalNonTaxable:0 },
        metadata: { businessDays: 0, dsrMultiplier: 0, sundaysAndHolidays: 0, payrollType: item.payrollType }
    };

    return (
        <Payslip 
            data={dummyResult}
            onBack={() => {}}
            currentDate={item.date} // This sets the context for calculation inside Payslip
            employees={[item.employee]} // Pass only this employee snapshot to ensure it picks this one
            onSelectEmployee={() => {}}
            history={history}
            customHolidays={customHolidays}
            ignoredHolidays={ignoredHolidays}
            cctHistory={cctHistory}
            businessDays={item.businessDays}
            hideControls={true}
            forcePayrollType={item.payrollType}
        />
    );
};

export default BatchPayslipModal;