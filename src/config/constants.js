// Configuración de constantes de la aplicación
const path = require('path');
const os = require('os');

// Configuración de archivos
const EXCEL_DIR = path.join(os.homedir(), 'Documents', 'ModbusAnalyzer');
const EXCEL_FILE = path.join(EXCEL_DIR, 'lecturas_ch4_co_o2.xlsx');
const DEV_EXCEL_FILE = path.join(__dirname, '../../lecturas_ch4_co_o2.xlsx');

// Configuración Modbus
const SLAVE_ID = 1;
const ADDR_O2 = 4;   // 40005 - 40001
const ADDR_CO = 7;   // 40008 - 40001  
const ADDR_CH4 = 11; // 40012 - 40001

// Configuración de la aplicación
const APP_CONFIG = {
    name: 'Monitor Analizador de Gases',
    version: '1.0.0',
    company: 'Ecoingen',
    author: 'Felipe Opazo',
    year: '2025'
};

// Configuración de colores para eventos
const EVENT_COLORS = {
    'Normal': null,
    'ZERO': '#FF6B35',
    'SPAN': '#4CAF50', 
    'INICIO_GAS_PATRON': '#2196F3',
    'FIN_INYECCION_GAS': '#9C27B0'
};

// Configuración de la interfaz
const UI_CONFIG = {
    maxDataPoints: 50,
    readingInterval: 5000, // ms
    resetEventTimeout: 3000, // ms
    toastDuration: 3000 // ms
};

module.exports = {
    EXCEL_DIR,
    EXCEL_FILE,
    DEV_EXCEL_FILE,
    SLAVE_ID,
    ADDR_O2,
    ADDR_CO,
    ADDR_CH4,
    APP_CONFIG,
    EVENT_COLORS,
    UI_CONFIG
};
