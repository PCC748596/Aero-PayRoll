import React, { useState, useMemo } from 'react';
import { Calendar, Plus, Trash2, X } from 'lucide-react';
import { Holiday, HolidayType } from '../types';

interface HolidayManagerProps {
  year: number;
  standardHolidays: Holiday[];
  ignoredHolidays: string[]; // dates
  customHolidays: Holiday[];
  onToggleStandard: (date: string) => void;
  onAddCustom: (holiday: Holiday) => void;
  onRemoveCustom: (date: string) => void;
  onClose: () => void;
}

const HolidayManager: React.FC<HolidayManagerProps> = ({ 
  year, 
  standardHolidays, 
  ignoredHolidays, 
  customHolidays, 
  onToggleStandard, 
  onAddCustom, 
  onRemoveCustom,
  onClose 
}) => {
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<HolidayType>('Municipal');

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const handleAdd = () => {
    if (!newDate || !newName) return;
    onAddCustom({
        date: newDate,
        name: newName,
        type: newType
    });
    setNewDate('');
    setNewName('');
    setNewType('Municipal');
  };

  // Filter holidays to show only current year related, sorted by date
  const sortedHolidays = useMemo(() => {
     const standard = standardHolidays
        .filter(h => h.date.startsWith(`${year}-`))
        .map(h => ({ ...h, isStandard: true, active: !ignoredHolidays.includes(h.date) }));
     
     const custom = customHolidays
        .filter(h => h.date.startsWith(`${year}-`))
        .map(h => ({ ...h, isStandard: false, active: true }));

     return [...standard, ...custom].sort((a, b) => a.date.localeCompare(b.date));
  }, [year, standardHolidays, ignoredHolidays, customHolidays]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-950">Feriados {year}</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          <p className="text-xs text-gray-500 mb-4">
            Selecione os feriados nacionais, municipais e estaduais para calcular corretamente os dias úteis.
          </p>

          <div className="space-y-2">
            {sortedHolidays.map((h) => (
              <div key={h.date} className={`flex items-center justify-between p-2 rounded border ${h.active ? 'bg-white border-gray-200' : 'bg-gray-100 border-gray-100 opacity-60'}`}>
                 <div className="flex items-center gap-3 w-full">
                    <input 
                      type="checkbox" 
                      checked={h.active}
                      onChange={() => h.isStandard ? onToggleStandard(h.date) : null}
                      disabled={!h.isStandard}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 mt-1 self-start"
                    />
                    <div className="flex flex-col flex-1">
                        <span className={`text-sm font-bold ${h.active ? 'text-slate-950' : 'text-gray-500'}`}>
                            {formatDate(h.date)}
                        </span>
                        <span className={`text-xs ${h.active ? 'text-slate-950' : 'text-gray-400'}`}>
                           {h.name} <span className="text-gray-400 font-light">({h.type})</span>
                        </span>
                    </div>
                 </div>
                 {!h.isStandard && (
                   <button onClick={() => onRemoveCustom(h.date)} className="text-red-500 hover:bg-red-50 p-2 rounded">
                     <Trash2 className="w-4 h-4" />
                   </button>
                 )}
              </div>
            ))}
            {sortedHolidays.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">Nenhum feriado cadastrado para este ano.</div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
           <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Adicionar Feriado (Municipal/Estadual)</label>
           <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
             <div className="md:col-span-3">
                <label className="block text-[10px] text-gray-400 uppercase mb-1">Data</label>
                <input 
                    type="date" 
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-slate-950"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                />
             </div>
             <div className="md:col-span-5">
                <label className="block text-[10px] text-gray-400 uppercase mb-1">Nome</label>
                <input 
                    type="text" 
                    placeholder="Ex: Aniversário da Cidade"
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-slate-950"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                />
             </div>
             <div className="md:col-span-3">
                <label className="block text-[10px] text-gray-400 uppercase mb-1">Tipo</label>
                <select 
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-slate-950 bg-white"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as HolidayType)}
                >
                    <option value="Municipal">Municipal</option>
                    <option value="Estadual">Estadual</option>
                    <option value="Nacional">Nacional</option>
                </select>
             </div>
             <div className="md:col-span-1">
                 <button 
                onClick={handleAdd}
                disabled={!newDate || !newName}
                className="w-full bg-green-600 text-white py-1.5 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                <Plus className="w-4 h-4" />
                </button>
             </div>
           </div>
        </div>

      </div>
    </div>
  );
};

export default HolidayManager;