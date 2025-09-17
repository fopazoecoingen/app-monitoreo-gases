// Main process de Electron - Versión modular
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Importar módulos
const ModbusRTU = require('./utils/modbus');
const ExcelManager = require('./utils/excel');
const { 
    EXCEL_DIR, 
    EXCEL_FILE, 
    DEV_EXCEL_FILE, 
    SLAVE_ID, 
    ADDR_O2, 
    ADDR_CO, 
    ADDR_CH4,
    UI_CONFIG 
} = require('./config/constants');

// Variables globales
let mainWindow;
let modbusClient;
let excelManager;
let isReading = false;
let currentEventType = 'Normal';
let readingInterval;

// Crear directorio si no existe
if (!fs.existsSync(EXCEL_DIR)) {
    fs.mkdirSync(EXCEL_DIR, { recursive: true });
}

// Función para crear la ventana principal
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, '../preload.js')
        },
        icon: path.join(__dirname, '../src/assets/logo.svg'),
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#2c2c2c',
            symbolColor: '#e0e0e0'
        }
    });

    mainWindow.loadFile(path.join(__dirname, '../index.html'));

    // Abrir DevTools en desarrollo
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Inicializar aplicación
app.whenReady().then(() => {
    createWindow();
    setupIPC();
    
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Configurar IPC handlers
function setupIPC() {
    // Auto-conectar
    ipcMain.handle('auto-connect', async () => {
        try {
            modbusClient = new ModbusRTU();
            const result = await modbusClient.connect('COM9', 9600);
            
            // Inicializar Excel manager
            const isDevelopment = process.env.NODE_ENV === 'development';
            const excelPath = isDevelopment ? DEV_EXCEL_FILE : EXCEL_FILE;
            excelManager = new ExcelManager(excelPath);
            excelManager.ensureDirectoryExists();
            await excelManager.initialize();
            
            return { 
                success: true, 
                port: 'COM9', 
                slaveId: SLAVE_ID,
                message: 'Conectado automáticamente' 
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Conectar puerto serie
    ipcMain.handle('connect-serial', async (event, portPath, baudRate) => {
        try {
            modbusClient = new ModbusRTU();
            const result = await modbusClient.connect(portPath, baudRate);
            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Desconectar puerto serie
    ipcMain.handle('disconnect-serial', async () => {
        try {
            if (modbusClient) {
                const result = await modbusClient.disconnect();
                modbusClient = null;
                return result;
            }
            return { success: true, message: 'Ya estaba desconectado' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Iniciar lectura
    ipcMain.handle('start-reading', async () => {
        if (isReading) {
            return { success: false, message: 'Ya está leyendo datos' };
        }
        
        if (!modbusClient || !excelManager) {
            return { success: false, message: 'No hay conexión o Excel no inicializado' };
        }
        
        isReading = true;
        startReadingLoop();
        return { success: true, message: 'Iniciando lectura de datos' };
    });

    // Detener lectura
    ipcMain.handle('stop-reading', async () => {
        isReading = false;
        if (readingInterval) {
            clearInterval(readingInterval);
        }
        return { success: true, message: 'Lectura detenida' };
    });

    // Eventos de calibración
    ipcMain.handle('set-calibration-event', async (event, eventType) => {
        currentEventType = eventType;
        return { success: true, eventType: eventType };
    });

    // Obtener ruta del archivo Excel
    ipcMain.handle('get-excel-file-path', async () => {
        const isDevelopment = process.env.NODE_ENV === 'development';
        return isDevelopment ? DEV_EXCEL_FILE : EXCEL_FILE;
    });

    // Seleccionar carpeta de guardado
    ipcMain.handle('select-excel-folder', async () => {
        try {
            const result = await dialog.showOpenDialog({
                properties: ['openDirectory'],
                title: 'Seleccionar carpeta para guardar archivos Excel',
                defaultPath: EXCEL_DIR
            });
            
            if (!result.canceled && !result.cancelled && result.filePaths && result.filePaths.length > 0) {
                const selectedPath = result.filePaths[0];
                const newExcelPath = path.join(selectedPath, 'lecturas_ch4_co_o2.xlsx');
                
                // Crear nuevo Excel manager con la nueva ruta
                excelManager = new ExcelManager(newExcelPath);
                excelManager.ensureDirectoryExists();
                await excelManager.initialize();
                
                return { success: true, path: newExcelPath };
            }
            
            return { success: false, cancelled: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

// Loop de lectura
function startReadingLoop() {
    const readData = async () => {
        if (!isReading || !modbusClient || !excelManager) return;
        
        try {
            const data = await modbusClient.readAnalyzerData(SLAVE_ID, ADDR_O2, ADDR_CO, ADDR_CH4);
            const result = await excelManager.saveData(data.o2, data.co, data.ch4, currentEventType);
            
            // Enviar datos al renderer
            mainWindow.webContents.send('data-update', {
                o2: data.o2,
                co: data.co,
                ch4: data.ch4,
                fecha: result.fecha,
                hora: result.hora,
                eventType: result.eventType
            });
        } catch (error) {
            mainWindow.webContents.send('data-error', error.message);
        }
    };

    // Ejecutar inmediatamente y luego cada intervalo
    readData();
    readingInterval = setInterval(readData, UI_CONFIG.readingInterval);
}
