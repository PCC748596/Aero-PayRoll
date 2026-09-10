
import React, { useMemo, useState } from 'react';
import { LogEntry } from '../types';
import { X, ScrollText, Download, Search } from 'lucide-react';

interface AuditLogModalProps {
  logs: LogEntry[];
  onClose: () => void;
}

const AuditLogModal: React.FC<AuditLogModalProps> = ({ logs, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = useMemo(() => {
      if (!searchTerm) return [...logs].reverse();
      const lower = searchTerm.toLowerCase();
      return [...logs].reverse().filter(l => 
        l.username.toLowerCase().includes(lower) || 
        l.action.toLowerCase().includes(lower) || 
        (l.details && l.details.toLowerCase().includes(lower))
      );
  }, [logs, searchTerm]);

  const handleExportLogs = () => {
      const header = "Timestamp,Username,Action,Details\n";
      const rows = logs.map(l => `"${l.timestamp}","${l.username}","${l.action}","${l.details || ''}"`).join("\n");
      const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(header + rows);
      
      const link = document.createElement("a");
      link.setAttribute("href", csvContent);
      link.setAttribute("download", `aeropayroll_audit_log_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
        
        <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ScrollText className="w-6 h-6 text-indigo-600" />
              Log de Auditoria
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Registro histórico de ações do sistema.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-full text-gray-500">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 bg-gray-100 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex gap-4">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Filtrar logs..."
                    className="w-full pl-9 pr-4 py-2 rounded border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <button 
                onClick={handleExportLogs}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold uppercase flex items-center gap-2"
            >
                <Download className="w-4 h-4" /> Exportar CSV
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-0">
            <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 sticky top-0 z-10">
                    <tr>
                        <th className="p-3 border-b border-gray-200 dark:border-slate-700 font-bold uppercase text-xs">Data/Hora</th>
                        <th className="p-3 border-b border-gray-200 dark:border-slate-700 font-bold uppercase text-xs">Usuário</th>
                        <th className="p-3 border-b border-gray-200 dark:border-slate-700 font-bold uppercase text-xs">Ação</th>
                        <th className="p-3 border-b border-gray-200 dark:border-slate-700 font-bold uppercase text-xs">Detalhes</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {filteredLogs.map(log => (
                        <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="p-3 text-slate-600 dark:text-slate-400 whitespace-nowrap text-xs font-mono">
                                {new Date(log.timestamp).toLocaleString('pt-BR')}
                            </td>
                            <td className="p-3 font-bold text-slate-900 dark:text-white text-xs">
                                {log.username}
                            </td>
                            <td className="p-3">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                    log.action === 'LOGIN' ? 'bg-green-100 text-green-700' :
                                    log.action === 'BACKUP_SAVED' ? 'bg-blue-100 text-blue-700' :
                                    log.action === 'BACKUP_LOADED' ? 'bg-purple-100 text-purple-700' :
                                    log.action === 'USER_ADDED' ? 'bg-pink-100 text-pink-700' :
                                    'bg-gray-100 text-gray-700'
                                }`}>
                                    {log.action}
                                </span>
                            </td>
                            <td className="p-3 text-slate-600 dark:text-slate-400 text-xs break-all">
                                {log.details || '-'}
                            </td>
                        </tr>
                    ))}
                    {filteredLogs.length === 0 && (
                        <tr>
                            <td colSpan={4} className="p-8 text-center text-gray-400 text-sm">
                                Nenhum registro encontrado.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>

      </div>
    </div>
  );
};

export default AuditLogModal;
