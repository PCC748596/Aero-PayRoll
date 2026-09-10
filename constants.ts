
import { Employee, Role, TaxBracket, GlobalConfig, Holiday, CCTConfigData, AppUser } from './types';

// ============================================================================
// INITIAL USERS
// ============================================================================

export const INITIAL_USERS: AppUser[] = [
  {
    username: 'p.costa',
    password: 'cGNNYXN0ZXIyNEA=', // "pcMaster24@" in Base64
    role: 'MASTER',
    createdAt: new Date().toISOString()
  }
];

// ============================================================================
// IR TABLES (Based on specific periods provided)
// ============================================================================

const IR_TABLE_0523_0124: TaxBracket[] = [
     { startValue: 0.00, limit: 2112.00, rate: 0.00, deduction: 0.00 },
     { startValue: 2112.01, limit: 2826.65, rate: 0.075, deduction: 158.40 }, 
     { startValue: 2826.66, limit: 3751.05, rate: 0.15, deduction: 370.40 },
     { startValue: 3751.06, limit: 4664.68, rate: 0.225, deduction: 651.73 },
     { startValue: 4664.69, limit: null, rate: 0.275, deduction: 884.96 },
];

const IR_TABLE_0224_0425: TaxBracket[] = [
     { startValue: 0.00, limit: 2259.20, rate: 0.00, deduction: 0.00 },
     { startValue: 2259.21, limit: 2826.65, rate: 0.075, deduction: 169.44 }, 
     { startValue: 2826.66, limit: 3751.05, rate: 0.15, deduction: 381.44 },
     { startValue: 3751.06, limit: 4664.68, rate: 0.225, deduction: 662.77 },
     { startValue: 4664.69, limit: null, rate: 0.275, deduction: 896.00 },
];

const IR_TABLE_0525_0126: TaxBracket[] = [
    { startValue: 0.00, limit: 2428.80, rate: 0.00, deduction: 0.00 },
    { startValue: 2428.81, limit: 2826.65, rate: 0.075, deduction: 182.16 },
    { startValue: 2826.66, limit: 3751.05, rate: 0.15, deduction: 394.16 },
    { startValue: 3751.06, limit: 4664.68, rate: 0.225, deduction: 675.49 },
    { startValue: 4664.69, limit: null, rate: 0.275, deduction: 908.73 },
];

// New Table from Jan 2026 onwards
const IR_TABLE_JAN_2026: TaxBracket[] = [
    { startValue: 0.00, limit: 2428.80, rate: 0.00, deduction: 0.00 },
    { startValue: 2428.81, limit: 2826.65, rate: 0.075, deduction: 182.16 },
    { startValue: 2826.66, limit: 3751.05, rate: 0.15, deduction: 394.16 },
    { startValue: 3751.06, limit: 4664.68, rate: 0.225, deduction: 675.49 },
    { startValue: 4664.69, limit: null, rate: 0.275, deduction: 908.73 },
];

// ============================================================================
// INSS TABLES (Calendar Year)
// ============================================================================

const INSS_TABLE_2024: TaxBracket[] = [
    { startValue: 0.00, limit: 1412.00, rate: 0.075, deduction: 0.00 },
    { startValue: 1412.01, limit: 2666.68, rate: 0.09, deduction: 21.18 },
    { startValue: 2666.69, limit: 4000.03, rate: 0.12, deduction: 101.18 },
    { startValue: 4000.04, limit: 7786.02, rate: 0.14, deduction: 181.18 },
];

const INSS_TABLE_2025: TaxBracket[] = [
    { startValue: 0.00, limit: 1518.00, rate: 0.075, deduction: 0.00 },
    { startValue: 1518.01, limit: 2793.88, rate: 0.09, deduction: 22.77 },
    { startValue: 2793.89, limit: 4190.83, rate: 0.12, deduction: 106.59 },
    { startValue: 4190.84, limit: 8157.41, rate: 0.14, deduction: 190.42 }, 
];

const INSS_TABLE_2026: TaxBracket[] = [
    { startValue: 0.00, limit: 1621.00, rate: 0.075, deduction: 0.00 },
    { startValue: 1621.01, limit: 2902.84, rate: 0.09, deduction: 23.66 },
    { startValue: 2902.85, limit: 4354.27, rate: 0.12, deduction: 110.75 },
    { startValue: 4354.28, limit: 8475.55, rate: 0.14, deduction: 197.83 },
];

// ============================================================================
// HOLIDAYS
// ============================================================================

export const HOLIDAYS_2024: Holiday[] = [
  { date: '2024-01-01', name: 'Confraternização Universal', type: 'Nacional' },
  { date: '2024-03-29', name: 'Paixão de Cristo', type: 'Nacional' },
  { date: '2024-04-21', name: 'Tiradentes', type: 'Nacional' },
  { date: '2024-05-01', name: 'Dia do Trabalho', type: 'Nacional' },
  { date: '2024-05-30', name: 'Corpus Christi', type: 'Nacional' },
  { date: '2024-07-09', name: 'Revolução Constitucionalista', type: 'Estadual' },
  { date: '2024-09-07', name: 'Independência do Brasil', type: 'Nacional' },
  { date: '2024-10-12', name: 'Nossa Senhora Aparecida', type: 'Nacional' },
  { date: '2024-11-02', name: 'Finados', type: 'Nacional' },
  { date: '2024-11-15', name: 'Proclamação da República', type: 'Nacional' },
  { date: '2024-11-20', name: 'Consciência Negra', type: 'Nacional' },
  { date: '2024-12-25', name: 'Natal', type: 'Nacional' },
];

export const HOLIDAYS_2025: Holiday[] = [
  { date: '2025-01-01', name: 'Confraternização Universal', type: 'Nacional' },
  { date: '2025-04-18', name: 'Paixão de Cristo', type: 'Nacional' },
  { date: '2025-04-21', name: 'Tiradentes', type: 'Nacional' },
  { date: '2025-05-01', name: 'Dia do Trabalho', type: 'Nacional' },
  { date: '2025-06-19', name: 'Corpus Christi', type: 'Nacional' },
  { date: '2025-07-09', name: 'Revolução Constitucionalista', type: 'Estadual' },
  { date: '2025-07-14', name: 'Aniversário de Campinas', type: 'Municipal' },
  { date: '2025-08-12', name: 'Dia do Evangélico', type: 'Municipal' },
  { date: '2025-09-07', name: 'Independência do Brasil', type: 'Nacional' },
  { date: '2025-10-12', name: 'Nossa Senhora Aparecida', type: 'Nacional' },
  { date: '2025-11-02', name: 'Finados', type: 'Nacional' },
  { date: '2025-11-15', name: 'Proclamação da República', type: 'Nacional' },
  { date: '2025-11-20', name: 'Consciência Negra', type: 'Nacional' },
  { date: '2025-12-08', name: 'Nossa Senhora da Conceição', type: 'Municipal' },
  { date: '2025-12-25', name: 'Natal', type: 'Nacional' },
];

export const HOLIDAYS_2026: Holiday[] = [
  { date: '2026-01-01', name: 'Confraternização Universal', type: 'Nacional' },
  { date: '2026-04-03', name: 'Paixão de Cristo', type: 'Nacional' },
  { date: '2026-04-21', name: 'Tiradentes', type: 'Nacional' },
  { date: '2026-05-01', name: 'Dia do Trabalho', type: 'Nacional' },
  { date: '2026-06-04', name: 'Corpus Christi', type: 'Nacional' },
  { date: '2026-09-07', name: 'Independência do Brasil', type: 'Nacional' },
  { date: '2026-10-12', name: 'Nossa Senhora Aparecida', type: 'Nacional' },
  { date: '2026-11-02', name: 'Finados', type: 'Nacional' },
  { date: '2026-11-15', name: 'Proclamação da República', type: 'Nacional' },
  { date: '2026-11-20', name: 'Consciência Negra', type: 'Nacional' },
  { date: '2026-12-25', name: 'Natal', type: 'Nacional' },
];

export const STANDARD_HOLIDAYS: Holiday[] = [...HOLIDAYS_2024, ...HOLIDAYS_2025, ...HOLIDAYS_2026];

// ============================================================================
// CCT HISTORY DATA (For the Manager Modal)
// ============================================================================

export const CCT_HISTORY_DATA: CCTConfigData[] = [
  {
    id: 'config_inicial',
    label: 'Config. Inicial',
    period: 'Anterior a 2022',
    inpc: 0.00,
    otherCorrection: 0.00,
    salary: { cmte: 9400.00, fo: 4900.00, mecanico: 3416.15, comissario: 2277.43 },
    hours: { flightHour: 140.00, simulatorHour: 122.00, groundHour: 50.00 },
    diarias: {
        nacional: { breakfast: 22.19, lunch: 88.77, dinner: 88.77, supper: 88.77 },
        internacional: { southAmerica: 21.00, northAmerica: 21.00, europe: 21.00, uk: 21.00, others: 21.00 }
    },
    valeAlimentacao: { value: 463.21, threshold: 5659.17, payIndependently: false },
    fixedValues: {
        D_OPR: 15000.00, 
        D_SAFETY: 15000.00,
        P_CHEFE: 10000.00,
        G_KEEPER: 2000.00,
        D_GERAL: 15000.00,
        ACORDO: 5000.00,
        TRE_SFE: 2000.00,
        TRI_SFI: 1000.00,
        PERICULOSIDADE_PERCENT: 0.30,
        FOLGA_DESLOCADA: 700.00, 
    },
    dsrMultiplier: 8,
    feriasOptions: [15, 30]
  },
  {
    id: 'cct_22_23',
    label: 'CCT 22-23',
    period: 'Nov 2022 a Out 2023',
    inpc: 0.0697, 
    otherCorrection: 0.00,
    salary: { cmte: 10055.18, fo: 5241.53, mecanico: 3654.25, comissario: 2436.16 },
    // Fixed at 140.00 despite INPC because rule says "só entra a partir da CCT 23-24" (starts moving then)
    hours: { flightHour: 140.00, simulatorHour: 122.00, groundHour: 50.00 }, 
    diarias: {
        nacional: { breakfast: 23.74, lunch: 94.96, dinner: 94.96, supper: 94.96 },
        internacional: { southAmerica: 21.00, northAmerica: 21.00, europe: 21.00, uk: 21.00, others: 21.00 }
    },
    valeAlimentacao: { value: 495.50, threshold: 5989.87, payIndependently: false },
    fixedValues: {
        D_OPR: 15000.00, 
        D_SAFETY: 15000.00,
        P_CHEFE: 10000.00,
        G_KEEPER: 2000.00,
        D_GERAL: 15000.00,
        ACORDO: 5000.00,
        TRE_SFE: 2000.00,
        TRI_SFI: 1000.00,
        PERICULOSIDADE_PERCENT: 0.30,
        FOLGA_DESLOCADA: 700.00, 
    },
    dsrMultiplier: 8,
    feriasOptions: [15, 30]
  },
  {
    id: 'cct_23_24',
    label: 'CCT 23-24',
    period: 'Nov 2023 a Out 2024',
    inpc: 0.0551, 
    otherCorrection: 0.00,
    salary: { cmte: 10609.22, fo: 5530.33, mecanico: 3855.59, comissario: 2570.39 },
    // Initial Base for the new rule
    hours: { flightHour: 140.00, simulatorHour: 122.00, groundHour: 50.00 },
    diarias: {
        nacional: { breakfast: 25.04, lunch: 100.19, dinner: 100.19, supper: 100.19 },
        internacional: { southAmerica: 21.00, northAmerica: 23.00, europe: 23.00, uk: 23.00, others: 21.00 }
    },
    valeAlimentacao: { value: 522.80, threshold: 6319.91, payIndependently: false },
    fixedValues: {
        D_OPR: 15000.00, 
        D_SAFETY: 15000.00,
        P_CHEFE: 10000.00,
        G_KEEPER: 2000.00,
        D_GERAL: 15000.00,
        ACORDO: 5000.00,
        TRE_SFE: 2000.00,
        TRI_SFI: 1000.00,
        PERICULOSIDADE_PERCENT: 0.30,
        FOLGA_DESLOCADA: 700.00, 
    },
    dsrMultiplier: 8,
    feriasOptions: [15, 30]
  },
  {
    id: 'cct_24_25',
    label: 'CCT 24-25',
    period: 'Nov 2024 a Out 2025',
    inpc: 0.0484,
    otherCorrection: 0.00,
    salary: { cmte: 11122.70, fo: 5797.99, mecanico: 4042.20, comissario: 2694.79 },
    // Adjusted: 140 * 1.0484
    hours: { flightHour: 146.776, simulatorHour: 127.9048, groundHour: 52.42 }, 
    diarias: {
        nacional: { breakfast: 26.25, lunch: 105.03, dinner: 105.03, supper: 105.03 },
        internacional: { southAmerica: 21.00, northAmerica: 23.00, europe: 23.00, uk: 23.00, others: 21.00 }
    },
    valeAlimentacao: { value: 548.10, threshold: 0, payIndependently: true },
    fixedValues: {
        D_OPR: 15726.00, 
        D_SAFETY: 15726.00,
        P_CHEFE: 10484.00,
        G_KEEPER: 2096.80,
        D_GERAL: 15726.00,
        ACORDO: 5242.00,
        TRE_SFE: 2096.80, 
        TRI_SFI: 1048.40,
        PERICULOSIDADE_PERCENT: 0.30,
        FOLGA_DESLOCADA: 700.00, 
    },
    dsrMultiplier: 8,
    feriasOptions: [15, 30]
  },
  {
    id: 'cct_25_26',
    label: 'CCT 25-26',
    period: 'Nov 2025 a Out 2026',
    inpc: 0.0418, 
    otherCorrection: 0.005, 
    salary: { cmte: 11643.24, fo: 6069.34, mecanico: 4231.37, comissario: 2820.91 },
    // Adjusted: 146.776 * 1.0468
    hours: { flightHour: 153.6451, simulatorHour: 133.8907, groundHour: 54.8733 },
    diarias: {
        nacional: { breakfast: 27.49, lunch: 109.95, dinner: 109.95, supper: 109.95 },
        internacional: { southAmerica: 21.00, northAmerica: 23.00, europe: 23.00, uk: 23.00, others: 21.00 }
    },
    valeAlimentacao: { value: 591.95, threshold: 0, payIndependently: true },
    fixedValues: {
        D_OPR: 16461.98, 
        D_SAFETY: 16461.98,
        P_CHEFE: 10974.65,    
        G_KEEPER: 2194.93,
        D_GERAL: 16461.98,
        ACORDO: 5487.33,
        TRE_SFE: 2194.93,
        TRI_SFI: 1097.47,
        PERICULOSIDADE_PERCENT: 0.30,
        FOLGA_DESLOCADA: 732.76, 
    },
    dsrMultiplier: 8,
    feriasOptions: [15, 30]
  }
];

// ============================================================================
// CONFIGURATIONS BY YEAR/PERIOD (CCT / Salaries)
// ============================================================================

const CONFIG_PRE_2024: GlobalConfig = {
  inpc: 0.0,
  otherCorrection: 0.0,
  valeAlimentacao: 463.21, 
  valeAlimentacaoSeparate: false,
  horaVooAnterior: 140.00,
  simuladorAnterior: 122.00,
  horaSoloAnterior: 50.00,
  dsrMultiplier: 8,
  salaryBase: {
    [Role.CMTE]: 9400.00, 
    [Role.FO]: 4900.00,    
  },
  // Base reference values (Oct 24) before Dec 24 adjustment
  fixedValues: {
    D_OPR: 15000.00, 
    D_SAFETY: 15000.00,
    P_CHEFE: 10000.00,
    G_KEEPER: 2000.00,
    D_GERAL: 15000.00,
    ACORDO: 5000.00,
    TRE_SFE: 2000.00,
    TRI_SFI: 1000.00,
    PERICULOSIDADE_PERCENT: 0.30,
    FOLGA_DESLOCADA: 700.00, 
  },
  inssTable: INSS_TABLE_2024,
  irTable: IR_TABLE_0523_0124
};

const CONFIG_2024: GlobalConfig = {
  inpc: 0.0484, // 4.84%
  otherCorrection: 0.0,
  valeAlimentacao: 548.10, 
  valeAlimentacaoSeparate: true,
  horaVooAnterior: 140.00, // Conceptually base from prev year
  simuladorAnterior: 122.00, 
  horaSoloAnterior: 50.00,
  dsrMultiplier: 8,   
  salaryBase: {
    [Role.CMTE]: 11122.70, 
    [Role.FO]: 5797.99,
  },
  // Adjusted by 4.84% (CCT 24-25) over Base Oct 24
  fixedValues: {
    D_OPR: 15726.00, 
    D_SAFETY: 15726.00,
    P_CHEFE: 10484.00,
    G_KEEPER: 2096.80,
    D_GERAL: 15726.00,
    ACORDO: 5242.00,
    TRE_SFE: 2096.80, 
    TRI_SFI: 1048.40,
    PERICULOSIDADE_PERCENT: 0.30,
    FOLGA_DESLOCADA: 700.00, 
  },
  inssTable: INSS_TABLE_2024,
  irTable: IR_TABLE_0224_0425
};

const CONFIG_2025: GlobalConfig = {
  inpc: 0.0418, 
  otherCorrection: 0.005, 
  valeAlimentacao: 591.95,
  valeAlimentacaoSeparate: true,
  horaVooAnterior: 146.776, 
  simuladorAnterior: 127.9048, 
  horaSoloAnterior: 52.42,
  dsrMultiplier: 8,   
  salaryBase: {
    [Role.CMTE]: 11638.79, 
    [Role.FO]: 6066.82,    
  },
  // Adjusted by 4.68% (CCT 25-26) over the 2024 adjusted values
  fixedValues: {
    D_OPR: 16461.98, 
    D_SAFETY: 16461.98,
    P_CHEFE: 10974.65,    
    G_KEEPER: 2194.93,
    D_GERAL: 16461.98,
    ACORDO: 5487.33,
    TRE_SFE: 2194.93, 
    TRI_SFI: 1097.47, 
    PERICULOSIDADE_PERCENT: 0.30,
    FOLGA_DESLOCADA: 732.76, 
  },
  inssTable: INSS_TABLE_2025,
  irTable: IR_TABLE_0525_0126
};

const CONFIG_2026: GlobalConfig = {
  inpc: 0.0, 
  otherCorrection: 0.0, 
  valeAlimentacao: 591.95, 
  valeAlimentacaoSeparate: true,
  horaVooAnterior: 153.6451, 
  simuladorAnterior: 133.8907, 
  horaSoloAnterior: 54.8733,
  dsrMultiplier: 8,   
  salaryBase: {
    [Role.CMTE]: 11638.79, 
    [Role.FO]: 6066.82,    
  },
  // Future: Same as 2025 until next CCT
  fixedValues: {
    D_OPR: 16461.98, 
    D_SAFETY: 16461.98,
    P_CHEFE: 10974.65,    
    G_KEEPER: 2194.93,
    D_GERAL: 16461.98,
    ACORDO: 5487.33,
    TRE_SFE: 2194.93,
    TRI_SFI: 1097.47,
    PERICULOSIDADE_PERCENT: 0.30,
    FOLGA_DESLOCADA: 732.76, 
  },
  inssTable: INSS_TABLE_2026,
  irTable: IR_TABLE_JAN_2026
};

export const INITIAL_CONFIG = CONFIG_2026;

// Helper to merge CCT History Data into GlobalConfig
const applyCCTToConfig = (baseConfig: GlobalConfig, cct: CCTConfigData): GlobalConfig => {
    // Reverse calculate the Base (horaVooAnterior) needed to produce the Target Hourly Rate
    // because generateHourlyRates applies (1 + totalCorrection) to baseConfig.horaVooAnterior.
    // Target = Base * (1 + Correction)  =>  Base = Target / (1 + Correction)
    
    const totalCorrection = cct.inpc + cct.otherCorrection;
    const factor = 1 + totalCorrection;

    // Default to 140/122/50 if not specified (Fallback for very old data if needed)
    const targetFlight = cct.hours ? cct.hours.flightHour : 140.00;
    const targetSim = cct.hours ? cct.hours.simulatorHour : 122.00;
    const targetGround = cct.hours ? cct.hours.groundHour : 50.00;

    const baseFlight = targetFlight / factor;
    const baseSim = targetSim / factor;
    const baseGround = targetGround / factor;

    // Default fixed values if not present in CCT (Fallback to base)
    const fixedValues = cct.fixedValues || baseConfig.fixedValues;

    return {
        ...baseConfig,
        inpc: cct.inpc,
        otherCorrection: cct.otherCorrection,
        valeAlimentacao: cct.valeAlimentacao.value,
        valeAlimentacaoSeparate: cct.valeAlimentacao.payIndependently,
        salaryBase: {
            [Role.CMTE]: cct.salary.cmte,
            [Role.FO]: cct.salary.fo
        },
        fixedValues: fixedValues,
        horaVooAnterior: baseFlight,
        simuladorAnterior: baseSim,
        horaSoloAnterior: baseGround,
        dsrMultiplier: cct.dsrMultiplier || 8
    };
};

export const getConfigForDate = (date: Date, customHistory?: CCTConfigData[]): GlobalConfig => {
  const historySource = customHistory || CCT_HISTORY_DATA;
  const year = date.getFullYear();
  const month = date.getMonth(); 
  
  let baseConfig: GlobalConfig;
  let cctId = '';

  // Determine base year config and CCT ID mapping
  // CCT Cycle (Competence): November (Month 10) to October (Month 9)
  // This ensures the "Payment Month" of December (Month 11) gets the new values (Competence Nov).
  
  if (year < 2024 || (year === 2024 && month < 10)) {
     baseConfig = { ...CONFIG_PRE_2024 };
     cctId = 'config_inicial'; 
     
     // CCT 23-24: Nov 23 to Oct 24
     if ((year === 2023 && month >= 10) || (year === 2024 && month < 10)) {
         cctId = 'cct_23_24';
     } 
     // CCT 22-23: Nov 22 to Oct 23
     else if ((year === 2022 && month >= 10) || (year === 2023 && month < 10)) {
         cctId = 'cct_22_23';
     }
  } else if (year === 2024 && month >= 10) {
     // Start of CCT 24-25 (Competence Nov 24)
     baseConfig = { ...CONFIG_2024 };
     cctId = 'cct_24_25';
  } else if (year === 2025) {
     if (month < 10) {
         // Up to Oct 25 (Part of CCT 24-25)
         baseConfig = { ...CONFIG_2024 };
         cctId = 'cct_24_25';
     } else {
         // Start of CCT 25-26 (Competence Nov 25)
         baseConfig = { ...CONFIG_2025 };
         cctId = 'cct_25_26';
     }
  } else if (year === 2026) {
     if (month < 10) {
         // Up to Oct 26 (Part of CCT 25-26)
         baseConfig = { ...CONFIG_2025 };
         cctId = 'cct_25_26';
     } else {
         baseConfig = { ...CONFIG_2026 };
         cctId = 'cct_26_27'; // Future
     }
  } else {
     // Generic future handling for years > 2026
     baseConfig = { ...CONFIG_2026 }; 
     
     // Generate ID based on pattern cct_YY_YY+1
     // If month >= 10 (Nov), it's the start of next CCT.
     const startYear = month >= 10 ? year : year - 1;
     const endYear = startYear + 1;
     const s = String(startYear).slice(-2);
     const e = String(endYear).slice(-2);
     cctId = `cct_${s}_${e}`;
  }

  // Use historySource (custom or default) to apply values
  if (historySource) {
      const matchedCCT = historySource.find(c => c.id === cctId);
      if (matchedCCT) {
          baseConfig = applyCCTToConfig(baseConfig, matchedCCT);
      } else {
          if (year < 2022) {
              const initCCT = historySource.find(c => c.id === 'config_inicial');
              if (initCCT) baseConfig = applyCCTToConfig(baseConfig, initCCT);
          }
      }
  }

  const checkDate = new Date(year, month, 1);
  const jan2026 = new Date(2026, 0, 1);
  const jan2025 = new Date(2025, 0, 1);
  
  // Tax tables (Currently static, future years use 2026 tables as fallback)
  if (checkDate >= jan2026) {
      baseConfig.inssTable = INSS_TABLE_2026;
  } else if (checkDate >= jan2025) {
      baseConfig.inssTable = INSS_TABLE_2025;
  } else {
      baseConfig.inssTable = INSS_TABLE_2024;
  }

  const feb2024 = new Date(2024, 1, 1);
  const may2025 = new Date(2025, 4, 1);
  
  if (checkDate >= jan2026) {
      baseConfig.irTable = IR_TABLE_JAN_2026;
  } else if (checkDate < feb2024) {
      baseConfig.irTable = IR_TABLE_0523_0124;
  } else if (checkDate < may2025) {
      baseConfig.irTable = IR_TABLE_0224_0425;
  } else {
      baseConfig.irTable = IR_TABLE_0525_0126;
  }

  return baseConfig;
};

export const generateHourlyRates = (baseValue: number, totalCorrection: number, simuladorBase: number, horaSoloBase: number) => {
  const ADJ = 1 + totalCorrection;
  const BASE_CMTE = baseValue * ADJ;
  const RATIO_FO = 0.60; 

  const SIMULADOR_CMTE = simuladorBase * ADJ;
  const HORA_SOLO_CMTE = horaSoloBase * ADJ;

  return {
    [Role.CMTE]: {
      diurna: BASE_CMTE,
      noturna: BASE_CMTE * 2,
      espDiurno: BASE_CMTE * 2,
      espNoturno: BASE_CMTE * 3,
      reDiurno: BASE_CMTE,
      reNoturna: BASE_CMTE * 2,
      reEspDiurno: BASE_CMTE * 2,
      reEspNoturno: BASE_CMTE * 3,
      saDiurno: BASE_CMTE / 3,
      saNoturna: (BASE_CMTE * 2) / 3,
      saEspDiurno: (BASE_CMTE * 2) / 3,
      saEspNoturno: BASE_CMTE, 
      simulador: SIMULADOR_CMTE,
      horaSolo: HORA_SOLO_CMTE,
    },
    [Role.FO]: {
      diurna: BASE_CMTE * RATIO_FO,
      noturna: BASE_CMTE * RATIO_FO * 2,
      espDiurno: BASE_CMTE * RATIO_FO * 2,
      espNoturno: BASE_CMTE * RATIO_FO * 3,
      reDiurno: BASE_CMTE * RATIO_FO,
      reNoturna: BASE_CMTE * RATIO_FO * 2,
      reEspDiurno: BASE_CMTE * RATIO_FO * 2,
      reEspNoturno: BASE_CMTE * RATIO_FO * 3,
      saDiurno: (BASE_CMTE * RATIO_FO) / 3,
      saNoturna: ((BASE_CMTE * RATIO_FO) * 2) / 3,
      saEspDiurno: ((BASE_CMTE * RATIO_FO) * 2) / 3,
      saEspNoturno: BASE_CMTE * RATIO_FO,
      simulador: SIMULADOR_CMTE * RATIO_FO,
      horaSolo: HORA_SOLO_CMTE * RATIO_FO,
    }
  };
};

const createEmptyHours = () => ({
  diurna: 0, noturna: 0, espDiurno: 0, espNoturno: 0,
  reDiurno: 0, reNoturna: 0, reEspDiurno: 0, reEspNoturno: 0,
  saDiurno: 0, saNoturna: 0, saEspDiurno: 0, saEspNoturno: 0,
  simulador: 0, horaSolo: 0
});

export const getEmptyEmployees = (baseList: Employee[]): Employee[] => {
  return baseList.map(emp => ({
    ...emp,
    hours: createEmptyHours(),
    folgaDeslocada: 0,
    atrasoPag225: false,
    atrasoPag325: false,
  }));
};

export const INITIAL_EMPLOYEES: Employee[] = [
    { "id": "1", "seniority": 1, "name": "ANDRÉ PESSOA", "role": Role.CMTE, "baseSalary": 11638.79, "admissionDate": "2022-08-01", "hours": createEmptyHours(), "folgaDeslocada": 0, "atrasoPag225": false, "atrasoPag325": false, "triTre": "NA", "adFuncao": "ACORDO", "equipamento": "A321", "adicionalA330": false, "periculosidade": true, "vacationHistory": [] },
    { "id": "9", "seniority": 2, "name": "PAULO CORREA", "role": Role.CMTE, "baseSalary": 11638.79, "admissionDate": "2024-02-19", "hours": createEmptyHours(), "folgaDeslocada": 0, "atrasoPag225": false, "atrasoPag325": false, "triTre": "TRE", "adFuncao": "ACORDO", "equipamento": "A321", "adicionalA330": false, "periculosidade": true, "vacationHistory": [] },
    { "id": "7", "seniority": 3, "name": "MARCO MONTEIRO", "role": Role.CMTE, "baseSalary": 11638.79, "admissionDate": "2024-03-04", "hours": createEmptyHours(), "folgaDeslocada": 0, "atrasoPag225": false, "atrasoPag325": false, "triTre": "NA", "adFuncao": "NA", "equipamento": "A321", "adicionalA330": false, "periculosidade": true, "vacationHistory": [] },
    { "id": "3", "seniority": 102, "name": "CRIPPA", "role": Role.FO, "baseSalary": 6066.82, "admissionDate": "2024-06-03", "hours": createEmptyHours(), "folgaDeslocada": 0, "atrasoPag225": false, "atrasoPag325": false, "triTre": "NA", "adFuncao": "NA", "equipamento": "A321", "adicionalA330": false, "periculosidade": true, "vacationHistory": [] },
    { "id": "5", "seniority": 101, "name": "LUCAS MENERO", "role": Role.FO, "baseSalary": 6066.82, "admissionDate": "2024-03-04", "hours": createEmptyHours(), "folgaDeslocada": 0, "atrasoPag225": false, "atrasoPag325": false, "triTre": "NA", "adFuncao": "NA", "equipamento": "A321", "adicionalA330": false, "periculosidade": true, "vacationHistory": [] },
    // Other employees with placeholder seniority
    { "id": "2", "seniority": 999, "name": "ANDRESON", "role": Role.CMTE, "baseSalary": 11638.79, "admissionDate": "2024-06-03", "resignationDate": "2025-01-09", "hours": createEmptyHours(), "folgaDeslocada": 0, "atrasoPag225": false, "atrasoPag325": false, "triTre": "NA", "adFuncao": "NA", "equipamento": "A321", "adicionalA330": false, "periculosidade": true, "vacationHistory": [] },
    { "id": "4", "seniority": 999, "name": "ELTON CACEFFO", "role": Role.FO, "baseSalary": 6066.82, "admissionDate": "2024-06-03", "resignationDate": "2025-01-09", "hours": createEmptyHours(), "folgaDeslocada": 0, "atrasoPag225": false, "atrasoPag325": false, "triTre": "NA", "adFuncao": "NA", "equipamento": "A321", "adicionalA330": false, "periculosidade": true, "vacationHistory": [] },
    { "id": "6", "seniority": 999, "name": "MACHADO", "role": Role.CMTE, "baseSalary": 11638.79, "admissionDate": "2022-08-01", "resignationDate": "2025-01-09", "hours": createEmptyHours(), "folgaDeslocada": 0, "atrasoPag225": false, "atrasoPag325": false, "triTre": "TRE", "adFuncao": "ACORDO", "equipamento": "A321", "adicionalA330": false, "periculosidade": true, "vacationHistory": [] },
    { "id": "11", "seniority": 999, "name": "MARCELO DICK", "role": Role.CMTE, "baseSalary": 11638.79, "admissionDate": "2022-08-01", "resignationDate": "2024-02-29", "hours": createEmptyHours(), "folgaDeslocada": 0, "atrasoPag225": false, "atrasoPag325": false, "triTre": "NA", "adFuncao": "NA", "equipamento": "A321", "adicionalA330": false, "periculosidade": true, "vacationHistory": [] },
    { "id": "8", "seniority": 999, "name": "MASCARENHAS", "role": Role.FO, "baseSalary": 6066.82, "admissionDate": "2024-06-03", "resignationDate": "2025-01-09", "hours": createEmptyHours(), "folgaDeslocada": 0, "atrasoPag225": false, "atrasoPag325": false, "triTre": "NA", "adFuncao": "NA", "equipamento": "A321", "adicionalA330": false, "periculosidade": true, "vacationHistory": [] },
    { "id": "10", "seniority": 999, "name": "WILLIAN", "role": Role.CMTE, "baseSalary": 11638.79, "admissionDate": "2024-03-04", "resignationDate": "2025-01-09", "hours": createEmptyHours(), "folgaDeslocada": 0, "atrasoPag225": false, "atrasoPag325": false, "triTre": "TRE", "adFuncao": "D.OPR", "equipamento": "A321", "adicionalA330": false, "periculosidade": true, "vacationHistory": [] }
].sort((a, b) => a.seniority - b.seniority) as any;

export const HISTORICAL_DATA: Record<string, Employee[]> = {};
