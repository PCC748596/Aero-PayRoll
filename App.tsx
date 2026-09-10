
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Employee, GlobalConfig, Role, Holiday, VacationRecord, CCTConfigData, AppUser, LogEntry, PayrollResult, PayrollType } from './types';
import { INITIAL_EMPLOYEES, HISTORICAL_DATA, INITIAL_CONFIG, generateHourlyRates, getConfigForDate, getEmptyEmployees, STANDARD_HOLIDAYS, CCT_HISTORY_DATA, INITIAL_USERS } from './constants';
import { calculatePayroll, calculateBusinessDays } from './utils/calculationService';
import InputGrid from './components/InputGrid';
import Payslip from './components/Payslip';
import DataReference from './components/DataReference';
import HolidayManager from './components/HolidayManager';
import PayrollSummary from './components/PayrollSummary';
import ArrearsTable from './components/ArrearsTable';
import Login from './components/Login';
import VacationModal from './components/VacationModal';
import BatchPayslipModal from './components/BatchPayslipModal';
import { ReportModal } from './components/ReportModal';
import UserManagementModal from './components/UserManagementModal';
import AuditLogModal from './components/AuditLogModal';
import { Plane, Users, ChevronLeft, ChevronRight, UserPlus, Save, X, Calendar as CalendarIcon, Upload, LayoutGrid, Sun, Moon, LogOut, AlertCircle, Clock, FileText, Layers, Shield, ScrollText, Download, CheckCircle, Printer } from 'lucide-react';

const App: React.FC = () => {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
      const stored = sessionStorage.getItem('aeropayroll_user');
      return stored ? JSON.parse(stored) : null;
  });

  const isAuthenticated = !!currentUser;

  // Theme State
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  // Data State
  const [history, setHistory] = useState<Record<string, Employee[]>>(HISTORICAL_DATA);
  const [cctHistory, setCctHistory] = useState<CCTConfigData[]>(() => JSON.parse(JSON.stringify(CCT_HISTORY_DATA)));
  const [hasInitialized, setHasInitialized] = useState(false);

  // New State for Users & Logs
  const [users, setUsers] = useState<AppUser[]>(() => {
      const saved = localStorage.getItem('aeropayroll_users');
      return saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(INITIAL_USERS));
  });
  const [logs, setLogs] = useState<LogEntry[]>(() => {
      const saved = localStorage.getItem('aeropayroll_logs');
      return saved ? JSON.parse(saved) : [];
  });

  // Alert Modal State
  const [alertInfo, setAlertInfo] = useState<{title: string, message: string, type: 'success' | 'error'} | null>(null);

  // PWA Install Prompt State
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  // Modals for Admin
  const [showUserModal, setShowUserModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);

  // Print Mode State
  const [printMode, setPrintMode] = useState<'SUMMARY' | 'PAYSLIPS' | null>(null);

  // Persist Users & Logs changes
  useEffect(() => {
    localStorage.setItem('aeropayroll_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('aeropayroll_logs', JSON.stringify(logs));
  }, [logs]);

  // Helper: Deep Clone to break all references
  function deepClone<T>(obj: T): T {
      return JSON.parse(JSON.stringify(obj));
  }

  // Helper: Logging Function
  const addLog = useCallback((action: string, details?: string) => {
      const newLog: LogEntry = {
          id: Date.now().toString() + Math.random().toString(36).substr(2,5),
          timestamp: new Date().toISOString(),
          username: currentUser?.username || 'SYSTEM',
          action,
          details
      };
      setLogs(prev => [...prev, newLog]);
  }, [currentUser]);

  // Current UI State (View)
  const [employees, setEmployees] = useState<Employee[]>(() => deepClone(INITIAL_EMPLOYEES));
  
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedPayrollType, setSelectedPayrollType] = useState<PayrollType>('MONTHLY');
  
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  
  const [businessDays, setBusinessDays] = useState(20); 
  const [dsrMultiplier, setDsrMultiplier] = useState(8);
  const [arrearsMap, setArrearsMap] = useState<Record<string, number>>({});
  const [arrearsFgtsMap, setArrearsFgtsMap] = useState<Record<string, boolean>>({}); 
  const [arrearsPaidMap, setArrearsPaidMap] = useState<Record<string, boolean>>({}); // NEW: Track paid status
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [viewMode, setViewMode] = useState<'input' | 'payroll' | 'arrears'>('input');
  const [showAllEmployees, setShowAllEmployees] = useState(false);
  const [customHolidays, setCustomHolidays] = useState<Holiday[]>([]);
  const [ignoredHolidays, setIgnoredHolidays] = useState<string[]>([]);
  const [showHolidayManager, setShowHolidayManager] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig>(INITIAL_CONFIG);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpRole, setNewEmpRole] = useState<Role>(Role.CMTE);
  const [newEmpAdmission, setNewEmpAdmission] = useState(new Date().toISOString().split('T')[0]);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  
  // Vacation Modal State
  const [vacationEmployee, setVacationEmployee] = useState<Employee | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Handle After Print
  useEffect(() => {
    const handleAfterPrint = () => {
        setPrintMode(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const currentKey = useMemo(() => `${currentDate.getFullYear()}-${currentDate.getMonth()}`, [currentDate]);

  // --- RECONCILIATION LOGIC ---
  const reconcileHistory = (hist: Record<string, Employee[]>) => {
    const masterRecords: Record<string, Employee> = {};
    const sortedMonths = Object.keys(hist).sort();

    sortedMonths.forEach(key => {
        hist[key].forEach(emp => {
            const existing = masterRecords[emp.id];
            const mergedHistory = [...(existing?.vacationHistory || []), ...(emp.vacationHistory || [])];
            const uniqueHistory = Array.from(new Map(mergedHistory.map(item => [item.startDate, item])).values());

            masterRecords[emp.id] = { 
              ...emp,
              vacationHistory: uniqueHistory
            };
        });
    });

    const newHist: Record<string, Employee[]> = {};
    
    sortedMonths.forEach(key => {
        const currentList: Employee[] = hist[key].map(emp => {
           const master = masterRecords[emp.id];
           return {
               ...emp,
               name: master.name,
               admissionDate: master.admissionDate,
               resignationDate: master.resignationDate,
               role: master.role,
               vacationHistory: master.vacationHistory 
           };
        });

        const existingIds = new Set(currentList.map(e => e.id));

        Object.values(masterRecords).forEach(master => {
            if (!existingIds.has(master.id)) {
                const newEntry: Employee = {
                    ...master,
                    hours: {
                        diurna: 0, noturna: 0, espDiurno: 0, espNoturno: 0,
                        reDiurno: 0, reNoturna: 0, reEspDiurno: 0, reEspNoturno: 0,
                        saDiurno: 0, saNoturna: 0, saEspDiurno: 0, saEspNoturno: 0,
                        simulador: 0, horaSolo: 0
                    },
                    folgaDeslocada: 0,
                    atrasoPag225: false,
                    atrasoPag325: false,
                };
                currentList.push(newEntry);
            }
        });

        newHist[key] = currentList;
    });

    return newHist;
  };

  const sanitizeEmployees = (list: Employee[]): Employee[] => {
      const seenIds = new Set<string>();
      return list.map(emp => {
          if (!emp.id || seenIds.has(emp.id)) {
              const newId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
              return { ...emp, id: newId };
          }
          seenIds.add(emp.id);
          return emp;
      });
  };

  // Load data when date changes
  useEffect(() => {
    if (!isAuthenticated) return;
    updateBusinessDays();
    
    const competenceDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    
    const newConfig = getConfigForDate(competenceDate, cctHistory);
    setGlobalConfig(newConfig);

    if (history[currentKey]) {
      setEmployees(deepClone(history[currentKey]));
    } else {
      let base = employees;
      const newMonthEmployees = getEmptyEmployees(sanitizeEmployees(deepClone(base)));
      setEmployees(newMonthEmployees);
    }
    setHasInitialized(true);
  }, [currentKey, customHolidays, ignoredHolidays, isAuthenticated, history, cctHistory]);

  const handleLogin = (user: AppUser) => {
      setCurrentUser(user);
      sessionStorage.setItem('aeropayroll_user', JSON.stringify(user));
      addLog('LOGIN', 'User logged in successfully');
  };

  const handleLogout = () => {
    if (hasUnsavedChanges) {
      const confirmLogout = window.confirm("Existem alterações que não foram salvas. Deseja realmente sair?");
      if (!confirmLogout) return;
    }
    addLog('LOGOUT', 'User logged out');
    sessionStorage.removeItem('aeropayroll_user');
    setCurrentUser(null);
  };

  const updateBusinessDays = () => {
    const competenceMonth = currentDate.getMonth() - 1;
    const competenceYear = currentDate.getFullYear();
    const d = new Date(competenceYear, competenceMonth, 1);
    const { businessDays: count } = calculateBusinessDays(d.getFullYear(), d.getMonth(), ignoredHolidays, customHolidays);
    setBusinessDays(count);
  };

  const handleUpdateEmployee = (updated: Employee) => {
    const newStats = employees.map(e => e.id === updated.id ? updated : e);
    setEmployees(newStats);

    setHistory(prev => {
        const nextHistory = { ...prev };
        nextHistory[currentKey] = deepClone(newStats);

        Object.keys(nextHistory).forEach(key => {
            if (key === currentKey) return;
            nextHistory[key] = nextHistory[key].map(histEmp => {
                if (histEmp.id === updated.id) {
                    return {
                        ...histEmp,
                        name: updated.name,
                        admissionDate: updated.admissionDate,
                        resignationDate: updated.resignationDate,
                        terminationType: updated.terminationType, 
                        role: updated.role,
                        vacationHistory: updated.vacationHistory 
                    };
                }
                return histEmp;
            });
        });
        return nextHistory;
    });
    setHasUnsavedChanges(true);
  };

  const handleSaveVacation = (empId: string, startDate: string, days: 15 | 30, periodStart: string, periodEnd: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;
    
    const startObj = new Date(startDate);
    const endObj = new Date(startObj);
    endObj.setDate(endObj.getDate() + days - 1);
    
    const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const currentMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const intersects = startObj <= currentMonthEnd && endObj >= currentMonthStart;
    
    let newHistory = emp.vacationHistory ? [...emp.vacationHistory] : [];
    
    if (startDate) {
        newHistory = newHistory.filter(v => v.startDate !== startDate);
        const newRecord: VacationRecord = {
            startDate,
            endDate: endObj.toISOString().split('T')[0],
            days,
            periodStart,
            periodEnd
        };
        newHistory.push(newRecord);
    } else {
        if (emp.vacationStartDate) {
             newHistory = newHistory.filter(v => v.startDate !== emp.vacationStartDate);
        }
    }

    const updated = { 
        ...emp, 
        vacationStartDate: intersects && startDate ? startDate : undefined,
        vacationDays: intersects && startDate ? days : undefined,
        vacationHistory: newHistory
    };

    handleUpdateEmployee(updated);
    addLog('VACATION_UPDATE', `Updated vacation for ${emp.name}`);
  };
  
  const changeMonth = (delta: number) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1);
    setCurrentDate(newDate);
    setSelectedEmployeeId(null);
  };

  const handleAddEmployee = () => {
    if (!newEmpName.trim()) return;
    
    // Calcula a proxima senioridade baseada no cargo
    const roleEmployees = employees.filter(e => e.role === newEmpRole);
    let nextSeniority = 1;
    if (newEmpRole === 'CMTE') {
        nextSeniority = roleEmployees.length > 0 ? Math.max(...roleEmployees.map(e => e.seniority || 0)) + 1 : 1;
    } else {
        nextSeniority = roleEmployees.length > 0 ? Math.max(...roleEmployees.map(e => e.seniority || 0)) + 1 : 101;
    }

    const newEmp: Employee = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      seniority: nextSeniority,
      name: newEmpName.toUpperCase(),
      role: newEmpRole,
      baseSalary: globalConfig.salaryBase[newEmpRole],
      admissionDate: newEmpAdmission, 
      hours: {
        diurna: 0, noturna: 0, espDiurno: 0, espNoturno: 0,
        reDiurno: 0, reNoturna: 0, reEspDiurno: 0, reEspNoturno: 0,
        saDiurno: 0, saNoturna: 0, saEspDiurno: 0, saEspNoturno: 0,
        simulador: 0, horaSolo: 0
      },
      folgaDeslocada: 0,
      atrasoPag225: false,
      atrasoPag325: false,
      triTre: 'NA',
      adFuncao: 'NA',
      equipamento: 'A321',
      adicionalA330: false,
      periculosidade: false,
      vacationHistory: []
    };
    
    const newStats = [...employees, newEmp];
    setEmployees(newStats);
    
    setHistory(prev => {
        const nextHistory = { ...prev, [currentKey]: deepClone(newStats) };
        Object.keys(nextHistory).forEach(key => {
            if (key === currentKey) return;
            const exists = nextHistory[key].some(e => e.id === newEmp.id);
            if (!exists) {
                const histEntry = {
                    ...newEmp,
                    hours: {
                        diurna: 0, noturna: 0, espDiurno: 0, espNoturno: 0,
                        reDiurno: 0, reNoturna: 0, reEspDiurno: 0, reEspNoturno: 0,
                        saDiurno: 0, saNoturna: 0, saEspDiurno: 0, saEspNoturno: 0,
                        simulador: 0, horaSolo: 0
                    },
                    folgaDeslocada: 0,
                    atrasoPag225: false,
                    atrasoPag325: false,
                };
                nextHistory[key] = [...nextHistory[key], histEntry];
            }
        });
        return nextHistory;
    });

    setNewEmpName('');
    setHasUnsavedChanges(true);
    addLog('EMPLOYEE_ADD', `Added employee ${newEmp.name}`);
  };

  const hourlyRates = useMemo(() => {
    const totalCorrection = globalConfig.inpc + (globalConfig.otherCorrection || 0);
    return generateHourlyRates(
        globalConfig.horaVooAnterior, 
        totalCorrection, 
        globalConfig.simuladorAnterior ?? 0, 
        globalConfig.horaSoloAnterior ?? 0
    );
  }, [globalConfig.horaVooAnterior, globalConfig.inpc, globalConfig.otherCorrection, globalConfig.simuladorAnterior, globalConfig.horaSoloAnterior]);

  const handleSaveBackup = () => {
    // 1. Generate filename first to include in log
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    const filename = `aeropayroll_backup_${y}-${m}-${d}_${h}-${min}-${s}.json`;

    // 2. Create the log entry explicitly
    const newLog: LogEntry = {
        id: Date.now().toString() + Math.random().toString(36).substr(2,5),
        timestamp: new Date().toISOString(),
        username: currentUser?.username || 'SYSTEM',
        action: 'BACKUP_SAVED',
        details: `System backup exported: ${filename}`
    };

    // 3. Prepare new logs list including this current action
    const currentLogs = [...logs, newLog];

    // 4. Create Export Data using the UPDATED logs
    const exportData = {
        history, 
        config: globalConfig,
        cctHistory, 
        arrears: arrearsMap,
        arrearsFgts: arrearsFgtsMap,
        arrearsPaid: arrearsPaidMap, // Include new Paid map
        users,
        logs: currentLogs,
        meta: {
            currentDate: currentDate.toISOString(),
            generatedBy: 'AeroPayroll',
            generatedByUser: currentUser?.username
        }
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", filename);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();

    // 5. Update State
    setLogs(currentLogs);
    setHasUnsavedChanges(false);
  };

  const handleLoadBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const data = JSON.parse(json);
        console.log('Loaded backup data:', data);

        let loadedDate = currentDate;
        if (data.meta && data.meta.currentDate) {
            loadedDate = new Date(data.meta.currentDate);
            loadedDate.setDate(1); 
            setCurrentDate(loadedDate);
        }

        if (data.history) {
          const rawHistory: Record<string, Employee[]> = {};
          Object.keys(data.history).forEach(key => {
              rawHistory[key] = deepClone(data.history[key]).map(emp => ({
                ...emp,
                seniority: emp.seniority ?? 1
              })); 
          });
          const sanitizedHistory = reconcileHistory(rawHistory);
          setHistory(sanitizedHistory);
          
          // Update employees state to the loaded month's employees
          const newKey = `${loadedDate.getFullYear()}-${loadedDate.getMonth()}`;
          if (sanitizedHistory[newKey]) {
              setEmployees(deepClone(sanitizedHistory[newKey]));
          }
        }

        if (data.cctHistory) setCctHistory(data.cctHistory);

        if (data.config) {
          setGlobalConfig(prev => ({
             ...prev,
             ...(data.config || {}),
             simuladorAnterior: data.config.simuladorAnterior ?? prev.simuladorAnterior,
             horaSoloAnterior: data.config.horaSoloAnterior ?? prev.horaSoloAnterior
          }));
        }

        if (data.arrears) setArrearsMap(data.arrears);
        if (data.arrearsFgts) setArrearsFgtsMap(data.arrearsFgts);
        if (data.arrearsPaid) setArrearsPaidMap(data.arrearsPaid); // Load new map

        // Load Users
        if (data.users && Array.isArray(data.users)) {
            const mergedUsers = [...data.users];
            if (!mergedUsers.find((u: any) => u.role === 'MASTER')) {
                mergedUsers.push(INITIAL_USERS[0]);
            }
            setUsers(mergedUsers);
        }

        // Load Logs
        if (data.logs && Array.isArray(data.logs)) {
            setLogs(data.logs);
        }

        setHasUnsavedChanges(false);
        setHasInitialized(true); 
        setAlertInfo({
            title: 'Backup carregado com sucesso',
            message: `Data ajustada para: ${loadedDate.toLocaleDateString('pt-BR')}`,
            type: 'success'
        });
        addLog('BACKUP_LOADED', 'System backup loaded from file');
      } catch (err) {
        console.error(err);
        setAlertInfo({
            title: 'Erro no Backup',
            message: 'Erro ao processar o arquivo. Verifique o formato.',
            type: 'error'
        });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveEditEmployee = () => {
    if (editingEmployee) {
      handleUpdateEmployee(editingEmployee);
      addLog('EMPLOYEE_EDIT', `Edited details for ${editingEmployee.name}`);
      setEditingEmployee(null);
    }
  };

  // --- USER MANAGEMENT HANDLERS ---
  const handleAddUser = (newUser: AppUser) => {
      setUsers([...users, newUser]);
      addLog('USER_ADDED', `Created user ${newUser.username}`);
      setHasUnsavedChanges(true);
  };

  const handleRemoveUser = (username: string) => {
      setUsers(users.filter(u => u.username !== username));
      addLog('USER_REMOVED', `Removed user ${username}`);
      setHasUnsavedChanges(true);
  };

  const toggleStandardHoliday = (date: string) => {
     if (ignoredHolidays.includes(date)) {
         setIgnoredHolidays(ignoredHolidays.filter(d => d !== date));
     } else {
         setIgnoredHolidays([...ignoredHolidays, date]);
     }
     setHasUnsavedChanges(true);
  };

  const addCustomHoliday = (holiday: Holiday) => {
     if (!customHolidays.find(h => h.date === holiday.date)) {
         setCustomHolidays([...customHolidays, holiday]);
         setHasUnsavedChanges(true);
     }
  };

  const removeCustomHoliday = (date: string) => {
      setCustomHolidays(customHolidays.filter(h => h.date !== date));
      setHasUnsavedChanges(true);
  };

  const handleUpdateGlobalConfig = (newConfig: GlobalConfig) => {
    setGlobalConfig(newConfig);
    setHasUnsavedChanges(true);
    addLog('CONFIG_UPDATE', 'Updated global configuration');
  };

  const handleUpdateDsrMultiplier = (val: number) => {
    setDsrMultiplier(val);
    setHasUnsavedChanges(true);
  };

  const handleUpdateBusinessDaysManual = (val: number) => {
    setBusinessDays(val);
    setHasUnsavedChanges(true);
  };

  const handleUpdateArrear = (key: string, value: number) => {
      setArrearsMap(prev => ({
          ...prev,
          [key]: value
      }));
      setHasUnsavedChanges(true);
  };

  const handleUpdateArrearFgts = (key: string, value: boolean) => {
      setArrearsFgtsMap(prev => ({
          ...prev,
          [key]: value
      }));
      setHasUnsavedChanges(true);
  };

  const handleUpdateArrearPaid = (key: string, value: boolean) => {
      setArrearsPaidMap(prev => ({
          ...prev,
          [key]: value
      }));
      setHasUnsavedChanges(true);
  };

  const handleUpdateCCTHistory = (newHistory: CCTConfigData[]) => {
      setCctHistory(newHistory);
      setHasUnsavedChanges(true);
      addLog('CCT_UPDATE', 'Updated CCT History');
  };

  const formattedPaymentDate = useMemo(() => {
    const month = currentDate.toLocaleString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
    const year = currentDate.toLocaleString('pt-BR', { year: '2-digit' });
    return `${month} ${year}`;
  }, [currentDate]);

  const headerLabel = useMemo(() => {
    const compD = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const payD = currentDate;
    
    const compStr = compD.toLocaleString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
    const payStr = payD.toLocaleString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
    const payYr = payD.toLocaleString('pt-BR', { year: '2-digit' });
    
    return `REF: ${compStr} / PAG: ${payStr}${payYr}`;
  }, [currentDate]);

  const businessDaysLabel = useMemo(() => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const month = d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
    const year = d.toLocaleString('pt-BR', { year: '2-digit' });
    return `DIAS ÚTEIS ${month}${year}`; 
  }, [currentDate]);

  const cctYears = useMemo(() => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1); 
    const year = d.getFullYear();
    const month = d.getMonth(); 
    const startYear = month >= 10 ? year : year - 1;
    return `${startYear}-${startYear + 1}`;
  }, [currentDate]);

  const selectedEmployee = useMemo(() => 
    employees.find(e => e.id === selectedEmployeeId), 
  [employees, selectedEmployeeId]);

  const filteredEmployees = useMemo(() => {
    let list = employees;
    if (!showAllEmployees) {
        const competenceDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        const compMonthVal = competenceDate.getFullYear() * 12 + competenceDate.getMonth();

        list = employees.filter(emp => {
          if (emp.admissionDate) {
              const [ay, am] = emp.admissionDate.split('-').map(Number);
              const admMonthVal = ay * 12 + (am - 1);
              if (admMonthVal > compMonthVal) return false;
          }
          if (emp.resignationDate) {
             const [ry, rm] = emp.resignationDate.split('-').map(Number);
             const resMonthVal = ry * 12 + (rm - 1);
             const cutoffMonthVal = resMonthVal + 2;
             if (compMonthVal > cutoffMonthVal) return false;
          }
          return true;
        });
    }

    const cmtes = list.filter(e => e.role === 'CMTE').sort((a, b) => (a.seniority || 0) - (b.seniority || 0));
    const fos = list.filter(e => e.role === 'FO').sort((a, b) => (a.seniority || 0) - (b.seniority || 0));

    const updatedCmtes = cmtes.map((e, idx) => ({ ...e, seniority: idx + 1 }));
    const updatedFos = fos.map((e, idx) => ({ ...e, seniority: 101 + idx }));

    return [...updatedCmtes, ...updatedFos];
  }, [employees, currentDate, showAllEmployees]);

  const payrollData = useMemo(() => {
    if (!selectedEmployee) return null;
    
    const competenceDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const calculationDate = selectedPayrollType === 'VACATION' ? currentDate : competenceDate;
    const totalDaysInMonth = new Date(calculationDate.getFullYear(), calculationDate.getMonth() + 1, 0).getDate();
    
    const compConfig = getConfigForDate(calculationDate, cctHistory);
    const compCorrection = compConfig.inpc + (compConfig.otherCorrection || 0);
    const compHourlyRates = generateHourlyRates(compConfig.horaVooAnterior, compCorrection, compConfig.simuladorAnterior, compConfig.horaSoloAnterior);

    const effectiveDsrMultiplier = compConfig.dsrMultiplier || 8;

    // --- FIX FOR TERMINATION SUMMING PREVIOUS MONTH ---
    let previousMonthEmployee = undefined;
    if (selectedEmployee.resignationDate) {
        const [rY, rM] = selectedEmployee.resignationDate.split('-').map(Number);
        // Is this the settlement month? (Resignation + 2)
        // CurrentDate is Payment Month.
        const currentAbs = currentDate.getFullYear() * 12 + currentDate.getMonth();
        const resAbs = rY * 12 + (rM - 1);
        
        if (currentAbs === resAbs + 2) {
            const prevMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
            const prevKey = `${prevMonthDate.getFullYear()}-${prevMonthDate.getMonth()}`;
            
            const prevHistoryList = history[prevKey];
            previousMonthEmployee = prevHistoryList?.find(e => e.id === selectedEmployee.id);
        }
    }
    // --------------------------------------------------

    return calculatePayroll(
      selectedEmployee, 
      businessDays, 
      totalDaysInMonth, 
      compConfig, 
      compHourlyRates, 
      effectiveDsrMultiplier,
      selectedPayrollType === 'VACATION' ? currentDate : competenceDate, 
      selectedPayrollType, 
      undefined, 
      undefined, 
      undefined,
      ignoredHolidays,
      undefined,
      undefined,
      previousMonthEmployee // Pass the previous month snapshot
    );
  }, [selectedEmployee, globalConfig, hourlyRates, dsrMultiplier, currentDate, ignoredHolidays, customHolidays, cctHistory, businessDays, history, selectedPayrollType]);

  const handlePrintSummary = () => {
      setPrintMode('SUMMARY');
      setTimeout(() => {
          window.print();
      }, 500);
  };

  const handlePrintPayslips = () => {
      setPrintMode('PAYSLIPS');
      setTimeout(() => {
          window.print();
      }, 500);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} users={users} darkMode={darkMode} />;
  }

  // --- ACCESS CONTROL HELPERS ---
  const canEdit = currentUser?.role !== 'VIEWER';
  const isMaster = currentUser?.role === 'MASTER';

  const SaveButton = () => (
    <button 
        onClick={canEdit ? handleSaveBackup : undefined} 
        disabled={!canEdit}
        className={`h-8 px-3 flex items-center justify-center gap-1 text-white rounded shadow-sm transition-all relative ${!canEdit ? 'bg-gray-400 cursor-not-allowed' : (hasUnsavedChanges ? 'bg-blue-600 hover:bg-blue-700 ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900' : 'bg-slate-600 hover:bg-slate-700 opacity-60')}`}
        title={canEdit ? "Salvar Backup" : "Somente Leitura"}
    >
        <Save className="h-4 w-4" />
        <span className="text-xs font-bold">Save</span>
        {hasUnsavedChanges && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>}
    </button>
  );

  return (
    <div className={`min-h-screen pb-10 transition-colors duration-200 ${printMode ? 'print:pb-0 print:bg-white' : ''}`}>
      
      {/* Wrapper to hide Main App content when Modals are printing OR Full Print Mode is active */}
      <div className={`${showBatchModal || showReportModal || printMode ? 'print:hidden' : ''}`}>
        <header className="bg-slate-900 dark:bg-slate-950 text-white p-4 shadow-md no-print border-b border-slate-800">
            <div className="w-full max-w-[98%] mx-auto flex justify-between items-center">
            <div className="flex items-center gap-3">
                <Plane className="h-8 w-8 text-yellow-400" />
                <div className="flex flex-col">
                    <h1 className="text-2xl font-bold tracking-tight leading-none">AeroPayroll <span className="text-yellow-400 font-light">Manager</span></h1>
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1 mt-1">
                        Logado como: <span className="text-white">{currentUser?.username}</span> 
                        <span className={`px-1.5 rounded ${currentUser?.role === 'MASTER' ? 'bg-purple-600' : (currentUser?.role === 'EDITOR' ? 'bg-blue-600' : 'bg-gray-600')}`}>{currentUser?.role}</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                
                {installPrompt && (
                    <button 
                        onClick={handleInstallApp}
                        className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-all animate-pulse shadow-lg mr-2"
                        title="Instalar Aplicativo"
                    >
                        <Download className="h-4 w-4" />
                        Instalar App
                    </button>
                )}

                {isMaster && (
                    <>
                        <button 
                            onClick={() => setShowLogModal(true)}
                            className="p-2 bg-slate-800 dark:bg-slate-900 hover:bg-slate-700 text-indigo-400 rounded-lg transition-colors shadow-inner"
                            title="Logs de Auditoria"
                        >
                            <ScrollText className="h-5 w-5" />
                        </button>
                        <button 
                            onClick={() => setShowUserModal(true)}
                            className="p-2 bg-slate-800 dark:bg-slate-900 hover:bg-slate-700 text-blue-400 rounded-lg transition-colors shadow-inner"
                            title="Gestão de Usuários"
                        >
                            <Shield className="h-5 w-5" />
                        </button>
                        <div className="h-6 w-px bg-slate-700 mx-1"></div>
                    </>
                )}

                {hasUnsavedChanges && (
                <div className="flex items-center gap-1 text-yellow-500 mr-2 bg-yellow-500/10 px-3 py-1.5 rounded-full border border-yellow-500/20 animate-pulse">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Alterações não salvas</span>
                </div>
                )}
                <button 
                    onClick={() => setDarkMode(!darkMode)} 
                    className="p-2 bg-slate-800 dark:bg-slate-900 text-yellow-400 rounded-lg hover:bg-slate-700 transition-colors shadow-inner"
                    title={darkMode ? "Modo Claro" : "Modo Escuro"}
                >
                    {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </button>
                <button 
                    onClick={handleLogout}
                    className="flex items-center gap-2 p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs transition-colors shadow-lg"
                    title="Sair do Sistema"
                >
                    <LogOut className="h-4 w-4" />
                    Sair
                </button>
            </div>
            </div>
        </header>

        <main className="w-full max-w-[98%] mx-auto mt-8 px-2 print:max-w-full print:mx-0 print:mt-0 print:px-0">
            
            {!selectedEmployeeId ? (
            <div className="space-y-6 animate-fade-in">
                
                <div className="flex flex-col xl:flex-row justify-between items-end bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 gap-4 no-print">
                <div>
                    <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-100 flex items-center gap-2">
                    <LayoutGrid className="h-5 w-5" />
                    {viewMode === 'input' && 'Quadro de Tripulantes'}
                    {viewMode === 'payroll' && 'Folha de Pagamento'}
                    {viewMode === 'arrears' && 'Cálculo de Atrasados'}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                        {viewMode === 'input' && 'Gerencie as horas de voo e variáveis da competência.'}
                        {viewMode === 'payroll' && 'Resumo financeiro da folha de pagamento.'}
                        {viewMode === 'arrears' && 'Cálculo de multas por atraso salarial.'}
                    </p>
                </div>

                <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-lg gap-2">
                    <div className="flex rounded-md bg-white dark:bg-slate-700/50 shadow-sm overflow-hidden">
                        <button 
                            onClick={() => setViewMode('input')}
                            className={`px-4 py-1.5 text-sm font-medium transition-all ${viewMode === 'input' ? 'bg-blue-50 dark:bg-slate-600 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}
                        >
                            Quadro de Horas
                        </button>
                        <button 
                            onClick={() => setViewMode('payroll')}
                            className={`px-4 py-1.5 text-sm font-medium transition-all border-l border-r border-gray-200 dark:border-slate-600 ${viewMode === 'payroll' ? 'bg-green-50 dark:bg-slate-600 text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}
                        >
                            Folha
                        </button>
                        <button 
                            onClick={() => setViewMode('arrears')}
                            className={`px-4 py-1.5 text-sm font-medium transition-all flex items-center gap-1 ${viewMode === 'arrears' ? 'bg-amber-50 dark:bg-slate-600 text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}
                        >
                            <Clock className="w-3 h-3" /> Atrasados
                        </button>
                    </div>
                    <button 
                        onClick={() => setShowReportModal(true)}
                        className="px-4 py-1.5 rounded-md text-sm font-bold bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 shadow-sm flex items-center gap-2 border border-gray-200 dark:border-slate-600"
                    >
                        <FileText className="w-4 h-4" /> Relatórios
                    </button>
                </div>
                
                {viewMode !== 'arrears' && (
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                    <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors text-slate-600 dark:text-slate-400">
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div className="flex flex-col items-center mx-2">
                        <span className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider whitespace-nowrap">{headerLabel}</span>
                        <span className="text-sm font-bold text-slate-950 dark:text-slate-100 leading-tight w-20 text-center select-none">
                        {formattedPaymentDate}
                        </span>
                    </div>
                    <button onClick={() => changeMonth(1)} className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors text-slate-600 dark:text-slate-400">
                        <ChevronRight className="h-5 w-5" />
                    </button>
                    
                    <div className="h-8 w-px bg-gray-300 dark:bg-slate-700 mx-2"></div>
                    <div className="flex flex-col items-center relative">
                        <span className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider">{businessDaysLabel}</span>
                        <div className="flex items-center gap-1">
                            <input 
                            type="number" 
                            className="w-12 text-center text-sm font-bold bg-transparent border-b border-slate-400 focus:outline-none focus:border-blue-500 text-slate-950 dark:text-white"
                            value={businessDays}
                            onChange={(e) => handleUpdateBusinessDaysManual(Number(e.target.value))}
                            disabled={!canEdit}
                            />
                            <button 
                            onClick={() => canEdit && setShowHolidayManager(true)} 
                            className={`text-gray-500 dark:text-slate-400 p-0.5 rounded ${canEdit ? 'hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-200 dark:hover:bg-slate-700' : 'cursor-not-allowed opacity-50'}`}
                            title="Gerenciar Feriados"
                            disabled={!canEdit}
                            >
                            <CalendarIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
                )}
                </div>

                {viewMode === 'input' && (
                    <div className="no-print">
                        <div className={`flex items-center gap-2 bg-gray-50 dark:bg-slate-900 p-2 rounded border border-gray-200 dark:border-slate-800 overflow-x-auto ${!canEdit ? 'opacity-70 pointer-events-none grayscale' : ''}`}>
                            
                            <div className="flex items-center gap-2 transition-all">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase">Nome</span>
                                <input 
                                type="text" 
                                placeholder="Nome Completo" 
                                className="px-2 py-1 text-sm border rounded w-32 md:w-48 bg-white dark:bg-slate-800 text-slate-950 dark:text-white dark:border-slate-700 uppercase"
                                value={newEmpName}
                                onChange={e => setNewEmpName(e.target.value.toUpperCase())}
                                disabled={!canEdit}
                                />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase">Função</span>
                                <select 
                                className="px-2 py-1 text-sm border rounded bg-white dark:bg-slate-800 text-slate-950 dark:text-white dark:border-slate-700"
                                value={newEmpRole}
                                onChange={e => setNewEmpRole(e.target.value as Role)}
                                disabled={!canEdit}
                                >
                                <option value={Role.CMTE}>CMTE</option>
                                <option value={Role.FO}>FO</option>
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase">Admissão</span>
                                <input 
                                    type="date" 
                                    className="px-2 py-1 text-sm border rounded bg-white dark:bg-slate-800 text-slate-950 dark:text-white dark:border-slate-700"
                                    value={newEmpAdmission}
                                    onChange={e => setNewEmpAdmission(e.target.value)}
                                    disabled={!canEdit}
                                />
                            </div>
                            <div className="flex flex-col justify-end h-full mt-auto">
                                <button onClick={handleAddEmployee} disabled={!canEdit} className="h-8 px-3 mt-4 bg-green-600 text-white rounded hover:bg-green-700 flex items-center justify-center gap-1 shadow-sm transition-colors disabled:opacity-50" title="Adicionar Tripulante">
                                <UserPlus className="h-4 w-4" /> <span className="text-xs font-bold">Add</span>
                                </button>
                            </div>
                            </div>

                            <div className="h-8 w-px bg-gray-300 dark:bg-slate-700 mx-2 mt-auto mb-1"></div>
                            <div className="flex flex-col justify-end h-full mt-auto pointer-events-auto filter-none opacity-100">
                                <div className="flex gap-1 mt-4">
                                    <input 
                                        type="file" 
                                        ref={fileInputRef}
                                        onChange={handleLoadBackup}
                                        className="hidden"
                                        accept=".json"
                                        disabled={!canEdit}
                                    />
                                    <button 
                                        onClick={() => fileInputRef.current?.click()} 
                                        disabled={!canEdit}
                                        className="h-8 px-3 flex items-center justify-center gap-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                                        title={canEdit ? "Carregar Backup" : "Somente Leitura"}
                                    >
                                        <Upload className="h-4 w-4" />
                                        <span className="text-xs font-bold">Load</span>
                                    </button>
                                    <SaveButton />
                                </div>
                            </div>
                        </div>

                        <InputGrid 
                        employees={filteredEmployees} 
                        onUpdateEmployee={handleUpdateEmployee}
                        onSelectForPayslip={(e, type) => {
                            setSelectedPayrollType(type);
                            setSelectedEmployeeId(e.id);
                        }}
                        onEditDetails={(emp) => setEditingEmployee(emp)}
                        onOpenVacation={(emp) => setVacationEmployee(emp)}
                        currentDate={currentDate}
                        isLocked={!canEdit}
                        />
                    </div>
                )}

                {viewMode === 'payroll' && (
                    <div className="space-y-2 no-print">
                        <div className="flex justify-end items-center gap-2">
                            <button 
                                onClick={() => setShowBatchModal(true)}
                                className="h-8 px-3 flex items-center gap-2 bg-slate-600 hover:bg-slate-700 text-white rounded shadow-sm text-xs font-bold transition-colors"
                            >
                                <Layers className="w-4 h-4" /> Impressão em Lote
                            </button>
                            <button 
                                onClick={handlePrintSummary}
                                className="h-8 px-3 flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white rounded shadow-sm text-xs font-bold transition-colors"
                            >
                                <Printer className="w-4 h-4" /> Imprimir Folha RH Mês
                            </button>
                            <button 
                                onClick={handlePrintPayslips}
                                className="h-8 px-3 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded shadow-sm text-xs font-bold transition-colors"
                            >
                                <Layers className="w-4 h-4" /> Imprimir Holerites do Mês
                            </button>
                            <SaveButton />
                        </div>
                        <PayrollSummary 
                        employees={filteredEmployees}
                        config={globalConfig}
                        businessDays={businessDays}
                        dsrMultiplier={dsrMultiplier}
                        hourlyRates={hourlyRates}
                        currentDate={currentDate}
                        ignoredHolidays={ignoredHolidays}
                        customHolidays={customHolidays}
                        cctHistory={cctHistory}
                        />
                    </div>
                )}

                {viewMode === 'arrears' && (
                <div className="h-[75vh] flex flex-col gap-2 print:h-auto print:block">
                    <div className="flex justify-end no-print">
                            <SaveButton />
                    </div>
                    <div className="flex-1 overflow-hidden print:overflow-visible print:h-auto">
                        <ArrearsTable 
                            employees={employees} 
                            history={history}
                            arrearsMap={arrearsMap}
                            arrearsFgtsMap={arrearsFgtsMap} // Pass FGTS map
                            arrearsPaidMap={arrearsPaidMap} // Pass Paid map
                            onUpdateArrear={canEdit ? handleUpdateArrear : () => {}}
                            onUpdateArrearFgts={canEdit ? handleUpdateArrearFgts : () => {}} // Pass update function
                            onUpdateArrearPaid={canEdit ? handleUpdateArrearPaid : () => {}} // Pass Paid update function
                            ignoredHolidays={ignoredHolidays}
                            customHolidays={customHolidays}
                            currentDate={currentDate}
                            cctHistory={cctHistory} 
                            manualBusinessDays={businessDays} 
                        />
                    </div>
                </div>
                )}
                
                {viewMode !== 'arrears' && (
                    <div className={`mt-8 no-print ${!canEdit ? 'pointer-events-none opacity-80' : ''}`}>
                    <h3 className="text-lg font-bold text-slate-950 dark:text-slate-100 mb-4 border-l-4 border-yellow-400 pl-2">Dados de Referência ({cctYears})</h3>
                    <DataReference 
                        dsrMultiplier={dsrMultiplier}
                        onUpdateDsrMultiplier={handleUpdateDsrMultiplier}
                        config={globalConfig}
                        onUpdateConfig={handleUpdateGlobalConfig}
                        yearLabel={cctYears}
                        cctHistory={cctHistory}
                        onUpdateCCTHistory={handleUpdateCCTHistory}
                    />
                    </div>
                )}

            </div>
            ) : (
            <div className="animate-fade-in w-full flex justify-center print:block print:w-full">
                {payrollData && (
                <Payslip 
                    data={payrollData} 
                    onBack={() => setSelectedEmployeeId(null)}
                    currentDate={currentDate}
                    employees={filteredEmployees}
                    onSelectEmployee={setSelectedEmployeeId}
                    history={history}
                    customHolidays={customHolidays}
                    ignoredHolidays={ignoredHolidays}
                    cctHistory={cctHistory} 
                    businessDays={businessDays} 
                />
                )}
            </div>
            )}

        </main>
      </div>

      {/* FULL MONTH PRINT LAYOUTS (HIDDEN UNTIL TRIGGERED) */}
      
      {/* 1. SUMMARY ONLY (LANDSCAPE) */}
      {printMode === 'SUMMARY' && (
          <div className="print-only-summary absolute top-0 left-0 w-full bg-white text-black z-[9999] print:block">
              <style>{`@media print { @page { size: landscape; margin: 10mm; } body { -webkit-print-color-adjust: exact; } }`}</style>
              <div className="p-4 w-full h-full">
                  <h1 className="text-xl font-bold mb-4 text-center uppercase">Folha de Pagamento - {formattedPaymentDate}</h1>
                  <PayrollSummary 
                        employees={filteredEmployees}
                        config={globalConfig}
                        businessDays={businessDays}
                        dsrMultiplier={dsrMultiplier}
                        hourlyRates={hourlyRates}
                        currentDate={currentDate}
                        ignoredHolidays={ignoredHolidays}
                        customHolidays={customHolidays}
                        cctHistory={cctHistory}
                  />
                  <div className="mt-8 text-xs text-center text-gray-500">
                      Resumo da Folha gerado em {new Date().toLocaleString('pt-BR')}
                  </div>
              </div>
          </div>
      )}

      {/* 2. PAYSLIPS ONLY (PORTRAIT) */}
      {printMode === 'PAYSLIPS' && (
          <div className="print-only-payslips absolute top-0 left-0 w-full bg-white text-black z-[9999] print:block">
              <style>{`@media print { @page { size: portrait; margin: 10mm; } body { -webkit-print-color-adjust: exact; } }`}</style>
              {filteredEmployees.map((emp, index) => {
                  const dummyData: any = {
                      employee: emp,
                      earnings: [],
                      deductions: [],
                      nonTaxableEarnings: [],
                      totals: { gross:0, net:0, totalDeductions:0, fgts:0, totalNonTaxable:0 },
                      metadata: { businessDays: 0, dsrMultiplier: 0, sundaysAndHolidays: 0, payrollType: 'MONTHLY' }
                  };
                  return (
                      <div key={emp.id} className="p-4 page-break-after" style={{ pageBreakAfter: 'always', breakAfter: 'page' }}>
                          <Payslip 
                                data={dummyData}
                                onBack={() => {}}
                                currentDate={currentDate}
                                employees={[emp]}
                                onSelectEmployee={() => {}}
                                history={history}
                                customHolidays={customHolidays}
                                ignoredHolidays={ignoredHolidays}
                                cctHistory={cctHistory} 
                                businessDays={businessDays} 
                                hideControls={true}
                          />
                      </div>
                  );
              })}
          </div>
      )}

      {/* CUSTOM ALERT MODAL */}
      {alertInfo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className={`bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-sm border border-gray-200 dark:border-slate-800 transform transition-all scale-100 overflow-hidden`}>
                <div className="p-6">
                    <div className="flex items-start gap-3">
                        {alertInfo.type === 'success' ? (
                            <CheckCircle className="w-6 h-6 text-green-500 mt-0.5 flex-shrink-0" />
                        ) : (
                            <AlertCircle className="w-6 h-6 text-red-500 mt-0.5 flex-shrink-0" />
                        )}
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{alertInfo.title}</h3>
                            <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed">{alertInfo.message}</p>
                        </div>
                    </div>
                </div>
                <div className="p-3 border-t border-gray-100 dark:border-slate-800 flex justify-end bg-gray-50 dark:bg-slate-950/50">
                    <button 
                        onClick={() => setAlertInfo(null)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-md transition-transform active:scale-95"
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
      )}

      {editingEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 no-print">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-xl w-96 border-t-4 border-yellow-400 border-x border-b border-slate-200 dark:border-slate-800">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-950 dark:text-slate-100 flex items-center gap-2">
                   <Users className="w-5 h-5 text-yellow-500" />
                   Editar Tripulante
                </h3>
                <button onClick={() => setEditingEmployee(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
                   <X className="w-5 h-5" />
                </button>
             </div>
             
             <div className="space-y-4">
                <div>
                   <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Nome Completo</label>
                   <input 
                      type="text" 
                      className="w-full border border-gray-300 dark:border-slate-700 rounded px-2 py-1.5 focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none bg-white dark:bg-slate-800 text-slate-950 dark:text-white uppercase"
                      value={editingEmployee.name}
                      onChange={(e) => setEditingEmployee({...editingEmployee, name: e.target.value.toUpperCase()})}
                      disabled={!canEdit}
                   />
                </div>

                <div>
                   <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Função</label>
                   <select 
                      className="w-full border border-gray-300 dark:border-slate-700 rounded px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-950 dark:text-white"
                      value={editingEmployee.role}
                      onChange={(e) => setEditingEmployee({...editingEmployee, role: e.target.value as Role})}
                      disabled={!canEdit}
                   >
                      <option value={Role.CMTE}>CMTE</option>
                      <option value={Role.FO}>FO</option>
                   </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Data Admissão</label>
                      <input 
                          type="date" 
                          className="w-full border border-gray-300 dark:border-slate-700 rounded px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-950 dark:text-white"
                          value={editingEmployee.admissionDate}
                          onChange={(e) => setEditingEmployee({...editingEmployee, admissionDate: e.target.value})}
                          disabled={!canEdit}
                      />
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Data Desligamento</label>
                      <input 
                          type="date" 
                          className="w-full border border-gray-300 dark:border-slate-700 rounded px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-950 dark:text-white"
                          value={editingEmployee.resignationDate || ''}
                          onChange={(e) => setEditingEmployee({
                            ...editingEmployee, 
                            resignationDate: e.target.value,
                            terminationType: e.target.value ? editingEmployee.terminationType : undefined 
                          })}
                          disabled={!canEdit}
                      />
                   </div>
                </div>

                {editingEmployee.resignationDate && (
                  <div className="pt-2 border-t border-gray-100 dark:border-slate-800 mt-2 animate-fade-in">
                      <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-2">Tipo de Rescisão</label>
                      <div className="grid grid-cols-2 gap-2">
                          {/* Radio Buttons... keeping it concise, assume standard disabled logic applies */}
                          {['PEDIDO_TRABALHADO', 'PEDIDO_INDENIZADO', 'DEMISSAO_TRABALHADA', 'DEMISSAO_INDENIZADA'].map(type => (
                              <label key={type} className={`flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-gray-50 dark:hover:bg-slate-800/50 ${editingEmployee.terminationType === type ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                  <input 
                                      type="radio"
                                      name="terminationType"
                                      checked={editingEmployee.terminationType === type}
                                      onChange={() => setEditingEmployee({...editingEmployee, terminationType: type as any})}
                                      disabled={!canEdit}
                                      className="text-blue-600 focus:ring-blue-500 w-4 h-4 bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-700 cursor-pointer"
                                  />
                                  <span className="text-[10px] text-slate-700 dark:text-slate-300 font-medium leading-tight">{type.replace('_', '/')}</span>
                              </label>
                          ))}
                      </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-6">
                   <button 
                      onClick={() => setEditingEmployee(null)}
                      className="px-3 py-1.5 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded transition-colors"
                   >
                      Cancelar
                   </button>
                   {canEdit && (
                       <button 
                          onClick={handleSaveEditEmployee}
                          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm font-semibold transition-colors"
                       >
                          Salvar Alterações
                       </button>
                   )}
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Admin Modals */}
      {showUserModal && currentUser && (
          <UserManagementModal 
              users={users}
              currentUser={currentUser}
              onAddUser={handleAddUser}
              onRemoveUser={handleRemoveUser}
              onClose={() => setShowUserModal(false)}
          />
      )}

      {showLogModal && (
          <AuditLogModal 
              logs={logs}
              onClose={() => setShowLogModal(false)}
          />
      )}

      <VacationModal 
         isOpen={!!vacationEmployee}
         employee={vacationEmployee}
         onClose={() => setVacationEmployee(null)}
         onSave={handleSaveVacation}
      />

      <ReportModal
         isOpen={showReportModal}
         onClose={() => setShowReportModal(false)}
         employees={employees}
         history={history}
         arrearsMap={arrearsMap} 
         arrearsFgtsMap={arrearsFgtsMap} // Pass new map to ReportModal
         cctHistory={cctHistory}
         ignoredHolidays={ignoredHolidays}
         customHolidays={customHolidays}
      />

      <BatchPayslipModal 
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        employees={employees}
        history={history}
        cctHistory={cctHistory}
        ignoredHolidays={ignoredHolidays}
        customHolidays={customHolidays}
        manualBusinessDays={businessDays}
        currentPaymentDate={currentDate}
      />

      {showHolidayManager && (
         <HolidayManager 
            year={currentDate.getFullYear()}
            standardHolidays={STANDARD_HOLIDAYS}
            ignoredHolidays={ignoredHolidays}
            customHolidays={customHolidays}
            onToggleStandard={toggleStandardHoliday}
            onAddCustom={addCustomHoliday}
            onRemoveCustom={removeCustomHoliday}
            onClose={() => setShowHolidayManager(false)}
         />
      )}

    </div>
  );
};

export default App;
