
import React, { useState, useEffect, useRef } from 'react';
import { GlobalConfig, Role, CCTConfigData } from '../types';
import { Lock, Unlock, Pencil, Award, SlidersHorizontal } from 'lucide-react';
import CCTHistoryModal from './CCTHistoryModal';

interface DataReferenceProps {
  dsrMultiplier: number;
  onUpdateDsrMultiplier: (val: number) => void;
  config: GlobalConfig;
  onUpdateConfig: (newConfig: GlobalConfig) => void;
  yearLabel: string;
  cctHistory?: CCTConfigData[];
  onUpdateCCTHistory?: (history: CCTConfigData[]) => void;
}

const DataReference: React.FC<DataReferenceProps> = ({ 
    dsrMultiplier, 
    onUpdateDsrMultiplier, 
    config, 
    onUpdateConfig, 
    yearLabel,
    cctHistory,
    onUpdateCCTHistory
}) => {
  const [panelLocked, setPanelLocked] = useState(true);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyModalView, setHistoryModalView] = useState<'CCT' | 'EXTRA'>('CCT');

  const openHistoryModal = (view: 'CCT' | 'EXTRA') => {
      setHistoryModalView(view);
      setShowHistoryModal(true);
  };

  const handleConfigChange = (field: keyof GlobalConfig, value: any) => {
    onUpdateConfig({ ...config, [field]: value });
  };

  const handleSalaryChange = (role: Role, val: number) => {
    onUpdateConfig({ 
      ...config, 
      salaryBase: { ...config.salaryBase, [role]: val } 
    });
  };

  const handleFixedValueChange = (key: string, val: number) => {
    onUpdateConfig({
      ...config,
      fixedValues: { ...config.fixedValues, [key]: val }
    });
  };

  const handleTableChange = (table: 'inssTable' | 'irTable', index: number, field: string, val: any) => {
    const newTable = [...config[table]];
    // @ts-ignore
    newTable[index] = { ...newTable[index], [field]: val };
    onUpdateConfig({ ...config, [table]: newTable });
  };

  const InputMoney = ({ value, onChange, disabled = false, bgClass }: { value: number | undefined | null, onChange: (v: number) => void, disabled?: boolean, bgClass?: string }) => {
    const formatValue = (val: number | undefined | null) => {
      if (val === undefined || val === null || isNaN(val)) return '0,00';
      return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const [display, setDisplay] = useState(formatValue(value));
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
      if (!isFocused) {
        setDisplay(formatValue(value));
      }
    }, [value, isFocused]);

    const handleBlur = () => {
      setIsFocused(false);
      setDisplay(formatValue(value));
    };

    const handleFocus = () => {
      setIsFocused(true);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputVal = e.target.value;
      setDisplay(inputVal);
      const normalized = inputVal.replace(/\./g, '').replace(',', '.');
      const num = parseFloat(normalized);
      if (!isNaN(num)) {
        onChange(num);
      } else if (inputVal === '') {
          onChange(0);
      }
    };

    return (
      <div className="relative">
        <span className="absolute left-1 top-1 text-gray-500 dark:text-slate-400 text-xs">R$</span>
        <input 
          type="text" 
          value={display} 
          disabled={disabled}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          className={`w-full pl-6 border border-gray-300 dark:border-slate-700 rounded px-1 py-0.5 text-right font-semibold focus:ring-1 focus:ring-blue-500 transition-colors ${
              disabled 
              ? 'bg-transparent text-slate-950 dark:text-white cursor-default border-transparent' 
              : (bgClass || 'bg-gray-50 dark:bg-slate-900') + ' text-slate-950 dark:text-white focus:bg-white dark:focus:bg-slate-800'
          }`}
        />
      </div>
    );
  };

  const InputPercent = ({ value, onChange, disabled = false }: { value: number, onChange: (v: number) => void, disabled?: boolean }) => {
    const [localVal, setLocalVal] = useState((value * 100).toFixed(2));
    useEffect(() => {
        setLocalVal((value * 100).toFixed(2));
    }, [value]);
    const handleBlur = () => {
        let v = parseFloat(localVal);
        if (isNaN(v)) v = 0;
        onChange(v / 100);
    };
    return (
        <div className="relative flex items-center">
        <input 
            type="number" 
            step="0.01"
            value={localVal} 
            disabled={disabled}
            onChange={(e) => setLocalVal(e.target.value)}
            onBlur={handleBlur}
            className={`w-16 border border-gray-300 dark:border-slate-700 rounded px-1 py-0.5 text-right text-slate-950 dark:text-white font-semibold focus:ring-1 focus:ring-blue-500 transition-colors ${disabled ? 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-500 cursor-not-allowed' : 'bg-gray-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-800'}`}
        />
        <span className="ml-1 text-gray-600 dark:text-slate-400 text-xs">%</span>
        </div>
    );
  };

  const totalCorrection = (config.inpc || 0) + (config.otherCorrection || 0);
  const factor = 1 + totalCorrection;

  const currentHourValue = (config.horaVooAnterior || 0) * factor;
  const currentSimValue = (config.simuladorAnterior || 0) * factor;
  const currentSoloValue = (config.horaSoloAnterior || 0) * factor;

  const handleUpdateCurrentSim = (val: number) => {
      const newBase = factor > 0 ? val / factor : val;
      handleConfigChange('simuladorAnterior', newBase);
  };

  const handleUpdateCurrentSolo = (val: number) => {
      const newBase = factor > 0 ? val / factor : val;
      handleConfigChange('horaSoloAnterior', newBase);
  };

  const handleUpdateCurrentFlight = (val: number) => {
      const newBase = factor > 0 ? val / factor : val;
      handleConfigChange('horaVooAnterior', newBase);
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 text-sm space-y-4 transition-colors">
      
      {showHistoryModal && (
        <CCTHistoryModal 
            initialData={cctHistory}
            initialView={historyModalView}
            onClose={() => setShowHistoryModal(false)} 
            onSave={onUpdateCCTHistory}
        />
      )}

      <div className="flex justify-between items-center mb-4 border-b border-gray-200 dark:border-slate-800 pb-3">
         <div className="flex flex-col">
            <h4 className="font-bold text-slate-950 dark:text-slate-100 text-base">Parâmetros de Cálculo</h4>
            <p className="text-[10px] text-gray-500 dark:text-slate-400 font-medium uppercase tracking-wider">CCT {yearLabel}</p>
         </div>
         <div className="flex gap-2">
            <button 
                onClick={() => openHistoryModal('CCT')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 font-bold text-xs uppercase tracking-widest shadow-md transition-all active:scale-95"
            >
                <Pencil className="w-4 h-4" />
                Gerenciar CCTs
            </button>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center text-slate-950 dark:text-white border-b border-gray-100 dark:border-slate-800 pb-4 transition-colors">
        <div className="space-y-2">
            <div className="flex gap-2 items-center">
               <span className="font-bold text-slate-950 dark:text-slate-300 w-32">Vale Alimentação:</span>
               <div className="w-32"><InputMoney disabled={true} value={config.valeAlimentacao} onChange={(v) => handleConfigChange('valeAlimentacao', v)} /></div>
            </div>
             <div className="flex gap-2 items-center">
               <span className="font-bold text-slate-950 dark:text-slate-300 w-32">Simulador:</span>
               <div className="w-32">
                   <InputMoney 
                        value={currentSimValue} 
                        onChange={handleUpdateCurrentSim}
                        bgClass="bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 shadow-sm"
                   />
               </div>
            </div>
            <div className="flex gap-2 items-center">
               <span className="font-bold text-slate-950 dark:text-slate-300 w-32">Hora Solo:</span>
               <div className="w-32">
                   <InputMoney 
                        value={currentSoloValue} 
                        onChange={handleUpdateCurrentSolo}
                        bgClass="bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 shadow-sm"
                   />
               </div>
            </div>
        </div>
        
        <div className="flex flex-col gap-2 justify-end">
           <div className="flex gap-2 items-center justify-end">
               <span className="font-bold text-slate-950 dark:text-slate-300 text-xs uppercase opacity-70">Hora Base (S/ Reajuste):</span>
               <div className="w-24 px-2 py-0.5 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded text-right font-bold text-gray-500 dark:text-slate-500 transition-colors">
                   R$ {config.horaVooAnterior?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
               </div>
           </div>
           <div className="flex gap-2 items-center justify-end">
               <span className="font-bold text-slate-950 dark:text-slate-300 text-xs uppercase">Hora Voo Atual:</span>
               <div className="w-24">
                   <InputMoney 
                        value={currentHourValue} 
                        onChange={handleUpdateCurrentFlight} 
                        bgClass="bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 shadow-sm"
                   />
               </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-gray-100 dark:border-slate-800 pb-4 text-slate-950 dark:text-white transition-colors">
         <div className="grid grid-cols-3 gap-2 bg-yellow-50 dark:bg-amber-950/20 p-2 rounded border border-yellow-200 dark:border-amber-900/30">
            <div className="flex flex-col gap-1 items-center justify-center border-r border-yellow-200 dark:border-amber-900/30 pr-2">
                <span className="font-bold text-slate-950 dark:text-slate-200 text-xs text-center">INPC (Correção)</span>
                <InputPercent disabled={true} value={config.inpc} onChange={(v) => handleConfigChange('inpc', v)} />
            </div>
            <div className="flex flex-col gap-1 items-center justify-center border-r border-yellow-200 dark:border-amber-900/30 pr-2">
                <span className="font-bold text-slate-950 dark:text-slate-200 text-xs text-center">Outra Correção</span>
                <InputPercent disabled={true} value={config.otherCorrection} onChange={(v) => handleConfigChange('otherCorrection', v)} />
            </div>
             <div className="flex flex-col gap-1 items-center justify-center">
                <span className="font-bold text-slate-950 dark:text-slate-200 text-xs text-green-700 dark:text-emerald-400 text-center">Total Correção</span>
                <span className="font-bold text-lg text-green-700 dark:text-emerald-400">{(totalCorrection * 100).toFixed(2)}%</span>
            </div>
         </div>
         
         <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
               <span className="font-bold text-slate-950 dark:text-slate-300">Salário Base CMTE:</span>
               <div className="w-32"><InputMoney disabled={true} value={config.salaryBase[Role.CMTE]} onChange={(v) => handleSalaryChange(Role.CMTE, v)} /></div>
            </div>
            <div className="flex justify-between items-center">
               <span className="font-bold text-slate-950 dark:text-slate-300">Salário Base FO:</span>
               <div className="w-32"><InputMoney disabled={true} value={config.salaryBase[Role.FO]} onChange={(v) => handleSalaryChange(Role.FO, v)} /></div>
            </div>
         </div>
      </div>

      <div className="border border-gray-300 dark:border-slate-800 rounded p-2 bg-gray-50 dark:bg-slate-800/30 transition-colors">
          <div className="flex justify-between items-center mb-2 border-b border-gray-300 dark:border-slate-800 pb-1">
             <h4 className="font-bold text-slate-950 dark:text-slate-300">Gratificações e Adicionais</h4>
             <button 
                onClick={() => openHistoryModal('EXTRA')} 
                className="text-[10px] flex items-center gap-1 bg-pink-600 hover:bg-pink-700 text-white px-2 py-1 rounded shadow-sm font-bold uppercase transition-colors"
                title="Gerenciar valores históricos de gratificações"
             >
                <SlidersHorizontal className="w-3 h-3" /> Gerenciar Gratificações e Adicionais
             </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(config.fixedValues).map(([key, val]) => (
                  <div key={key} className="flex flex-col">
                      <label className="text-xs font-bold text-gray-600 dark:text-slate-400 mb-1">{key.replace('_', ' ')}</label>
                      {key === 'PERICULOSIDADE_PERCENT' ? (
                          <InputPercent disabled={true} value={val as number} onChange={(v) => handleFixedValueChange(key, v)} />
                      ) : (
                          <InputMoney disabled={true} value={val as number} onChange={(v) => handleFixedValueChange(key, v)} />
                      )}
                  </div>
              ))}
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
        <div>
           <div className={`text-white font-bold text-center py-1 flex justify-center items-center px-4 gap-2 transition-colors bg-gray-700 dark:bg-slate-800`}>
             <span>TABELA AUXILIAR IR</span>
           </div>
           <table className="w-full text-center border-collapse text-xs">
             <thead className="bg-gray-400 dark:bg-slate-700 font-bold text-slate-950 dark:text-white transition-colors">
               <tr>
                 <th className="border border-gray-500 dark:border-slate-600 p-1">Descrição</th>
                 <th className="border border-gray-500 dark:border-slate-600 p-1">V. Inicial</th>
                 <th className="border border-gray-500 dark:border-slate-600 p-1">V. Final</th>
                 <th className="border border-gray-500 dark:border-slate-600 p-1">%</th>
                 <th className="border border-gray-500 dark:border-slate-600 p-1">A deduzir</th>
               </tr>
             </thead>
             <tbody className="text-slate-950 dark:text-white transition-colors">
               {config.irTable.map((row, idx) => (
                   <tr key={idx} className="bg-white dark:bg-slate-900">
                     <td className="border border-gray-300 dark:border-slate-800 p-1 font-bold text-slate-950 dark:text-slate-400">
                        Aliq. {idx + 1}
                     </td>
                     <td className="border border-gray-300 dark:border-slate-800 p-1">
                        {idx === 0 ? '-' : (
                            <InputMoney disabled={true} value={row.startValue} onChange={(v) => handleTableChange('irTable', idx, 'startValue', v)} />
                        )}
                     </td>
                     <td className="border border-gray-300 dark:border-slate-800 p-1">
                         {row.limit === null ? '-' : (
                            <InputMoney disabled={true} value={row.limit} onChange={(v) => handleTableChange('irTable', idx, 'limit', v)} />
                         )}
                     </td>
                     <td className="border border-gray-300 dark:border-slate-800 p-1">
                        <input 
                            type="number" 
                            step="0.01" 
                            disabled={true}
                            value={(row.rate * 100).toFixed(2)} 
                            onChange={(e) => handleTableChange('irTable', idx, 'rate', parseFloat(e.target.value)/100)} 
                            className={`w-12 text-center bg-transparent transition-colors text-gray-600 dark:text-slate-500`}
                        />%
                     </td>
                     <td className="border border-gray-300 dark:border-slate-800 p-1">
                        <InputMoney disabled={true} value={row.deduction} onChange={(v) => handleTableChange('irTable', idx, 'deduction', v)} />
                     </td>
                   </tr>
               ))}
             </tbody>
           </table>
        </div>

        <div>
           <div className={`text-white font-bold text-center py-1 flex justify-center items-center px-4 gap-2 transition-colors bg-gray-700 dark:bg-slate-800`}>
              <span>TABELA INSS</span>
           </div>
           <table className="w-full text-center border-collapse text-xs">
             <thead className="bg-gray-400 dark:bg-slate-700 font-bold text-slate-950 dark:text-white transition-colors">
               <tr>
                 <th className="border border-gray-500 dark:border-slate-600 p-1">Descrição</th>
                 <th className="border border-gray-500 dark:border-slate-600 p-1">V. Inicial</th>
                 <th className="border border-gray-500 dark:border-slate-600 p-1">V. Final</th>
                 <th className="border border-gray-500 dark:border-slate-600 p-1">%</th>
                 <th className="border border-gray-500 dark:border-slate-600 p-1">A deduzir</th>
               </tr>
             </thead>
             <tbody className="text-slate-950 dark:text-white transition-colors">
               {config.inssTable.map((row, idx) => (
                   <tr key={idx} className="bg-white dark:bg-slate-900">
                     <td className="border border-gray-300 dark:border-slate-800 p-1 font-bold text-slate-950 dark:text-slate-400">
                        Aliq. {idx + 1}
                     </td>
                     <td className="border border-gray-300 dark:border-slate-800 p-1">
                        {idx === 0 ? '-' : (
                            <InputMoney disabled={true} value={row.startValue} onChange={(v) => handleTableChange('inssTable', idx, 'startValue', v)} />
                        )}
                     </td>
                     <td className="border border-gray-300 dark:border-slate-800 p-1">
                        <InputMoney disabled={true} value={row.limit || 0} onChange={(v) => handleTableChange('inssTable', idx, 'limit', v)} />
                     </td>
                     <td className="border border-gray-300 dark:border-slate-800 p-1">
                        <input 
                            type="number" 
                            step="0.01" 
                            disabled={true}
                            value={(row.rate * 100).toFixed(2)} 
                            onChange={(e) => handleTableChange('inssTable', idx, 'rate', parseFloat(e.target.value)/100)} 
                            className={`w-12 text-center bg-transparent transition-colors text-gray-600 dark:text-slate-500`}
                        />%
                     </td>
                     <td className="border border-gray-300 dark:border-slate-800 p-1">
                        <InputMoney disabled={true} value={row.deduction} onChange={(v) => handleTableChange('inssTable', idx, 'deduction', v)} />
                     </td>
                   </tr>
               ))}
             </tbody>
           </table>
        </div>
      </div>
    </div>
  );
};

export default DataReference;
