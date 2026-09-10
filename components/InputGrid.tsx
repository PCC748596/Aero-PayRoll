

import React, { useState, useMemo, useEffect } from 'react';
import { Employee, Role } from '../types';
import { ArrowUp, ArrowDown, ArrowUpDown, FileText, Search, Ban, Sun, Palmtree, UserX } from 'lucide-react';

interface InputGridProps {
  employees: Employee[];
  onUpdateEmployee: (updated: Employee) => void;
  onSelectForPayslip: (employee: Employee, type: 'MONTHLY' | 'VACATION' | 'TERMINATION') => void;
  onEditDetails: (employee: Employee) => void;
  onOpenVacation: (employee: Employee) => void;
  currentDate: Date;
  isLocked: boolean;
}

// Custom Input Component for X,XX format
const DecimalInput = ({ value, onChange, placeholder = "0,00", disabled = false }: { value: number, onChange: (val: number) => void, placeholder?: string, disabled?: boolean }) => {
  const [localValue, setLocalValue] = useState<string>('');
  const [isFocused, setIsFocused] = useState(false);

  const format = (num: number) => {
      if (num === 0) return '';
      return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(format(value));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace('.', ',');
    if (!/^\d*,?\d*$/.test(raw)) return;
    setLocalValue(raw);
    if (raw === '' || raw === ',') {
        onChange(0);
        return;
    }
    const parsed = parseFloat(raw.replace(',', '.'));
    if (!isNaN(parsed)) {
        onChange(parsed);
    }
  };

  return (
      <input 
        type="text"
        inputMode="decimal"
        disabled={disabled}
        className={`w-full h-full px-1 text-center outline-none border-none focus:ring-inset focus:ring-2 focus:ring-blue-500 placeholder-transparent transition-colors ${
            disabled 
            ? 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-600 cursor-not-allowed' 
            : 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white focus:bg-blue-50 dark:focus:bg-slate-800'
        }`}
        value={localValue}
        placeholder={placeholder}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onChange={handleChange}
      />
  );
};

const InputGrid: React.FC<InputGridProps> = ({ employees, onUpdateEmployee, onSelectForPayslip, onEditDetails, onOpenVacation, currentDate, isLocked }) => {
  const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'role'; direction: 'asc' | 'desc' } | null>({ key: 'name', direction: 'asc' });

  const updateHour = (val: number, emp: Employee, field: keyof Employee['hours']) => {
    const updated = { ...emp, hours: { ...emp.hours, [field]: val } };
    onUpdateEmployee(updated);
  };

  const updateVar = (val: any, emp: Employee, field: keyof Employee) => {
    // @ts-ignore
    const updated = { ...emp, [field]: val };
    onUpdateEmployee(updated);
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>, emp: Employee, field: keyof Employee) => {
    // @ts-ignore
    const updated = { ...emp, [field]: e.target.value };
    onUpdateEmployee(updated);
  };

  const requestSort = (key: 'seniority' | 'name' | 'role') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedEmployees = useMemo(() => {
    let sortableItems = [...employees];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    } else {
        // Default sort by name
        sortableItems.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sortableItems;
  }, [employees, sortConfig]);

  const isPericEnabled = useMemo(() => {
      const y = currentDate.getFullYear();
      const m = currentDate.getMonth(); // 0-based index
      // Disabled if BEFORE Oct 2024 (2024-9)
      if (y < 2024) return false;
      if (y === 2024 && m < 9) return false;
      return true;
  }, [currentDate]);

  // Helper: Payslip status
  const getPayslipStatus = (emp: Employee) => {
      const currentMonthVal = currentDate.getFullYear() * 12 + currentDate.getMonth();
      if (emp.admissionDate) {
          const [ay, am] = emp.admissionDate.split('-').map(Number);
          const admMonthVal = ay * 12 + (am - 1);
          
          // Se o mês atual for MENOR que a admissão, bloqueia.
          // Se for IGUAL, é o mês de admissão (Holerite Proporcional), então libera.
          if (currentMonthVal < admMonthVal) return { disabled: true, reason: "Admissão Futura", isTermination: false };
      }
      if (emp.resignationDate) {
          const [ry, rm] = emp.resignationDate.split('-').map(Number);
          const resMonthVal = ry * 12 + (rm - 1);
          
          // Exception: Termination Settlement Month (Resignation Month + 2)
          // Ex: Demissão em Jan (0). Rescisão em Mar (2). 0 + 2 = 2. (Pagamento da Rescisão + Variáveis)
          if (currentMonthVal === resMonthVal + 2) {
              return { disabled: false, reason: "Cálculo de Rescisão (Variáveis)", isTermination: true };
          }

          // Rule: Block ANY month after Resignation Month (except the +2 handled above)
          // Specifically blocks Month + 1 (The "skipped" month)
          if (currentMonthVal > resMonthVal) {
               return { disabled: true, reason: "Ciclo Fechado (Aguarde mês +2 para rescisão)", isTermination: false };
          }
      }
      return { disabled: false, reason: "", isTermination: false };
  };

  const toLocalISOString = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
  };

  // Helper: Calcular Status de Férias (Cor e Visibilidade)
  const getVacationStatus = (emp: Employee) => {
      if (emp.resignationDate) return { visible: false, colorClass: '', title: 'Funcionário em processo de desligamento' };

      if (!emp.admissionDate) return { visible: false, colorClass: '', title: '' };

      const [admY, admM, admD] = emp.admissionDate.split('-').map(Number);
      const admissionDate = new Date(admY, admM - 1, admD);
      
      // Data de referência: Último dia do mês atual (Competência)
      const referenceDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      let periodStart = new Date(admissionDate);
      let safety = 0;

      while (periodStart < referenceDate && safety < 50) {
          safety++;
          
          const periodEnd = new Date(periodStart);
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
          periodEnd.setDate(periodEnd.getDate() - 1);

          const periodStartStr = toLocalISOString(periodStart);
          
          const takenDays = (emp.vacationHistory || [])
              .filter(v => v.periodStart === periodStartStr)
              .reduce((sum, v) => sum + v.days, 0);

          if (takenDays < 30) {
              const diffTime = Math.abs(referenceDate.getTime() - periodStart.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
              const diffMonths = diffDays / 30; 

              if (diffMonths < 10) {
                  return { visible: true, colorClass: 'bg-gray-400 hover:bg-gray-500 text-white', title: `Aguardando período (meses: ${diffMonths.toFixed(1)})` };
              } else if (diffMonths < 20) {
                  return { visible: true, colorClass: 'bg-green-600 hover:bg-green-700 text-white', title: 'Período Aquisitivo completado (Regular)' };
              } else if (diffMonths < 23) {
                  return { visible: true, colorClass: 'bg-orange-500 hover:bg-orange-600 text-white animate-pulse', title: 'Atenção: Próximo ao limite concessivo' };
              } else {
                  return { visible: true, colorClass: 'bg-red-600 hover:bg-red-700 text-white animate-pulse', title: 'ALTO RISCO de multa por extrapolação de Segundo Período.' };
              }
          }
          periodStart.setFullYear(periodStart.getFullYear() + 1);
      }
      return { visible: true, colorClass: 'bg-gray-400 hover:bg-gray-500 text-white', title: 'Em dia' };
  };

  const hourColumns: { key: keyof Employee['hours']; label: string }[] = [
    { key: 'diurna', label: 'DIURNO' },
    { key: 'noturna', label: 'NOT' },
    { key: 'espDiurno', label: 'ESP.D' },
    { key: 'espNoturno', label: 'ESP.N' },
    { key: 'reDiurno', label: 'RE.D' },
    { key: 'reNoturna', label: 'RE.N' },
    { key: 'reEspDiurno', label: 'RE.E.D' },
    { key: 'reEspNoturno', label: 'RE.E.N' },
    { key: 'saDiurno', label: 'SA.D' },
    { key: 'saNoturna', label: 'SA.N' },
    { key: 'saEspDiurno', label: 'SA.E.D' },
    { key: 'saEspNoturno', label: 'SA.E.N' },
    { key: 'simulador', label: 'SIM.D' },
    { key: 'horaSolo', label: 'SOLO' },
  ];

  const triTreOptions = ['NA', 'TRI', 'TRE'];
  const adFuncaoOptions = ['NA', 'D.OPR', 'D.SAFETY', 'P.CHEFE', 'G.KEEPER', 'D.GERAL', 'ACORDO'];
  const equipOptions = ['A321', 'A330', 'ATR72'];

  const SortIcon = ({ column }: { column: 'seniority' | 'name' | 'role' }) => {
    if (sortConfig?.key !== column) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  return (
    <div className="overflow-x-auto border border-gray-400 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 transition-colors">
      <table className="min-w-full text-xs text-left whitespace-nowrap border-collapse">
        <thead className="bg-green-900 dark:bg-emerald-950 text-white font-bold uppercase border-b-2 border-black dark:border-slate-950">
          <tr>
            <th 
              className="px-2 py-2 border-r border-white/20 sticky left-0 bg-green-900 dark:bg-emerald-950 z-30 cursor-pointer hover:bg-green-800 dark:hover:bg-emerald-900 select-none group w-14"
              onClick={() => requestSort('seniority')}
            >
              <div className="flex items-center justify-center gap-1">
                <span>SEN</span>
                <span className="text-white group-hover:opacity-100 transition-opacity">
                  <SortIcon column="seniority" />
                </span>
              </div>
            </th>
            <th 
              className="px-2 py-2 border-r border-white/20 sticky left-14 bg-green-900 dark:bg-emerald-950 z-30 cursor-pointer hover:bg-green-800 dark:hover:bg-emerald-900 select-none group w-48"
              onClick={() => requestSort('name')}
            >
              <div className="flex items-center justify-between gap-2">
                <span>Nome</span>
                <span className="text-white group-hover:opacity-100 transition-opacity">
                  <SortIcon column="name" />
                </span>
              </div>
            </th>
            <th 
              className="px-2 py-2 border-r border-white/20 text-center cursor-pointer hover:bg-green-800 dark:hover:bg-emerald-900 select-none group w-14"
              onClick={() => requestSort('role')}
            >
              <div className="flex items-center justify-center gap-1">
                <span>Função</span>
                <span className="text-white group-hover:opacity-100 transition-opacity">
                   <SortIcon column="role" />
                </span>
              </div>
            </th>
            {hourColumns.map(col => (
               <th key={col.key} className="px-1 py-2 border-r border-white/20 text-center w-16">{col.label}</th>
            ))}
            <th className="px-1 py-2 border-r border-white/20 text-center w-14">F.DESL</th>
            <th className="px-1 py-2 border-r border-white/20 text-center">TRI-TER</th>
            <th className="px-1 py-2 border-r border-white/20 text-center">AD.FUNÇÃO</th>
            <th className="px-1 py-2 border-r border-white/20 text-center">PERIC.</th>
            <th className="px-1 py-2 border-r border-white/20 text-center">EQUIP</th>
            <th className="px-2 py-2 text-center">AÇÃO</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-300 dark:divide-slate-800 text-slate-950 dark:text-white transition-colors">
          {sortedEmployees.map((emp, idx) => {
            const payslipStatus = getPayslipStatus(emp);
            const vacationStatus = getVacationStatus(emp);
            
            const competenceDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
            const currentMonthStart = new Date(competenceDate.getFullYear(), competenceDate.getMonth(), 1);
            const currentMonthEnd = new Date(competenceDate.getFullYear(), competenceDate.getMonth() + 1, 0);
            
            const hasVacationStartingInCurrentMonth = emp.vacationHistory?.some(v => {
                const [vY, vM] = v.startDate.split('-').map(Number);
                return vY === currentDate.getFullYear() && (vM - 1) === currentDate.getMonth();
            });

            // Lógica para Nome Vermelho: Somente se o mês atual for >= mês do desligamento
            let isNameRed = false;
            if (emp.resignationDate) {
                const [rY, rM] = emp.resignationDate.split('-').map(Number);
                const resDateVal = rY * 12 + (rM - 1);
                const curDateVal = currentDate.getFullYear() * 12 + currentDate.getMonth();
                if (curDateVal >= resDateVal) {
                    isNameRed = true;
                }
            }
            
            return (
            <tr key={emp.id} className="group bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
              <td className="border-r border-gray-300 dark:border-slate-800 sticky left-0 z-20 border-b border-gray-300 dark:border-slate-800 p-2 text-center text-slate-950 dark:text-white font-bold bg-white dark:bg-slate-900">
                  {String(emp.seniority).padStart(2, '0')}
              </td>
              <td className="border-r border-gray-300 dark:border-slate-800 sticky left-14 z-20 border-b border-gray-300 dark:border-slate-800 p-0 h-8 flex items-center transition-colors bg-white dark:bg-slate-900 group-hover:bg-black dark:group-hover:bg-black">
                 <div className={`flex-1 px-2 font-bold uppercase truncate select-none transition-colors ${
                    isNameRed 
                    ? 'text-red-600 dark:text-red-500 group-hover:text-red-300' 
                    : 'text-slate-950 dark:text-white group-hover:text-white dark:group-hover:text-yellow-400'
                 }`}>
                    {emp.name}
                 </div>
                  <button 
                    type="button"
                    onClick={() => onEditDetails(emp)}
                    disabled={isLocked}
                    className={`p-1 mr-1 rounded transition-colors ${
                        isLocked 
                        ? 'text-gray-300 dark:text-slate-700 cursor-not-allowed' 
                        : 'text-gray-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 group-hover:text-gray-400 dark:group-hover:text-gray-400'
                    }`}
                    title="Editar Detalhes"
                  >
                     <Search className="w-4 h-4" />
                  </button>
              </td>
              <td className="px-2 py-1 border-r border-gray-300 dark:border-slate-800 text-center text-slate-950 dark:text-slate-200 font-semibold border-b border-gray-300 dark:border-slate-800 transition-colors">
                {emp.role}
              </td>
              
              {hourColumns.map(col => (
                <td key={col.key} className="border-r border-gray-300 dark:border-slate-800 border-b border-gray-300 dark:border-slate-800 p-0 h-8 transition-colors">
                  <DecimalInput 
                    value={emp.hours[col.key]} 
                    onChange={(val) => updateHour(val, emp, col.key)} 
                    disabled={isLocked}
                  />
                </td>
              ))}

              <td className="border-r border-gray-300 dark:border-slate-800 border-b border-gray-300 dark:border-slate-800 p-0 h-8 transition-colors">
                  <DecimalInput 
                    value={emp.folgaDeslocada} 
                    onChange={(val) => updateVar(val, emp, 'folgaDeslocada')} 
                    placeholder="0"
                    disabled={isLocked}
                  />
              </td>

              <td className="border-r border-gray-300 dark:border-slate-800 border-b border-gray-300 dark:border-slate-800 p-0 h-8 transition-colors">
                 <select 
                   value={emp.triTre} 
                   onChange={(e) => handleChange(e, emp, 'triTre')}
                   disabled={isLocked}
                   className={`w-full h-full text-center outline-none border-none appearance-none transition-colors ${
                       isLocked 
                       ? 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-600 cursor-not-allowed' 
                       : 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white cursor-pointer focus:bg-blue-50 dark:focus:bg-slate-800 focus:ring-inset focus:ring-2 focus:ring-blue-500'
                   } ${emp.triTre !== 'NA' ? 'font-bold' : ''}`}
                   style={{ textAlignLast: 'center' }}
                 >
                   {triTreOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                 </select>
              </td>
               <td className="border-r border-gray-300 dark:border-slate-800 border-b border-gray-300 dark:border-slate-800 p-0 h-8 transition-colors">
                 <select 
                   value={emp.adFuncao} 
                   onChange={(e) => handleChange(e, emp, 'adFuncao')}
                   disabled={isLocked}
                   className={`w-full h-full text-center outline-none border-none appearance-none transition-colors ${
                       isLocked 
                       ? 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-600 cursor-not-allowed' 
                       : 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white cursor-pointer focus:bg-blue-50 dark:focus:bg-slate-800 focus:ring-inset focus:ring-2 focus:ring-blue-500'
                   } ${emp.adFuncao !== 'NA' ? 'font-bold' : ''}`}
                   style={{ textAlignLast: 'center' }}
                 >
                   {adFuncaoOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                 </select>
              </td>
              
              <td className="border-r border-gray-300 dark:border-slate-800 border-b border-gray-300 dark:border-slate-800 p-0 h-8 transition-colors text-center">
                 <div className="flex items-center justify-center h-full">
                    <input 
                        type="checkbox" 
                        checked={emp.periculosidade}
                        onChange={(e) => updateVar(e.target.checked, emp, 'periculosidade')}
                        disabled={!isPericEnabled || isLocked}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    />
                 </div>
              </td>

              <td className="border-r border-gray-300 dark:border-slate-800 border-b border-gray-300 dark:border-slate-800 p-0 h-8 transition-colors">
                <select 
                   value={emp.equipamento} 
                   onChange={(e) => handleChange(e, emp, 'equipamento')}
                   disabled={isLocked}
                   className={`w-full h-full text-center outline-none border-none appearance-none transition-colors ${
                       isLocked 
                       ? 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-600 cursor-not-allowed' 
                       : 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white cursor-pointer focus:bg-blue-50 dark:focus:bg-slate-800 focus:ring-inset focus:ring-2 focus:ring-blue-500'
                   }`}
                   style={{ textAlignLast: 'center' }}
                 >
                   {equipOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                 </select>
              </td>

              <td className="px-2 py-1 text-center border-b border-gray-300 dark:border-slate-800 transition-colors">
                 <div className="flex items-center justify-center gap-1">
                   {/* 
                     LOGICA DE FÉRIAS: 
                     Se tiver data de demissão -> OCULTA TUDO DE FÉRIAS
                   */}
                   {!emp.resignationDate && (
                       <div className="flex items-center gap-1">
                           {/* Icone de Status de Férias (Sol) - Sempre visível se aplicável */}
                           {vacationStatus.visible && (
                               <button
                                 type="button"
                                 onClick={() => onOpenVacation(emp)}
                                 disabled={isLocked}
                                 className={`p-1 rounded shadow-sm transition-all ${vacationStatus.colorClass}`}
                                 title={vacationStatus.title}
                               >
                                 <Sun className="w-4 h-4" />
                               </button>
                           )}

                           {/* Icone de Férias Programadas (Palmeira) - Mostra apenas no mês de início das férias */}
                           {hasVacationStartingInCurrentMonth && (
                               <button
                                 type="button"
                                 onClick={() => onOpenVacation(emp)}
                                 disabled={isLocked}
                                 className="p-1 rounded shadow-sm transition-all bg-cyan-600 hover:bg-cyan-700 text-white"
                                 title="Férias Programadas (Editar/Cancelar)"
                               >
                                 <Palmtree className="w-4 h-4" />
                               </button>
                           )}
                           
                           {/* Recibo de Férias - Mostra apenas no mês de início das férias */}
                           {hasVacationStartingInCurrentMonth && (
                               <button 
                                 type="button"
                                 onClick={() => onSelectForPayslip(emp, 'VACATION')}
                                 className="p-1 rounded shadow-sm transition-all bg-teal-500 hover:bg-teal-600 text-white"
                                 title="Gerar Recibo de Férias"
                                >
                                 <FileText className="w-4 h-4" />
                               </button>
                           )}
                       </div>
                   )}

                   {/* Botão Mensal Padrão OU Rescisão - Agora sempre visível */}
                   <button 
                     type="button"
                     onClick={() => !payslipStatus.disabled && onSelectForPayslip(emp, payslipStatus.isTermination ? 'TERMINATION' : 'MONTHLY')}
                     disabled={payslipStatus.disabled}
                     className={`p-1 rounded shadow-sm transition-all ${
                         payslipStatus.isTermination
                         ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                         : payslipStatus.disabled 
                             ? 'bg-gray-200 dark:bg-slate-800 text-gray-400 dark:text-slate-600 cursor-not-allowed' 
                             : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white'
                     }`}
                     title={payslipStatus.disabled ? `Indisponível: ${payslipStatus.reason}` : (payslipStatus.isTermination ? "Gerar Rescisão" : "Gerar Holerite Mensal")}
                   >
                     {payslipStatus.isTermination ? (
                         <UserX className="w-4 h-4" />
                     ) : (
                         payslipStatus.disabled ? <Ban className="w-4 h-4" /> : <FileText className="w-4 h-4" />
                     )}
                   </button>
                 </div>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
      <div className="p-4 text-gray-500 dark:text-slate-400 text-sm italic bg-gray-50 dark:bg-slate-800/50 border-t border-gray-300 dark:border-slate-800 transition-colors flex justify-between">
        <span>* Preencha as horas e selecione os adicionais para calcular o contracheque. Use TAB para navegar.</span>
        {!isPericEnabled && <span className="text-amber-600 dark:text-amber-500 font-bold text-xs flex items-center gap-1">⚠️ Periculosidade indisponível para períodos anteriores a Outubro de 2024.</span>}
      </div>
    </div>
  );
};

export default InputGrid;
