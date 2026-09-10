
import React, { useMemo, useState } from 'react';
import { Employee, GlobalConfig, PayrollResult, Holiday, CCTConfigData } from '../types';
import { calculatePayroll } from '../utils/calculationService';
import { getConfigForDate, generateHourlyRates, STANDARD_HOLIDAYS } from '../constants';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

interface PayrollSummaryProps {
  employees: Employee[];
  config: GlobalConfig;
  businessDays: number;
  dsrMultiplier: number;
  hourlyRates: any;
  currentDate: Date;
  ignoredHolidays: string[]; 
  customHolidays: Holiday[];
  cctHistory: CCTConfigData[];
}

const PayrollSummary: React.FC<PayrollSummaryProps> = ({ 
  employees, 
  config, 
  businessDays, 
  dsrMultiplier, 
  hourlyRates,
  currentDate,
  ignoredHolidays = [],
  customHolidays = [],
  cctHistory
}) => {
  const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'role'; direction: 'asc' | 'desc' } | null>({ key: 'name', direction: 'asc' });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  const rawRows = useMemo(() => {
    // CRÍTICO: Competência é (Mês Selecionado - 1).
    // currentDate é a Data de Pagamento.
    const competenceDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const totalDaysInMonth = new Date(competenceDate.getFullYear(), competenceDate.getMonth() + 1, 0).getDate();

    const compConfig = getConfigForDate(competenceDate, cctHistory);
    const compCorrection = compConfig.inpc + (compConfig.otherCorrection || 0);
    const compHourlyRates = generateHourlyRates(compConfig.horaVooAnterior, compCorrection, compConfig.simuladorAnterior, compConfig.horaSoloAnterior);

    // Use passed businessDays prop which reflects the competence month (with manual override support)
    const compBusinessDays = businessDays;

    // Use config defined DSR Multiplier (default 8) instead of potentially unsynced prop
    const effectiveDsrMultiplier = compConfig.dsrMultiplier || 8;

    return employees.map(emp => {
      const result = calculatePayroll(
          emp, 
          compBusinessDays, 
          totalDaysInMonth, 
          compConfig, 
          compHourlyRates, 
          effectiveDsrMultiplier, // FIXED: Use config value
          competenceDate,
          'MONTHLY',
          undefined,
          undefined,
          undefined,
          ignoredHolidays
      );
      const getEarning = (key: string) => {
        const map: Record<string, string> = {
          'diurna': 'Hora diurna', 'noturna': 'Hora noturna', 'espDiurno': 'Hora Esp.Diurno', 'espNoturno': 'Hora Esp. Noturno',
          'reDiurno': 'RE Diurno', 'reNoturna': 'RE Noturna', 'reEspDiurno': 'RE Esp. Diurno', 'reEspNoturno': 'RE Esp. Noturno',
          'saDiurno': 'SA Diurno', 'saNoturna': 'SA Noturna', 'saEspDiurno': 'SA Esp. Diurno', 'saEspNoturno': 'SA Esp. Noturno',
          'simulador': 'SIMULADOR', 'horaSolo': 'HORA DE SOLO',
        };
        const desc = map[key];
        if (desc) {
            const item = result.earnings.find(e => e.description === desc);
            return item ? item.total : 0;
        }
        return 0;
      };
      const getFixed = (descPartial: string) => {
        const item = result.earnings.find(e => e.description.includes(descPartial));
        return item ? item.total : 0;
      };
      return {
        id: emp.id, name: emp.name, role: emp.role, baseSalary: result.employee.baseSalary,
        hDir: getEarning('diurna'), hNot: getEarning('noturna'), hED: getEarning('espDiurno'), hEN: getEarning('espNoturno'),
        rsDir: getEarning('reDiurno'), rsNot: getEarning('reNoturna'), rsED: getEarning('reEspDiurno'), rsEN: getEarning('reEspNoturno'),
        saDir: getEarning('saDiurno'), saNot: getEarning('saNoturna'), saED: getEarning('saEspDiurno'), saEN: getEarning('saEspNoturno'),
        simD: getEarning('simulador'), solo: getEarning('horaSolo'), a330: getFixed('Adicional A330'),
        triTer: getFixed('Adicional TRI') || getFixed('Adicional TRE'), adFuncao: getFixed('AD.FUNÇÃO'),
        peric: getFixed('Periculosidade'), dsr: getFixed('DSR'), total: result.totals.gross,
        inss: result.deductions.find(d => d.description === 'INSS')?.total || 0,
        ir: result.deductions.find(d => d.description === 'IR' || d.description === 'IRRF')?.total || 0,
        liquid: result.totals.net, fgts: result.totals.fgts
      };
    });
  }, [employees, currentDate, ignoredHolidays, customHolidays, cctHistory, businessDays]); 

  const rows = useMemo(() => {
    let sortableItems = [...rawRows];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [rawRows, sortConfig]);

  const requestSort = (key: 'name' | 'role') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ column }: { column: 'name' | 'role' }) => {
    if (sortConfig?.key !== column) return <ArrowUpDown className="w-3 h-3 opacity-50 ml-1" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const totals = useMemo(() => {
    const acc = {
      baseSalary: 0, hDir: 0, hNot: 0, hED: 0, hEN: 0, rsDir: 0, rsNot: 0, rsED: 0, rsEN: 0,
      saDir: 0, saNot: 0, saED: 0, saEN: 0, simD: 0, solo: 0, a330: 0, triTer: 0, adFuncao: 0,
      peric: 0, dsr: 0, total: 0, inss: 0, ir: 0, liquid: 0, fgts: 0
    };
    rawRows.forEach(r => {
      acc.baseSalary += r.baseSalary; acc.hDir += r.hDir; acc.hNot += r.hNot; acc.hED += r.hED; acc.hEN += r.hEN;
      acc.rsDir += r.rsDir; acc.rsNot += r.rsNot; acc.rsED += r.rsED; acc.rsEN += r.rsEN;
      acc.saDir += r.saDir; acc.saNot += r.saNot; acc.saED += r.saED; acc.saEN += r.saEN;
      acc.simD += r.simD; acc.solo += r.solo; acc.a330 += r.a330; acc.triTer += r.triTer;
      acc.adFuncao += r.adFuncao; acc.peric += r.peric; acc.dsr += r.dsr; acc.total += r.total;
      acc.inss += r.inss; acc.ir += r.ir; acc.liquid += r.liquid; acc.fgts += r.fgts;
    });
    return acc;
  }, [rawRows]);

  const CellMoney = ({ val, bold = false, red = false, bg = false }: { val: number, bold?: boolean, red?: boolean, bg?: boolean }) => {
    const isZero = val === 0;
    let colorClass = bg ? 'bg-black text-white dark:bg-slate-950 dark:text-emerald-400' : (red ? (isZero ? 'text-gray-400 dark:text-slate-600' : 'text-red-600 dark:text-red-400') : (isZero ? 'text-gray-400 dark:text-slate-600' : 'text-slate-950 dark:text-slate-200'));
    return (
      <td className={`px-1 py-1 text-right whitespace-nowrap border-r border-gray-300 dark:border-slate-800 transition-colors ${bold || val > 0 ? 'font-bold' : ''} ${colorClass}`}>
        {formatCurrency(val)}
      </td>
    );
  };

  return (
    <>
    {/* Style block specifically for printing scaling */}
    <style>{`
      @media print {
        .payroll-summary-table-container {
          zoom: 0.40;
          overflow: visible !important;
        }
      }
    `}</style>
    <div className="payroll-summary-table-container overflow-x-auto print:overflow-visible shadow-sm border border-gray-300 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors">
      <table className="w-full text-[10px] md:text-xs border-collapse">
        <thead>
          <tr className="bg-green-600 dark:bg-emerald-900 text-white font-bold uppercase text-center transition-colors">
            <th className="px-2 py-2 text-left sticky left-0 bg-green-600 dark:bg-emerald-900 z-10 border-r border-white/20 cursor-pointer hover:bg-green-500 dark:hover:bg-emerald-800 transition-colors group select-none" onClick={() => requestSort('name')}>
              <div className="flex items-center justify-between gap-1">Funcionário <SortIcon column="name" /></div>
            </th>
            <th className="px-1 py-2 border-r border-white/20 cursor-pointer hover:bg-green-500 dark:hover:bg-emerald-800 transition-colors group select-none" onClick={() => requestSort('role')}>
              <div className="flex items-center justify-center gap-1">Cargo <SortIcon column="role" /></div>
            </th>
            <th className="px-1 py-2 border-r border-white/20">S.Base</th>
            <th className="px-1 py-2 border-r border-white/20">H.Dir</th>
            <th className="px-1 py-2 border-r border-white/20">H.Not</th>
            <th className="px-1 py-2 border-r border-white/20">H.E.D</th>
            <th className="px-1 py-2 border-r border-white/20">H.E.N</th>
            <th className="px-1 py-2 border-r border-white/20">RS.Dir</th>
            <th className="px-1 py-2 border-r border-white/20">RS.Not</th>
            <th className="px-1 py-2 border-r border-white/20">RS.E.D</th>
            <th className="px-1 py-2 border-r border-white/20">RS.E.N</th>
            <th className="px-1 py-2 border-r border-white/20">SA.Dir</th>
            <th className="px-1 py-2 border-r border-white/20">SA.Not</th>
            <th className="px-1 py-2 border-r border-white/20">SA.E.D</th>
            <th className="px-1 py-2 border-r border-white/20">SA.E.N</th>
            <th className="px-1 py-2 border-r border-white/20">Sim.D</th>
            <th className="px-1 py-2 border-r border-white/20">Solo</th>
            <th className="px-1 py-2 border-r border-white/20">A330</th>
            <th className="px-1 py-2 border-r border-white/20">TRI-TER</th>
            <th className="px-1 py-2 border-r border-white/20">AD.Função</th>
            <th className="px-1 py-2 border-r border-white/20">Peric</th>
            <th className="px-1 py-2 border-r border-white/20">DSR</th>
            <th className="px-1 py-2 border-r border-white/20 bg-green-800 dark:bg-emerald-950">Total</th>
            <th className="px-1 py-2 border-r border-white/20">INSS</th>
            <th className="px-1 py-2 border-r border-white/20">IR</th>
            <th className="px-1 py-2 border-r border-white/20 bg-green-800 dark:bg-emerald-950">Liquido</th>
            <th className="px-1 py-2 bg-green-700 dark:bg-emerald-900">FGTS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-slate-800 transition-colors">
          {rows.map((row, idx) => (
            <tr key={row.id} className={`${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-green-50 dark:bg-emerald-950/20'} hover:bg-gray-100 dark:hover:bg-slate-800/50 transition-colors`}>
              <td className="px-2 py-1 font-bold sticky left-0 bg-inherit border-r border-gray-300 dark:border-slate-800 truncate max-w-[150px] text-slate-950 dark:text-white transition-colors">{row.name}</td>
              <td className="px-1 py-1 text-center border-r border-gray-300 dark:border-slate-800 transition-colors text-slate-950 dark:text-slate-200">{row.role}</td>
              <CellMoney val={row.baseSalary} bold />
              <CellMoney val={row.hDir} /><CellMoney val={row.hNot} /><CellMoney val={row.hED} /><CellMoney val={row.hEN} />
              <CellMoney val={row.rsDir} /><CellMoney val={row.rsNot} /><CellMoney val={row.rsED} /><CellMoney val={row.rsEN} />
              <CellMoney val={row.saDir} /><CellMoney val={row.saNot} /><CellMoney val={row.saED} /><CellMoney val={row.saEN} />
              <CellMoney val={row.simD} /><CellMoney val={row.solo} /><CellMoney val={row.a330} /><CellMoney val={row.triTer} />
              <CellMoney val={row.adFuncao} /><CellMoney val={row.peric} /><CellMoney val={row.dsr} /><CellMoney val={row.total} bold />
              <CellMoney val={row.inss} red /><CellMoney val={row.ir} red /><CellMoney val={row.liquid} bold /><CellMoney val={row.fgts} red />
            </tr>
          ))}
          <tr className="bg-white dark:bg-slate-900 font-bold border-t-2 border-black dark:border-slate-950 text-[10px] md:text-xs transition-colors">
            <td className="px-2 py-2 text-right sticky left-0 bg-white dark:bg-slate-900 border-r border-gray-300 dark:border-slate-800 transition-colors text-slate-950 dark:text-white" colSpan={2}>TOTAL</td>
            <CellMoney val={totals.baseSalary} />
            <CellMoney val={totals.hDir} /><CellMoney val={totals.hNot} /><CellMoney val={totals.hED} /><CellMoney val={totals.hEN} />
            <CellMoney val={totals.rsDir} /><CellMoney val={totals.rsNot} /><CellMoney val={totals.rsED} /><CellMoney val={totals.rsEN} />
            <CellMoney val={totals.saDir} /><CellMoney val={totals.saNot} /><CellMoney val={totals.saED} /><CellMoney val={totals.saEN} />
            <CellMoney val={totals.simD} /><CellMoney val={totals.solo} /><CellMoney val={totals.a330} /><CellMoney val={totals.triTer} />
            <CellMoney val={totals.adFuncao} /><CellMoney val={totals.peric} /><CellMoney val={totals.dsr} /><CellMoney val={totals.total} bg />
            <CellMoney val={totals.inss} red /><CellMoney val={totals.ir} red /><CellMoney val={totals.liquid} bg /><CellMoney val={totals.fgts} red />
          </tr>
        </tbody>
      </table>
    </div>
    </>
  );
};

export default PayrollSummary;
