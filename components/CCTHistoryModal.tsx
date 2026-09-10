
import React, { useState, useEffect } from 'react';
import { X, Calendar, DollarSign, Utensils, Percent, Briefcase, Save, Check, Clock, Globe, Plus, Award, FileText } from 'lucide-react';
import { CCT_HISTORY_DATA } from '../constants';
import { CCTConfigData } from '../types';

interface CCTHistoryModalProps {
  onClose: () => void;
  onSave?: (data: CCTConfigData[]) => void;
  initialData?: CCTConfigData[];
  initialView?: 'CCT' | 'EXTRA';
}

const CCTHistoryModal: React.FC<CCTHistoryModalProps> = ({ onClose, onSave, initialData, initialView = 'CCT' }) => {
  const [historyData, setHistoryData] = useState<CCTConfigData[]>(() => {
      // Use provided initialData or fallback to constant deep clone
      return initialData ? JSON.parse(JSON.stringify(initialData)) : JSON.parse(JSON.stringify(CCT_HISTORY_DATA));
  });
  
  // Default to the last one (most recent usually) or the first one
  const [activeTabId, setActiveTabId] = useState<string>(historyData.length > 0 ? historyData[historyData.length - 1].id : '');
  const [activeView, setActiveView] = useState<'CCT' | 'EXTRA'>(initialView);
  const [hasChanges, setHasChanges] = useState(false);

  const activeConfigIndex = historyData.findIndex(c => c.id === activeTabId);
  const activeConfig = historyData[activeConfigIndex] || historyData[0];
  
  // Find Previous Config for calculation validations (Hourly Rates)
  const prevConfig = activeConfigIndex > 0 ? historyData[activeConfigIndex - 1] : null;

  const handleUpdate = (path: string, value: any) => {
      const newHistory = [...historyData];
      const configIndex = newHistory.findIndex(c => c.id === activeTabId);
      if (configIndex === -1) return;

      const config = { ...newHistory[configIndex] };
      
      const keys = path.split('.');
      let current: any = config;
      
      // Navigate to the nested object
      for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) current[keys[i]] = {}; 
          current = current[keys[i]];
      }
      
      // Update the specific value requested
      current[keys[keys.length - 1]] = value;

      // === AUTO-CALCULATION LOGIC ===
      // If updating INPC or Other Correction, automatically recalculate Salaries and Hours based on PREVIOUS CCT
      if ((path === 'inpc' || path === 'otherCorrection') && configIndex > 0) {
          const previousCCT = historyData[configIndex - 1]; // Get baseline from previous year
          
          if (previousCCT) {
              const totalFactor = 1 + config.inpc + config.otherCorrection;
              
              // Recalculate Base Salaries
              config.salary = {
                  cmte: previousCCT.salary.cmte * totalFactor,
                  fo: previousCCT.salary.fo * totalFactor,
                  mecanico: previousCCT.salary.mecanico * totalFactor,
                  comissario: previousCCT.salary.comissario * totalFactor
              };

              // Recalculate Hourly Rates
              if (previousCCT.hours) {
                  config.hours = {
                      flightHour: previousCCT.hours.flightHour * totalFactor,
                      simulatorHour: previousCCT.hours.simulatorHour * totalFactor,
                      groundHour: previousCCT.hours.groundHour * totalFactor
                  };
              }

              // Recalculate Gratifications (Fixed Values)
              if (previousCCT.fixedValues && config.fixedValues) {
                  Object.keys(previousCCT.fixedValues).forEach(key => {
                      // Skip PERICULOSIDADE_PERCENT as it is a rate, not an amount
                      if (key === 'PERICULOSIDADE_PERCENT') return;
                      // @ts-ignore
                      config.fixedValues[key] = previousCCT.fixedValues[key] * totalFactor;
                  });
              }
          }
      }
      // ==============================
      
      newHistory[configIndex] = config;
      setHistoryData(newHistory);
      setHasChanges(true);
  };

  const handleAddCCT = () => {
      const lastCCT = historyData[historyData.length - 1];
      let newId = '', newLabel = '', newPeriod = '';

      // Tentar inferir a próxima sequência baseada no ID anterior (ex: cct_25_26 -> cct_26_27)
      const idMatch = lastCCT.id.match(/cct_(\d+)_(\d+)/);
      
      if (idMatch) {
          const s = parseInt(idMatch[1]);
          const e = parseInt(idMatch[2]);
          newId = `cct_${s+1}_${e+1}`;
          newLabel = `CCT ${s+1}-${e+1}`;
          
          // Tentar inferir o período baseado no texto anterior (ex: "Dez 2025 a Nov 2026")
          const pMatch = lastCCT.period.match(/(\d{4}).*(\d{4})/);
          if (pMatch) {
               const ps = parseInt(pMatch[1]);
               const pe = parseInt(pMatch[2]);
               newPeriod = `Dez ${ps+1} a Nov ${pe+1}`;
          } else {
               newPeriod = `Dez 20${s+1} a Nov 20${e+1}`;
          }
      } else {
          // Fallback se não conseguir parsear (ex: baseada no ano atual)
          const now = new Date();
          const y = now.getFullYear();
          newId = `cct_${String(y).slice(-2)}_${String(y+1).slice(-2)}`;
          newLabel = `CCT ${String(y).slice(-2)}-${String(y+1).slice(-2)}`;
          newPeriod = `Dez ${y} a Nov ${y+1}`;
      }

      // Criar nova config copiando TODOS os dados da última
      // Ao criar, resetamos as correções para 0, para que o usuário insira o novo reajuste
      // e o cálculo automático (definido no handleUpdate) faça o trabalho.
      const newCCT: CCTConfigData = {
          ...JSON.parse(JSON.stringify(lastCCT)), // Deep clone
          id: newId,
          label: newLabel,
          period: newPeriod,
          inpc: 0,
          otherCorrection: 0
      };

      const newHistory = [...historyData, newCCT];
      setHistoryData(newHistory);
      setActiveTabId(newId);
      setHasChanges(true);
  };

  const handleSave = () => {
      if (onSave) onSave(historyData);
      setHasChanges(false);
      alert('Alterações salvas e aplicadas na sessão atual.');
      onClose();
  };

  const formatPercent = (val: number) => {
      return (val * 100).toFixed(2) + '%';
  };

  // --- INPUT COMPONENTS ---

  const InputMoney = ({ value, onChange, label, min }: { value: number, onChange: (v: number) => void, label?: string, min?: number }) => {
    const [localVal, setLocalVal] = useState(value ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00');

    useEffect(() => {
        setLocalVal(value ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00');
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalVal(e.target.value);
    };

    const handleBlur = () => {
        const normalized = localVal.replace(/\./g, '').replace(',', '.');
        let numeric = parseFloat(normalized);

        if (isNaN(numeric)) numeric = 0;
        
        // Validation: Cannot be lower than min if specified
        if (min !== undefined && numeric < min) {
            // alert(`O valor não pode ser menor que o mínimo calculado pelo reajuste (R$ ${min.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`);
            // Removing strict alert to allow manual overrides if really necessary, but defaulting to calc logic usually
            // numeric = min; 
        }

        onChange(numeric);
        setLocalVal(numeric.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    };

    return (
        <div className="flex flex-col w-full">
            {label && <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase mb-0.5 truncate" title={label}>{label}</span>}
            <div className="relative">
                <span className="absolute left-2 top-1.5 text-gray-500 dark:text-slate-400 text-xs font-bold">R$</span>
                <input 
                    type="text" 
                    value={localVal}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="w-full pl-7 pr-2 py-1 text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded focus:ring-1 focus:ring-blue-500 outline-none text-right shadow-sm"
                />
            </div>
        </div>
    );
  };

  const InputGenericMoney = ({ value, onChange, currency, label }: { value: number, onChange: (v: number) => void, currency: string, label?: string }) => {
    const [localVal, setLocalVal] = useState(value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

    useEffect(() => {
         setLocalVal(value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalVal(e.target.value);
    };

    const handleBlur = () => {
        const normalized = localVal.replace(/\./g, '').replace(',', '.');
        const numeric = parseFloat(normalized);
        if (!isNaN(numeric)) {
            onChange(numeric);
            setLocalVal(numeric.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        } else {
            setLocalVal(value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        }
    };

    const getSymbol = () => {
        switch(currency) {
            case 'USD': return '$';
            case 'EUR': return '€';
            case 'GBP': return '£';
            default: return '$';
        }
    };

    return (
        <div className="flex flex-col w-full">
            {label && <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase mb-0.5 truncate" title={label}>{label}</span>}
            <div className="relative">
                <span className="absolute left-2 top-1.5 text-gray-500 dark:text-slate-400 text-xs font-bold">{getSymbol()}</span>
                <input 
                    type="text" 
                    value={localVal}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="w-full pl-6 pr-2 py-1 text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded focus:ring-1 focus:ring-blue-500 outline-none text-right shadow-sm"
                />
            </div>
        </div>
    );
  };

  const InputPercent = ({ value, onChange, label }: { value: number, onChange: (v: number) => void, label?: string }) => {
    const [localVal, setLocalVal] = useState((value * 100).toFixed(2));

    useEffect(() => {
        setLocalVal((value * 100).toFixed(2));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalVal(e.target.value);
    };

    const handleBlur = () => {
        const numeric = parseFloat(localVal);
        if (!isNaN(numeric)) {
            onChange(numeric / 100);
            setLocalVal(numeric.toFixed(2));
        } else {
            setLocalVal((value * 100).toFixed(2));
        }
    };

    return (
        <div className="flex flex-col w-full">
            {label && <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase mb-0.5 truncate">{label}</span>}
            <div className="relative">
                <input 
                    type="number" 
                    step="0.01"
                    value={localVal}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="w-full pl-2 pr-6 py-1 text-base font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded focus:ring-1 focus:ring-blue-500 outline-none text-center shadow-sm"
                />
                <span className="absolute right-3 top-1.5 text-gray-500 dark:text-slate-400 text-xs font-bold">%</span>
            </div>
        </div>
    );
  };

  const InputNumber = ({ value, onChange, label }: { value: number, onChange: (v: number) => void, label?: string }) => {
    return (
        <div className="flex flex-col w-full">
            {label && <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase mb-0.5 truncate">{label}</span>}
            <div className="relative">
                <input 
                    type="number" 
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded focus:ring-1 focus:ring-blue-500 outline-none shadow-sm"
                />
            </div>
        </div>
    );
  };

  // Calculate Min Hourly Rates for Validation
  const totalCorrection = activeConfig.inpc + activeConfig.otherCorrection;
  const factor = 1 + totalCorrection;
  
  // Use previous config values as base, or hardcoded defaults if first
  const minFlightHour = prevConfig ? (prevConfig.hours?.flightHour || 140) * factor : 140;
  const minSimHour = prevConfig ? (prevConfig.hours?.simulatorHour || 122) * factor : 122;
  const minGroundHour = prevConfig ? (prevConfig.hours?.groundHour || 50) * factor : 50;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-[95vw] h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="p-3 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-blue-600" />
              Gestão de Parâmetros Históricos
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Configure as Convenções Coletivas e Acordos Específicos.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
                <button 
                    onClick={handleSave}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold shadow-sm transition-all animate-pulse"
                >
                    <Save className="w-4 h-4" />
                    Salvar
                </button>
            )}
            <button 
                onClick={onClose}
                className="p-2 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-full transition-colors text-gray-500"
            >
                <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-56 bg-gray-50 dark:bg-slate-950 border-r border-gray-200 dark:border-slate-800 flex flex-col flex-shrink-0">
            <div className="overflow-y-auto p-3 space-y-2 flex-1 custom-scrollbar">
                {historyData.map((cct) => (
                <button
                    key={cct.id}
                    onClick={() => setActiveTabId(cct.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all border relative ${
                    activeTabId === cct.id 
                        ? 'bg-white dark:bg-slate-800 border-blue-500 shadow-md ring-1 ring-blue-500' 
                        : 'border-transparent hover:bg-gray-200 dark:hover:bg-slate-900 text-gray-600 dark:text-slate-400'
                    }`}
                >
                    <div className="font-bold text-slate-900 dark:text-white text-xs">{cct.label}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1 truncate">
                    <Calendar className="w-3 h-3" /> {cct.period}
                    </div>
                    {activeTabId === cct.id && (
                        <div className="absolute right-2 top-2 text-blue-500">
                            <Check className="w-3 h-3" />
                        </div>
                    )}
                </button>
                ))}
            </div>
            {/* Botão Adicionar CCT */}
            <div className="p-3 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950">
                <button
                    onClick={handleAddCCT}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Nova CCT
                </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 flex flex-col bg-gray-100 dark:bg-slate-900 overflow-hidden">
            
            {/* TAB HEADER */}
            <div className="flex bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 pt-2">
                <button 
                    onClick={() => setActiveView('CCT')}
                    className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeView === 'CCT' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                    <FileText className="w-4 h-4" />
                    Convenção Coletiva (CCT)
                </button>
                <button 
                    onClick={() => setActiveView('EXTRA')}
                    className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeView === 'EXTRA' ? 'border-pink-600 text-pink-600 dark:text-pink-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                    <Award className="w-4 h-4" />
                    Gratificações e Adicionais
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                
                {activeView === 'CCT' && (
                    <div className="grid grid-cols-12 gap-4 animate-in fade-in slide-in-from-left-4 duration-300">
                        {/* 1. SECTION: REAJUSTE & SALÁRIOS */}
                        <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
                            {/* Reajuste */}
                            <section className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm h-full">
                                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold uppercase text-xs tracking-wider mb-3 border-b border-blue-100 dark:border-blue-900/50 pb-1">
                                    <Percent className="w-3 h-3" /> Reajuste
                                </div>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2">
                                        <InputPercent label="INPC" value={activeConfig.inpc} onChange={(v) => handleUpdate('inpc', v)} />
                                        <InputPercent label="Outra" value={activeConfig.otherCorrection} onChange={(v) => handleUpdate('otherCorrection', v)} />
                                    </div>
                                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-2 text-center">
                                        <span className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-bold">Total Acumulado</span>
                                        <div className="text-xl font-black text-blue-800 dark:text-blue-300">
                                            {formatPercent(activeConfig.inpc + activeConfig.otherCorrection)}
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <div className="col-span-12 lg:col-span-5 flex flex-col gap-4">
                            {/* Piso Salarial */}
                            <section className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-bold uppercase text-xs tracking-wider mb-3 border-b border-green-100 dark:border-green-900/50 pb-1">
                                    <DollarSign className="w-3 h-3" /> Piso Salarial Base
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                    <InputMoney label="Comandante" value={activeConfig.salary.cmte} onChange={(v) => handleUpdate('salary.cmte', v)} />
                                    <InputMoney label="Copiloto" value={activeConfig.salary.fo} onChange={(v) => handleUpdate('salary.fo', v)} />
                                    <InputMoney label="Mecânico" value={activeConfig.salary.mecanico} onChange={(v) => handleUpdate('salary.mecanico', v)} />
                                    <InputMoney label="Comissário" value={activeConfig.salary.comissario} onChange={(v) => handleUpdate('salary.comissario', v)} />
                                </div>
                            </section>

                            {/* Valores Hora */}
                            <section className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex-1">
                                <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400 font-bold uppercase text-xs tracking-wider mb-3 border-b border-purple-100 dark:border-purple-900/50 pb-1">
                                    <Clock className="w-3 h-3" /> Valor Hora (CMTE)
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <InputMoney label="Voo" value={activeConfig.hours?.flightHour || minFlightHour} onChange={(v) => handleUpdate('hours.flightHour', v)} min={minFlightHour} />
                                    <InputMoney label="Simulador" value={activeConfig.hours?.simulatorHour || minSimHour} onChange={(v) => handleUpdate('hours.simulatorHour', v)} min={minSimHour} />
                                    <InputMoney label="Solo" value={activeConfig.hours?.groundHour || minGroundHour} onChange={(v) => handleUpdate('hours.groundHour', v)} min={minGroundHour} />
                                </div>
                            </section>
                        </div>

                        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
                            {/* Vale Alimentação */}
                            <section className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                                <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400 font-bold uppercase text-xs tracking-wider mb-3 border-b border-orange-100 dark:border-orange-900/50 pb-1">
                                    <Utensils className="w-3 h-3" /> Vale Alimentação
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-2">
                                    <InputMoney label="Valor Mensal" value={activeConfig.valeAlimentacao.value} onChange={(v) => handleUpdate('valeAlimentacao.value', v)} />
                                    <InputMoney label="Teto Salarial" value={activeConfig.valeAlimentacao.threshold} onChange={(v) => handleUpdate('valeAlimentacao.threshold', v)} />
                                </div>
                                <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-900 p-2 rounded">
                                    <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400">Pagamento Independente?</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer"
                                        checked={activeConfig.valeAlimentacao.payIndependently}
                                        onChange={(e) => handleUpdate('valeAlimentacao.payIndependently', e.target.checked)}
                                    />
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                            </section>

                            {/* Diversos */}
                            <section className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex-1">
                                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-400 font-bold uppercase text-xs tracking-wider mb-3 border-b border-gray-100 dark:border-gray-700 pb-1">
                                    <Calendar className="w-3 h-3" /> Diversos
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <InputNumber label="Mult. DSR (Dias)" value={activeConfig.dsrMultiplier} onChange={(v) => handleUpdate('dsrMultiplier', v)} />
                                    <div>
                                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase mb-1 block">Férias</span>
                                        <div className="flex gap-1">
                                            <span className="px-2 py-1 bg-gray-100 dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600 text-xs font-bold">15d</span>
                                            <span className="px-2 py-1 bg-gray-100 dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600 text-xs font-bold">30d</span>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* DIÁRIAS (BOTTOM ROW) */}
                        <div className="col-span-12 lg:col-span-4">
                            {/* Nacional */}
                            <section className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm h-full">
                                <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-bold uppercase text-xs tracking-wider mb-3 border-b border-indigo-100 dark:border-indigo-900/50 pb-1">
                                    <Utensils className="w-3 h-3" /> Diária Nacional
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <InputMoney label="Café" value={activeConfig.diarias.nacional.breakfast} onChange={(v) => handleUpdate('diarias.nacional.breakfast', v)} />
                                    <InputMoney label="Almoço" value={activeConfig.diarias.nacional.lunch} onChange={(v) => handleUpdate('diarias.nacional.lunch', v)} />
                                    <InputMoney label="Jantar" value={activeConfig.diarias.nacional.dinner} onChange={(v) => handleUpdate('diarias.nacional.dinner', v)} />
                                    <InputMoney label="Ceia" value={activeConfig.diarias.nacional.supper} onChange={(v) => handleUpdate('diarias.nacional.supper', v)} />
                                </div>
                            </section>
                        </div>

                        <div className="col-span-12 lg:col-span-8">
                            {/* Internacional */}
                            <section className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm h-full">
                                <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-bold uppercase text-xs tracking-wider mb-3 border-b border-indigo-100 dark:border-indigo-900/50 pb-1">
                                    <Globe className="w-3 h-3" /> Diária Internacional
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                    <InputGenericMoney label="Am. Sul" currency="USD" value={activeConfig.diarias.internacional.southAmerica} onChange={(v) => handleUpdate('diarias.internacional.southAmerica', v)} />
                                    <InputGenericMoney label="Am. Norte" currency="USD" value={activeConfig.diarias.internacional.northAmerica} onChange={(v) => handleUpdate('diarias.internacional.northAmerica', v)} />
                                    <InputGenericMoney label="Europa" currency="EUR" value={activeConfig.diarias.internacional.europe} onChange={(v) => handleUpdate('diarias.internacional.europe', v)} />
                                    <InputGenericMoney label="UK" currency="GBP" value={activeConfig.diarias.internacional.uk} onChange={(v) => handleUpdate('diarias.internacional.uk', v)} />
                                    <InputGenericMoney label="Outros" currency="USD" value={activeConfig.diarias.internacional.others} onChange={(v) => handleUpdate('diarias.internacional.others', v)} />
                                </div>
                            </section>
                        </div>
                    </div>
                )}

                {activeView === 'EXTRA' && (
                    <div className="grid grid-cols-12 gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        {/* Summary of Index applied */}
                        <div className="col-span-12 mb-2">
                            <div className="bg-pink-50 dark:bg-pink-900/20 p-3 rounded-lg border border-pink-200 dark:border-pink-800 flex items-center justify-between">
                                <div className="text-sm text-pink-800 dark:text-pink-300 font-medium">
                                    <span className="font-bold">Nota:</span> Estes valores são reajustados automaticamente pelo índice da CCT ({formatPercent(activeConfig.inpc + activeConfig.otherCorrection)}).
                                    Você pode editá-los manualmente abaixo se houver exceções.
                                </div>
                            </div>
                        </div>

                        {/* GRATIFICAÇÕES E ADICIONAIS SECTION */}
                        <div className="col-span-12">
                            <section className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                                <div className="flex items-center gap-2 text-pink-700 dark:text-pink-400 font-bold uppercase text-xs tracking-wider mb-4 border-b border-pink-100 dark:border-pink-900/50 pb-2">
                                    <Award className="w-4 h-4" /> Gratificações e Adicionais (Gerenciável)
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                                    {/* If fixedValues exists (should always exist now), map inputs */}
                                    {activeConfig.fixedValues && (
                                        <>
                                            <InputMoney label="Diária Operacional (D.OPR)" value={activeConfig.fixedValues.D_OPR} onChange={(v) => handleUpdate('fixedValues.D_OPR', v)} />
                                            <InputMoney label="Diária Safety (D.SAFETY)" value={activeConfig.fixedValues.D_SAFETY} onChange={(v) => handleUpdate('fixedValues.D_SAFETY', v)} />
                                            <InputMoney label="Prêmio Chefia (P.CHEFE)" value={activeConfig.fixedValues.P_CHEFE} onChange={(v) => handleUpdate('fixedValues.P_CHEFE', v)} />
                                            <InputMoney label="Diretoria Geral (D.GERAL)" value={activeConfig.fixedValues.D_GERAL} onChange={(v) => handleUpdate('fixedValues.D_GERAL', v)} />
                                            <InputMoney label="Gate Keeper (G.KEEPER)" value={activeConfig.fixedValues.G_KEEPER} onChange={(v) => handleUpdate('fixedValues.G_KEEPER', v)} />
                                            <InputMoney label="Acordo Operacional" value={activeConfig.fixedValues.ACORDO} onChange={(v) => handleUpdate('fixedValues.ACORDO', v)} />
                                            <div className="col-span-2 border-t border-gray-100 dark:border-slate-700 my-2"></div>
                                            <div className="hidden lg:block col-span-2 lg:col-span-3 border-t border-gray-100 dark:border-slate-700 my-2"></div>
                                            
                                            <InputMoney label="Adicional Instrução (TRE/SFE)" value={activeConfig.fixedValues.TRE_SFE} onChange={(v) => handleUpdate('fixedValues.TRE_SFE', v)} />
                                            <InputMoney label="Adicional Instrução (TRI/SFI)" value={activeConfig.fixedValues.TRI_SFI} onChange={(v) => handleUpdate('fixedValues.TRI_SFI', v)} />
                                            <InputMoney label="Folga Deslocada (Unitário)" value={activeConfig.fixedValues.FOLGA_DESLOCADA} onChange={(v) => handleUpdate('fixedValues.FOLGA_DESLOCADA', v)} />
                                            <InputPercent label="Periculosidade (%)" value={activeConfig.fixedValues.PERICULOSIDADE_PERCENT} onChange={(v) => handleUpdate('fixedValues.PERICULOSIDADE_PERCENT', v)} />
                                        </>
                                    )}
                                </div>
                            </section>
                        </div>
                    </div>
                )}

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CCTHistoryModal;
