
import React, { useState } from 'react';
import { Plane, Lock, Eye, EyeOff, AlertCircle, User } from 'lucide-react';
import { AppUser } from '../types';

interface LoginProps {
  onLogin: (user: AppUser) => void;
  users: AppUser[];
  darkMode: boolean;
}

const Login: React.FC<LoginProps> = ({ onLogin, users, darkMode }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);

    // Pequeno delay para simular processamento e melhorar UX
    setTimeout(() => {
      const inputUser = username.trim();
      const inputPass = password.trim();
      const inputPassB64 = btoa(inputPass); // Client-side simple match

      const matchedUser = users.find(u => 
          u.username.toLowerCase() === inputUser.toLowerCase() && 
          u.password === inputPassB64
      );
      
      if (matchedUser) {
        onLogin(matchedUser);
      } else {
        setError(true);
        setLoading(false);
      }
    }, 400);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-slate-950 p-4 transition-colors duration-200 font-sans">
      <div className="w-full max-w-md">
        <div className={`bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-slate-800 overflow-hidden transition-all duration-300 ${error ? 'ring-2 ring-red-500 animate-shake' : ''}`}>
          
          <style>{`
            @keyframes shake {
              0%, 100% { transform: translateX(0); }
              20% { transform: translateX(-10px); }
              40% { transform: translateX(10px); }
              60% { transform: translateX(-10px); }
              80% { transform: translateX(10px); }
            }
            .animate-shake { animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
          `}</style>

          {/* Top Banner */}
          <div className="bg-slate-900 dark:bg-black p-10 text-center border-b-4 border-yellow-400 relative overflow-hidden">
            {/* Decorative element */}
            <div className="absolute -right-4 -top-4 opacity-10">
                <Plane className="w-32 h-32 text-white rotate-45" />
            </div>
            
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-yellow-400 mb-6 shadow-xl transform hover:rotate-12 transition-transform duration-500">
              <Plane className="h-10 w-10 text-slate-900" />
            </div>
            
            <h1 className="text-3xl font-extrabold text-white tracking-tighter">
              AeroPayroll <span className="text-yellow-400 font-light">Manager</span>
            </h1>
            <div className="mt-2 inline-block px-3 py-1 bg-slate-800 rounded-full">
                <p className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-black">Sistema de Controle de Folha</p>
            </div>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-10 space-y-6">
            <div className="space-y-4">
              
              {/* Username Input */}
              <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest">
                    Usuário
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-500 text-gray-400">
                      <User className="h-5 w-5" />
                    </div>
                    <input
                      type="text"
                      required
                      autoFocus
                      className="block w-full pl-12 pr-4 py-4 border-2 rounded-2xl bg-gray-50 dark:bg-slate-800 text-slate-900 dark:text-white border-gray-200 dark:border-slate-700 focus:ring-4 focus:ring-blue-400/20 focus:border-blue-400 outline-none transition-all duration-300 text-lg font-medium"
                      placeholder="seu.usuario"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if(error) setError(false);
                      }}
                    />
                  </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <label className="text-xs font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest">
                      Senha
                    </label>
                    {error && <span className="text-[10px] font-bold text-red-500 uppercase animate-pulse">Dados inválidos</span>}
                  </div>
                  
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-yellow-500 text-gray-400">
                      <Lock className="h-5 w-5" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      className={`block w-full pl-12 pr-12 py-4 border-2 rounded-2xl bg-gray-50 dark:bg-slate-800 text-slate-900 dark:text-white border-gray-200 dark:border-slate-700 focus:ring-4 focus:ring-yellow-400/20 focus:border-yellow-400 outline-none transition-all duration-300 text-lg font-medium ${error ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : ''}`}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if(error) setError(false);
                      }}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-yellow-500 transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 dark:bg-black hover:bg-slate-800 dark:hover:bg-slate-950 text-white font-black py-4 px-6 rounded-2xl shadow-xl transform active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3 group disabled:opacity-70"
            >
              {loading ? (
                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span className="tracking-widest uppercase">Acessar Painel</span>
                  <Plane className="h-5 w-5 group-hover:translate-x-2 group-hover:-translate-y-2 transition-transform duration-500 text-yellow-400" />
                </>
              )}
            </button>
            
            <div className="flex items-center gap-2 justify-center text-gray-400 dark:text-slate-500">
                <div className="h-px w-8 bg-gray-200 dark:bg-slate-800"></div>
                <p className="text-[10px] font-bold uppercase tracking-tighter">Login Seguro</p>
                <div className="h-px w-8 bg-gray-200 dark:bg-slate-800"></div>
            </div>
          </form>

          {/* Bottom Footer */}
          <div className="px-10 pb-10 flex justify-between items-center">
            <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 dark:text-slate-600 font-black uppercase tracking-tighter">Versão Estável</span>
                <span className="text-xs text-slate-900 dark:text-slate-300 font-bold">Build 1.10</span>
            </div>
            <div className="text-right">
                <p className="text-gray-400 dark:text-slate-600 text-[9px] font-black uppercase tracking-widest leading-none">
                  &copy; 2026 AeroPayroll<br/>
                  <span className="text-yellow-500/50">Systems Management</span>
                </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;