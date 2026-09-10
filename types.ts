
export enum Role {
  CMTE = 'CMTE',
  FO = 'FO'
}

export type TriTreOption = 'NA' | 'TRI' | 'TRE';
export type AdFuncaoOption = 'NA' | 'D.OPR' | 'D.SAFETY' | 'P.CHEFE' | 'G.KEEPER' | 'D.GERAL' | 'ACORDO';
export type EquipamentoOption = 'A321' | 'A330' | 'ATR72';

export type TerminationType = 'PEDIDO_TRABALHADO' | 'PEDIDO_INDENIZADO' | 'DEMISSAO_TRABALHADA' | 'DEMISSAO_INDENIZADA';

export type PayrollType = 'MONTHLY' | '13_1ST' | '13_2ND' | 'VACATION' | 'TERMINATION';

// --- AUTH & LOGGING TYPES ---
export type UserRole = 'MASTER' | 'EDITOR' | 'VIEWER';

export interface AppUser {
  username: string;
  password: string; // In a real app this should be hashed. Storing as base64 or plain for client-side demo simplicity.
  role: UserRole;
  createdAt: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  username: string;
  action: string;
  details?: string;
}
// ----------------------------

export interface VacationRecord {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  days: 15 | 30;
  periodStart: string; // Inicio do periodo aquisitivo (ex: 2023-02-01)
  periodEnd: string;   // Fim do periodo aquisitivo (ex: 2024-01-31)
}

export interface Employee {
  id: string;
  seniority: number;
  name: string;
  role: Role;
  baseSalary: number;
  
  // Dates for active check
  admissionDate: string; // YYYY-MM-DD
  resignationDate?: string; // YYYY-MM-DD (Optional)
  terminationType?: TerminationType;

  // Hours Quantities
  hours: {
    diurna: number;
    noturna: number;
    espDiurno: number;
    espNoturno: number;
    reDiurno: number;
    reNoturna: number;
    reEspDiurno: number;
    reEspNoturno: number;
    saDiurno: number;
    saNoturna: number;
    saEspDiurno: number;
    saEspNoturno: number;
    simulador: number;
    horaSolo: number;
  };

  // Variables
  folgaDeslocada: number; // Quantity of days
  atrasoPag225: boolean;
  atrasoPag325: boolean;
  
  // Dropdown Options
  triTre: TriTreOption;
  adFuncao: AdFuncaoOption;
  equipamento: EquipamentoOption;

  adicionalA330: boolean; // Deprecated/Mapped to equipamento usually, but keeping for legacy calc if needed or removed
  periculosidade: boolean;
  
  // Custom Override
  dsrOverride?: number; // Allow manual override if needed

  // Vacation Data (Current Month Calculation)
  vacationStartDate?: string; // YYYY-MM-DD - Used for Payroll Calculation of CURRENT view
  vacationDays?: 15 | 30;
  
  // Vacation History (For Vesting Tracking)
  vacationHistory?: VacationRecord[];
}

export interface TaxBracket {
  startValue: number; // Added for editable start value
  limit: number | null; // null means infinity
  rate: number;
  deduction: number;
}

export type HolidayType = 'Nacional' | 'Estadual' | 'Municipal';

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  type: HolidayType;
}

// New Interfaces for CCT History
export interface DailyAllowance {
  breakfast: number;
  lunch: number;
  dinner: number;
  supper: number;
}

export interface IntlDailyAllowance {
  southAmerica: number;
  northAmerica: number;
  europe: number;
  uk: number;
  others: number;
}

export interface CCTConfigData {
  id: string;
  label: string; // e.g. "CCT 24-25"
  period: string; // e.g. "Dez 2024 a Nov 2025"
  
  // Reajuste
  inpc: number;
  otherCorrection: number;
  
  // Piso
  salary: {
    cmte: number;
    fo: number;
    mecanico: number; // Visual only
    comissario: number; // Visual only
  };
  
  // Hourly Rates Base (New Request)
  // Stores the FINAL effective value for that period
  hours: {
    flightHour: number;
    simulatorHour: number;
    groundHour: number;
  };
  
  // Diárias
  diarias: {
    nacional: DailyAllowance;
    internacional: IntlDailyAllowance;
  };

  // Vale Alimentação
  valeAlimentacao: {
    value: number;
    threshold: number; // Acima de qual salário
    payIndependently: boolean; // Paga independente do salário?
  };

  // Gratificações e Adicionais (Fixed Values per CCT)
  fixedValues: {
    D_OPR: number;
    D_SAFETY: number;
    P_CHEFE: number;
    G_KEEPER: number;
    D_GERAL: number;
    ACORDO: number;
    TRE_SFE: number;
    TRI_SFI: number;
    PERICULOSIDADE_PERCENT: number;
    FOLGA_DESLOCADA: number;
  };

  // Outros
  dsrMultiplier: number;
  feriasOptions: number[]; // [15, 30]
}

export interface GlobalConfig {
  inpc: number;
  otherCorrection: number;
  valeAlimentacao: number;
  valeAlimentacaoSeparate?: boolean; // New field to indicate if VA is paid separately (not in payroll)
  horaVooAnterior: number;
  simuladorAnterior: number; // Novo campo
  horaSoloAnterior: number;  // Novo campo
  dsrMultiplier: number;
  salaryBase: {
    [Role.CMTE]: number;
    [Role.FO]: number;
  };
  fixedValues: {
    D_OPR: number;
    D_SAFETY: number;
    P_CHEFE: number; // Renamed from PC
    G_KEEPER: number;
    D_GERAL: number;
    ACORDO: number;
    TRE_SFE: number;
    TRI_SFI: number;
    PERICULOSIDADE_PERCENT: number;
    FOLGA_DESLOCADA: number;
  };
  inssTable: TaxBracket[];
  irTable: TaxBracket[];
}

export interface PayrollResult {
  employee: Employee;
  earnings: {
    description: string;
    rate?: number;
    quantity?: number;
    total: number;
    isVariable: boolean; // Used for DSR calc
  }[];
  deductions: {
    description: string;
    rate?: number;
    total: number;
  }[];
  nonTaxableEarnings: {
    description: string;
    total: number;
  }[];
  totals: {
    gross: number;
    net: number;
    totalDeductions: number;
    fgts: number;
    totalNonTaxable: number;
    fgtsFine?: number; // Added field for 40% Fine
  };
  metadata: {
    businessDays: number;
    dsrMultiplier: number;
    sundaysAndHolidays: number;
    payrollType: PayrollType;
    monthsWorked13th?: number;
    terminationMeta?: {
        noticeDays: number;
        vacationVestingMonths: number;
    }
  }
}