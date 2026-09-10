
import React, { useState } from 'react';
import { AppUser, UserRole } from '../types';
import { X, UserPlus, Trash2, Shield, User } from 'lucide-react';

interface UserManagementModalProps {
  users: AppUser[];
  onAddUser: (user: AppUser) => void;
  onRemoveUser: (username: string) => void;
  onClose: () => void;
  currentUser: AppUser;
}

const UserManagementModal: React.FC<UserManagementModalProps> = ({ users, onAddUser, onRemoveUser, onClose, currentUser }) => {
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('VIEWER');
  const [error, setError] = useState('');

  const handleAdd = () => {
    setError('');
    if (!newUsername || !newPassword) {
        setError('Preencha usuário e senha.');
        return;
    }
    if (users.find(u => u.username.toLowerCase() === newUsername.toLowerCase())) {
        setError('Usuário já existe.');
        return;
    }

    const newUser: AppUser = {
        username: newUsername,
        password: btoa(newPassword), // Simple encoding
        role: newRole,
        createdAt: new Date().toISOString()
    };

    onAddUser(newUser);
    setNewUsername('');
    setNewPassword('');
    setNewRole('VIEWER');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
        
        <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-6 h-6 text-blue-600" />
              Gestão de Usuários
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Gerencie o acesso ao sistema.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-full text-gray-500">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 bg-gray-100 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-gray-600 dark:text-gray-300 uppercase mb-2">Adicionar Novo Usuário</h3>
            <div className="grid grid-cols-2 gap-2 mb-2">
                <input 
                    type="text" 
                    placeholder="Usuário (Ex: j.silva)"
                    className="p-2 rounded border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                />
                <input 
                    type="password" 
                    placeholder="Senha"
                    className="p-2 rounded border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                />
            </div>
            <div className="flex gap-2">
                <select 
                    className="flex-1 p-2 rounded border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                >
                    <option value="VIEWER">VIEWER (Somente Leitura)</option>
                    <option value="EDITOR">EDITOR (Leitura e Escrita)</option>
                    <option value="MASTER">MASTER (Administrador)</option>
                </select>
                <button 
                    onClick={handleAdd}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs uppercase flex items-center gap-2"
                >
                    <UserPlus className="w-4 h-4" /> Adicionar
                </button>
            </div>
            {error && <p className="text-red-500 text-xs mt-2 font-bold">{error}</p>}
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-slate-900">
            <h3 className="text-sm font-bold text-gray-600 dark:text-gray-300 uppercase mb-2">Usuários Cadastrados</h3>
            <div className="space-y-2">
                {users.map(u => (
                    <div key={u.username} className="flex justify-between items-center p-3 border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-800/50">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${u.role === 'MASTER' ? 'bg-purple-100 text-purple-600' : (u.role === 'EDITOR' ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-600')}`}>
                                {u.role === 'MASTER' ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 dark:text-white">{u.username}</p>
                                <p className="text-[10px] uppercase font-bold text-gray-500">{u.role}</p>
                            </div>
                        </div>
                        
                        {u.username !== currentUser.username && u.username !== 'p.costa' && (
                            <button 
                                onClick={() => onRemoveUser(u.username)}
                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                title="Remover Usuário"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                        {u.username === currentUser.username && <span className="text-xs text-green-600 font-bold px-2">Você</span>}
                    </div>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
};

export default UserManagementModal;
