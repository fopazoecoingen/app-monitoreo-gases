const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { SerialPort } = require('serialport');
const ExcelJS = require('exceljs');
const fs = require('fs');
const os = require('os');

// Configuración
const EXCEL_DIR = path.join(os.homedir(), 'Documents', 'ModbusAnalyzer');
const EXCEL_FILE = path.join(EXCEL_DIR, 'lecturas_ch4_co_o2.xlsx');
const SLAVE_ID = 1;

// Crear directorio si no existe
if (!fs.existsSync(EXCEL_DIR)) {
    fs.mkdirSync(EXCEL_DIR, { recursive: true });
}

// Para desarrollo, también crear archivo en la carpeta del proyecto
const DEV_EXCEL_FILE = path.join(__dirname, 'lecturas_ch4_co_o2.xlsx');

// Direcciones de los registros
const ADDR_O2 = 4;   // 40005 - 40001
const ADDR_CO = 7;   // Confirmado
const ADDR_CH4 = 11; // Confirmado

let mainWindow;
let port = null;
let isReading = false;
let currentEventType = 'Normal';

// Configuración de gases seleccionados
let selectedGases = {
    o2: true,
    co: true,
    ch4: true
};

// Función para calcular CRC16 Modbus
function calculateCRC16(data) {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
        crc ^= data[i];
        for (let j = 0; j < 8; j++) {
            if (crc & 0x0001) {
                crc = (crc >> 1) ^ 0xA001;
            } else {
                crc = crc >> 1;
            }
        }
    }
    return crc;
}

// Función para crear trama Modbus RTU
function createModbusFrame(slaveId, functionCode, startAddress, quantity) {
    const frame = Buffer.alloc(8);
    frame[0] = slaveId;
    frame[1] = functionCode;
    frame[2] = (startAddress >> 8) & 0xFF;
    frame[3] = startAddress & 0xFF;
    frame[4] = (quantity >> 8) & 0xFF;
    frame[5] = quantity & 0xFF;
    
    const crc = calculateCRC16(frame.slice(0, 6));
    frame[6] = crc & 0xFF;
    frame[7] = (crc >> 8) & 0xFF;
    
    return frame;
}

// Función para leer registros Modbus
function readHoldingRegisters(startAddress, quantity) {
    return new Promise((resolve, reject) => {
        if (!port || !port.isOpen) {
            reject(new Error('Puerto no conectado'));
            return;
        }

        console.log(`Leyendo registros Modbus - Dirección: ${startAddress}, Cantidad: ${quantity}`);
        const frame = createModbusFrame(SLAVE_ID, 0x03, startAddress, quantity);
        let responseBuffer = Buffer.alloc(0);
        let dataReceived = false;
        
        const timeout = setTimeout(() => {
            if (!dataReceived) {
                port.removeAllListeners('data');
                console.error(`Timeout leyendo registros - Dirección: ${startAddress}`);
                reject(new Error(`Timeout al leer registros en dirección ${startAddress}`));
            }
        }, 5000);
        
        const dataHandler = (data) => {
            if (dataReceived) return;
            
            console.log(`Datos recibidos (${data.length} bytes) para dirección ${startAddress}:`, data.toString('hex'));
            responseBuffer = Buffer.concat([responseBuffer, data]);
            
            if (responseBuffer.length >= 5) {
                const byteCount = responseBuffer[2];
                const expectedLength = 3 + byteCount + 2;
                
                if (responseBuffer.length >= expectedLength) {
                    dataReceived = true;
                    clearTimeout(timeout);
                    port.removeAllListeners('data');
                    
                    const receivedCRC = responseBuffer.readUInt16LE(expectedLength - 2);
                    const calculatedCRC = calculateCRC16(responseBuffer.slice(0, expectedLength - 2));
                    
                    if (receivedCRC === calculatedCRC) {
                        const registers = [];
                        for (let i = 0; i < byteCount / 2; i++) {
                            const register = responseBuffer.readUInt16BE(3 + i * 2);
                            registers.push(register);
                        }
                        console.log(`Registros leídos exitosamente para dirección ${startAddress}:`, registers);
                        resolve({ data: registers });
                    } else {
                        console.error(`CRC inválido para dirección ${startAddress} - Recibido: ${receivedCRC.toString(16)}, Calculado: ${calculatedCRC.toString(16)}`);
                        reject(new Error(`CRC inválido en dirección ${startAddress}`));
                    }
                }
            }
        };
        
        port.on('data', dataHandler);
        console.log(`Enviando trama Modbus:`, frame.toString('hex'));
        port.write(frame);
    });
}

// Función para decodificar float de 32 bits
function decodeFloat32(registers) {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt16BE(registers[0], 0);
    buffer.writeUInt16BE(registers[1], 2);
    return buffer.readFloatBE(0);
}

// Función para leer datos del analizador
async function readAnalyzerData() {
    try {
        console.log('Iniciando lectura de datos del analizador...');
        console.log('Gases seleccionados:', selectedGases);
        
        const data = {};
        
        if (selectedGases.o2) {
            console.log('Leyendo O₂...');
            const o2Registers = await readHoldingRegisters(ADDR_O2, 2);
            data.o2 = decodeFloat32(o2Registers.data);
            console.log(`O₂ leído: ${data.o2}`);
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        if (selectedGases.co) {
            console.log('Leyendo CO...');
            const coRegisters = await readHoldingRegisters(ADDR_CO, 2);
            data.co = decodeFloat32(coRegisters.data);
            console.log(`CO leído: ${data.co}`);
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        if (selectedGases.ch4) {
            console.log('Leyendo CH₄...');
            const ch4Registers = await readHoldingRegisters(ADDR_CH4, 2);
            data.ch4 = decodeFloat32(ch4Registers.data);
            console.log(`CH₄ leído: ${data.ch4}`);
        }

        console.log('Datos del analizador leídos exitosamente:', data);
        return data;
    } catch (error) {
        console.error('Error leyendo datos del analizador:', error);
        throw error;
    }
}

// Función para guardar datos en Excel con colores
async function saveToExcel(data, eventType = 'Normal') {
    try {
        const now = new Date();
        const fecha = now.toISOString().split('T')[0];
        const hora = now.toTimeString().split(' ')[0];

        // Usar archivo de desarrollo si estamos en modo desarrollo
        const isDevelopment = process.env.NODE_ENV === 'development' || process.env.npm_lifecycle_event === 'start';
        const targetFile = isDevelopment ? DEV_EXCEL_FILE : EXCEL_FILE;

        const workbook = new ExcelJS.Workbook();
        let worksheet;
        
        if (fs.existsSync(targetFile)) {
            await workbook.xlsx.readFile(targetFile);
            worksheet = workbook.getWorksheet('Gases');
        } else {
            worksheet = workbook.addWorksheet('Gases');
            // Crear encabezados dinámicamente basado en gases seleccionados
            const headers = ['Fecha', 'Hora'];
            if (selectedGases.o2) headers.push('O₂ (%Vol)');
            if (selectedGases.co) headers.push('CO (ppm)');
            if (selectedGases.ch4) headers.push('CH₄ (ppm)');
            headers.push('Evento');
            
            worksheet.addRow(headers);
            
            // Formatear encabezados
            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF2C2C2C' }
            };
            headerRow.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        }
        
        // Crear fila de datos dinámicamente
        const rowData = [fecha, hora];
        if (selectedGases.o2) rowData.push(Math.round(data.o2 * 1000) / 1000);
        if (selectedGases.co) rowData.push(Math.round(data.co * 1000) / 1000);
        if (selectedGases.ch4) rowData.push(Math.round(data.ch4 * 1000) / 1000);
        rowData.push(eventType);
        
        const newRow = worksheet.addRow(rowData);
        
        // Aplicar color de fondo a la fila si no es Normal
        if (eventType !== 'Normal') {
            const eventColor = getEventColor(eventType);
            if (eventColor) {
                // Convertir color hex a ARGB
                const argbColor = eventColor.replace('#', 'FF');
                
                // Aplicar color a toda la fila
                newRow.eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: argbColor }
                    };
                });
            }
        }
        
        // Ajustar ancho de columnas dinámicamente
        const columnWidths = [
            { width: 12 }, // Fecha
            { width: 10 }  // Hora
        ];
        if (selectedGases.o2) columnWidths.push({ width: 12 }); // O₂
        if (selectedGases.co) columnWidths.push({ width: 12 }); // CO
        if (selectedGases.ch4) columnWidths.push({ width: 12 }); // CH₄
        columnWidths.push({ width: 15 }); // Evento
        
        worksheet.columns = columnWidths;
        
        await workbook.xlsx.writeFile(targetFile);
        
        return { fecha, hora, ...data, eventType };
    } catch (error) {
        throw error;
    }
}

// Función para obtener el color del evento
function getEventColor(eventType) {
    const colors = {
        'Normal': null,
        'ZERO': '#FF6B35',
        'SPAN': '#4CAF50', 
        'INICIO_GAS_PATRON': '#2196F3',
        'FIN_INYECCION_GAS': '#9C27B0'
    };
    return colors[eventType] || null;
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
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'icon.png'),
        titleBarStyle: 'default',
        show: false
    });

    mainWindow.loadFile('index.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        if (port && port.isOpen) {
            port.close();
        }
        mainWindow = null;
    });
}

// Eventos de la aplicación
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// IPC Handlers
ipcMain.handle('get-serial-ports', async () => {
    try {
        const ports = await SerialPort.list();
        return ports.map(port => ({
            path: port.path,
            manufacturer: port.manufacturer || 'Desconocido',
            serialNumber: port.serialNumber || 'N/A'
        }));
    } catch (error) {
        throw error;
    }
});

ipcMain.handle('connect-serial', async (event, portPath, baudRate) => {
    try {
        if (port && port.isOpen) {
            port.close();
        }
        
        port = new SerialPort({
            path: portPath,
            baudRate: parseInt(baudRate),
            dataBits: 8,
            stopBits: 1,
            parity: 'none'
        });

        return new Promise((resolve, reject) => {
            port.on('open', () => {
                resolve({ success: true, message: 'Conectado exitosamente' });
            });
            
            port.on('error', (err) => {
                reject(new Error(`Error de conexión: ${err.message}`));
            });
        });
    } catch (error) {
        throw error;
    }
});

ipcMain.handle('disconnect-serial', async () => {
    try {
        if (port && port.isOpen) {
            port.close();
            port = null;
        }
        return { success: true, message: 'Desconectado exitosamente' };
    } catch (error) {
        throw error;
    }
});

ipcMain.handle('start-reading', async () => {
    if (isReading) {
        return { success: false, message: 'Ya está leyendo datos' };
    }
    
    // Verificar que el puerto esté conectado
    if (!port || !port.isOpen) {
        return { success: false, message: 'Puerto no conectado. Conecta primero el puerto serie.' };
    }
    
    // Verificar que al menos un gas esté seleccionado
    if (!selectedGases.o2 && !selectedGases.co && !selectedGases.ch4) {
        return { success: false, message: 'No hay gases seleccionados para monitorear' };
    }
    
    isReading = true;
    
    const readLoop = async () => {
        if (!isReading) return;
        
        try {
            const data = await readAnalyzerData();
            const result = await saveToExcel(data, currentEventType);
            
            mainWindow.webContents.send('data-update', {
                ...data,
                fecha: result.fecha,
                hora: result.hora,
                eventType: result.eventType
            });
        } catch (error) {
            console.error('Error en lectura de datos:', error);
            mainWindow.webContents.send('data-error', error.message);
        }
        
        setTimeout(readLoop, 5000);
    };
    
    readLoop();
    
    return { success: true, message: 'Iniciando lectura de datos' };
});

ipcMain.handle('stop-reading', async () => {
    console.log('Deteniendo lectura de datos...');
    isReading = false;
    console.log('Lectura detenida exitosamente');
    return { success: true, message: 'Deteniendo lectura de datos' };
});


// Auto-conectar al iniciar la aplicación
ipcMain.handle('auto-connect', async () => {
    try {
        const defaultPort = 'COM9';
        const defaultSlaveId = 1;
        
        console.log(`Intentando auto-conectar a ${defaultPort}...`);
        
        if (port && port.isOpen) {
            console.log('Cerrando puerto existente...');
            port.close();
        }
        
        port = new SerialPort({
            path: defaultPort,
            baudRate: 9600,
            dataBits: 8,
            stopBits: 1,
            parity: 'none'
        });

        return new Promise((resolve, reject) => {
            port.on('open', () => {
                console.log(`Puerto ${defaultPort} abierto exitosamente`);
                resolve({ success: true, message: 'Conectado automáticamente', port: defaultPort, slaveId: defaultSlaveId });
            });
            
            port.on('error', (err) => {
                console.error(`Error de puerto ${defaultPort}:`, err);
                reject(new Error(`Error de auto-conexión: ${err.message}`));
            });
        });
    } catch (error) {
        console.error('Error en auto-conexión:', error);
        return { success: false, error: error.message };
    }
});

// Handler para eventos de calibración
ipcMain.handle('set-calibration-event', async (event, eventType) => {
    currentEventType = eventType;
    return { success: true, eventType: eventType };
});

// Handler para obtener la ruta del archivo Excel
ipcMain.handle('get-excel-file-path', async () => {
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.npm_lifecycle_event === 'start';
    return isDevelopment ? DEV_EXCEL_FILE : EXCEL_FILE;
});

// Handler para seleccionar carpeta de archivo Excel
ipcMain.handle('select-excel-folder', async () => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Seleccionar carpeta para archivo Excel',
            properties: ['openDirectory'],
            defaultPath: EXCEL_DIR
        });

        if (result.canceled) {
            return { success: false, cancelled: true };
        }

        const selectedPath = result.filePaths[0];
        return { 
            success: true, 
            path: selectedPath,
            message: 'Carpeta seleccionada exitosamente'
        };
    } catch (error) {
        return { 
            success: false, 
            error: error.message,
            message: 'Error al seleccionar carpeta'
        };
    }
});

// Handler para obtener configuración de gases seleccionados
ipcMain.handle('get-selected-gases', async () => {
    return selectedGases;
});

// Handler para actualizar configuración de gases seleccionados
ipcMain.handle('update-selected-gases', async (event, gasConfig) => {
    // Validar que al menos un gas esté seleccionado
    if (!gasConfig.o2 && !gasConfig.co && !gasConfig.ch4) {
        return { success: false, error: 'Al menos un gas debe estar seleccionado' };
    }
    
    selectedGases = gasConfig;
    return { success: true, message: 'Configuración de gases actualizada' };
});