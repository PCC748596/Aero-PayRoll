
import React, { useState, useEffect, useMemo } from 'react';
import { Employee } from '../types';
import { X, Sun, Calendar } from 'lucide-react';

interface VacationModalProps {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (empId: string, startDate: string, days: 15 | 30, periodStart: string, periodEnd: string) => void;
}

const VacationModal: React.FC<VacationModalProps> = ({ employee, isOpen, onClose, onSave }) => {
  const [startDate, setStartDate] = useState('');
  const [days, setDays] = useState<15 | 30>(30);
  const [currentVestingPeriod, setCurrentVestingPeriod] = useState<{start: string, end: string} | null>(null);
  const [daysRemainingInPeriod, setDaysRemainingInPeriod] = useState<number>(30);

  // Helper para formatar data localmente YYYY-MM-DD para evitar problemas de timezone com ISOString
  const toLocalISOString = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
  };

  // Determinar qual é o próximo período aquisitivo aberto (não quitado)
  useEffect(() => {
    console.log('VacationModal employee:', employee);
    if (isOpen && employee && employee.admissionDate) {
        const [admY, admM, admD] = employee.admissionDate.split('-').map(Number);
        const admissionDate = new Date(admY, admM - 1, admD);
        const now = new Date(); 
        
        let ptrStart = new Date(admissionDate);
        let found = null;
        let safety = 0;
        let remaining = 30;

        // Recuperar a data agendada atualmente (se houver) para excluí-la da conta histórica ao editar
        const currentScheduledStartDate = employee.vacationStartDate;

        // Loop para encontrar o primeiro período com saldo disponível (< 30 dias gozados)
        while (safety < 50) {
            safety++;
            const ptrStartStr = toLocalISOString(ptrStart);
            
            // Soma dias do histórico PARA ESTE PERÍODO ESPECÍFICO (ptrStartStr)
            // Exclui a férias que está sendo editada agora (se coincidir) para não travar a edição
            const takenDays = (employee.vacationHistory || [])
                .filter(v => v.periodStart === ptrStartStr)
                .filter(v => v.startDate !== currentScheduledStartDate) 
                .reduce((sum, v) => sum + v.days, 0);

            // REGRA CRÍTICA: Se já gozou 30 dias (seja 1x30 ou 2x15), esse período está QUITADO.
            // Avança para o próximo ano.
            if (takenDays >= 30) {
                 ptrStart.setFullYear(ptrStart.getFullYear() + 1);
                 
                 // Se avançamos para um futuro muito distante (além do atual), paramos para não criar infinitos
                 // Mas permitimos períodos atuais ou próximos
                 const nextLimit = new Date();
                 nextLimit.setFullYear(nextLimit.getFullYear() + 2);
                 if (ptrStart > nextLimit) break;
                 
                 continue; // Vai para a próxima iteração do loop (próximo período aquisitivo)
            }

            // Se chegou aqui, takenDays < 30. Este é o período vigente.
            const ptrEnd = new Date(ptrStart);
            ptrEnd.setFullYear(ptrEnd.getFullYear() + 1);
            ptrEnd.setDate(ptrEnd.getDate() - 1);
            
            found = {
                start: ptrStartStr,
                end: toLocalISOString(ptrEnd)
            };
            remaining = 30 - takenDays;
            break; // Encontramos o período, para o loop.
        }

        setCurrentVestingPeriod(found);
        setDaysRemainingInPeriod(remaining);
        
        // Configuração Inicial dos Campos
        if (employee.vacationStartDate) {
            setStartDate(employee.vacationStartDate);
        } else if (employee.vacationHistory && employee.vacationHistory.length > 0) {
            // Se não tem vacationStartDate (não intersecta mês atual), pega a última do histórico
            setStartDate(employee.vacationHistory[employee.vacationHistory.length - 1].startDate);
        } else {
            setStartDate('');
        }
        
        // Se já tem dias definidos (edição), mantém.
        if (employee.vacationDays) {
             // Validação extra: Se o histórico mudou e o que era 30 agora só cabe 15, ajusta.
             if (employee.vacationDays > remaining) {
                 setDays(remaining as 15 | 30); 
             } else {
                 setDays(employee.vacationDays);
             }
        } else {
            // Se for novo agendamento, sugere o máximo possível (30 ou 15)
            setDays(remaining >= 30 ? 30 : 15);
        }
    }
  }, [isOpen, employee]);

  if (!isOpen || !employee) return null;

  const handleSave = () => {
    if (!startDate || !currentVestingPeriod) return;
    onSave(employee.id, startDate, days, currentVestingPeriod.start, currentVestingPeriod.end);
    onClose();
  };

  const handleClear = () => {
      onSave(employee.id, '', 30, '', ''); 
      onClose();
  };

  const formatDateBR = (iso: string) => iso.split('-').reverse().join('/');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-96 border-t-4 border-amber-500">
        <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center bg-amber-50 dark:bg-amber-900/10">
          <div className="flex items-center gap-2">
            <Sun className="w-5 h-5 text-amber-600 dark:text-amber-500" />
            <h3 className="font-bold text-slate-950 dark:text-slate-100">Programar Férias</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-sm text-blue-800 dark:text-blue-300 mb-2">
             <div className="font-bold uppercase text-base mb-1">{employee.name}</div>
             <div className="flex justify-between text-xs opacity-80">
                <span>Admissão: {formatDateBR(employee.admissionDate)}</span>
             </div>
          </div>
                    {currentVestingPeriod ? (
              <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded border border-amber-200 dark:border-amber-800 space-y-2">
                 <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs uppercase">
                    <Calendar className="w-3 h-3" />
                    Período Aquisitivo Referência
                 </div>
                 <div className="text-sm font-mono text-slate-950 dark:text-slate-200 border-b border-amber-200 dark:border-amber-800 pb-2">
                    {formatDateBR(currentVestingPeriod.start)} a {formatDateBR(currentVestingPeriod.end)}
                 </div>
                 {startDate && (
                    <div className="text-xs text-slate-700 dark:text-slate-300 pt-1">
                        <span className="font-bold">Férias Programadas:</span> {formatDateBR(startDate)} 
                        {(() => {
                            const vacation = employee.vacationHistory?.find(v => v.startDate === startDate);
                            return vacation ? ` a ${formatDateBR(vacation.endDate)}` : '';
                        })()}
                    </div>
                 )}
                 <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500 dark:text-gray-400">Saldo Disponível:</span>
                    <span className={`font-bold ${daysRemainingInPeriod === 30 ? 'text-green-600' : 'text-orange-500'}`}>
                        {daysRemainingInPeriod} dias
                    </span>
                 </div>
              </div>
          ) : (
              <div className="bg-green-50 text-green-700 p-2 rounded text-xs">
                 Todos os períodos anteriores quitados. Aguardando novo ciclo.
              </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">
              Data de Início das Férias
            </label>
            <input
              type="date"
              className="w-full border border-gray-300 dark:border-slate-700 rounded px-2 py-2 bg-white dark:bg-slate-800 text-slate-950 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">
              Duração (Dias)
            </label>
            <select
              className="w-full border border-gray-300 dark:border-slate-700 rounded px-2 py-2 bg-white dark:bg-slate-800 text-slate-950 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
              value={days}
              onChange={(e) => setDays(Number(e.target.value) as 15 | 30)}
            >
              <option value={30} disabled={daysRemainingInPeriod < 30}>30 Dias (Integral)</option>
              <option value={15}>15 Dias (Fracionado)</option>
            </select>
            {daysRemainingInPeriod < 30 && (
                <p className="text-[10px] text-orange-500 mt-1 flex items-center gap-1">
                   <Calendar className="w-3 h-3"/>
                   Restam apenas 15 dias neste período aquisitivo.
                </p>
            )}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-slate-800 mt-4">
             {startDate && (
                 <button 
                    onClick={handleClear}
                    className="text-red-500 hover:text-red-700 text-xs font-bold underline"
                 >
                     Cancelar Férias
                 </button>
             )}
             <div className="flex gap-2 ml-auto">
                <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded transition-colors"
                >
                Fechar
                </button>
                <button
                onClick={handleSave}
                disabled={!startDate || !currentVestingPeriod}
                className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white font-bold rounded shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                Confirmar
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VacationModal;
