const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { SerialPort } = require('serialport');
const ExcelJS = require('exceljs');
const fs = require('fs');
const os = require('os');
const DatabaseManager = require('./src/utils/database');
const BlobSender = require('./src/utils/blob-sender');

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
const ADDR_CO2 = 9;  // Registro 9 para CO2

let mainWindow;
let port = null;
let isReading = false;
let currentEventType = 'Normal';
let databaseManager = null;
let blobSender = null;
let currentMeasurementId = null; // ID de la medición actual
let measurementStartTime = null; // Tiempo de inicio de la medición actual
let measurementData = []; // Datos acumulados durante la sesión

// Configuración de gases seleccionados
let selectedGases = {
    o2: true,
    co: true,
    ch4: true,
    co2: true
};

// Función para acumular datos durante la sesión de medición
function accumulateMeasurementData(currentData) {
    const timestamp = new Date();
    measurementData.push({
        ...currentData,
        timestamp: timestamp,
        relativeTime: measurementStartTime ? 
            Math.round((timestamp - measurementStartTime) / 1000) : 0 // segundos desde inicio
    });
    
    console.log(`Datos acumulados para medición ${currentMeasurementId}. Total lecturas: ${measurementData.length}`);
}

// Función para calcular datos promedio de la sesión
function calculateAverageData() {
    if (measurementData.length === 0) {
        return { o2: null, co: null, ch4: null };
    }
    
    const validData = measurementData.filter(d => 
        (d.o2 !== undefined && d.o2 !== null) || 
        (d.co !== undefined && d.co !== null) || 
        (d.ch4 !== undefined && d.ch4 !== null)
    );
    
    if (validData.length === 0) {
        return { o2: null, co: null, ch4: null };
    }
    
    const avgO2 = validData.filter(d => d.o2 !== undefined && d.o2 !== null)
        .reduce((sum, d) => sum + d.o2, 0) / validData.filter(d => d.o2 !== undefined && d.o2 !== null).length;
    
    const avgCO = validData.filter(d => d.co !== undefined && d.co !== null)
        .reduce((sum, d) => sum + d.co, 0) / validData.filter(d => d.co !== undefined && d.co !== null).length;
    
    const avgCH4 = validData.filter(d => d.ch4 !== undefined && d.ch4 !== null)
        .reduce((sum, d) => sum + d.ch4, 0) / validData.filter(d => d.ch4 !== undefined && d.ch4 !== null).length;
    
    return {
        o2: isNaN(avgO2) ? null : Math.round(avgO2 * 100) / 100,
        co: isNaN(avgCO) ? null : Math.round(avgCO * 100) / 100,
        ch4: isNaN(avgCH4) ? null : Math.round(avgCH4 * 100) / 100
    };
}

// Función para actualizar la medición actual en la base de datos
async function updateCurrentMeasurement(data) {
    if (!databaseManager || !currentMeasurementId || !databaseManager.isDatabaseConnected()) {
        console.log('No se puede actualizar medición: base de datos no conectada o medición no activa');
        return;
    }
    
    try {
        // Actualizar los valores en la tabla detalle_medicion
        const query = `
            UPDATE detalle_medicion 
            SET o2 = ?, co = ?, ch4 = ?
            WHERE medicion_id = ?
        `;
        
        await new Promise((resolve, reject) => {
            // Guardar referencia a la base de datos
            const db = databaseManager.db;
            
            if (!db) {
                reject(new Error('Base de datos no está conectada'));
                return;
            }
            
            db.run(query, [data.o2, data.co, data.ch4, currentMeasurementId], (err) => {
                if (err) {
                    console.error('Error actualizando medición:', err.message);
                    reject(err);
                } else {
                    console.log(`Medición ${currentMeasurementId} actualizada con valores promedio`);
                    resolve();
                }
            });
        });
    } catch (error) {
        console.error('Error en updateCurrentMeasurement:', error);
    }
}

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
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        if (selectedGases.co2) {
            console.log('Leyendo CO₂...');
            const co2Registers = await readHoldingRegisters(ADDR_CO2, 2);
            data.co2 = decodeFloat32(co2Registers.data);
            console.log(`CO₂ leído: ${data.co2}`);
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
        // Usar zona horaria local en lugar de UTC
        const fecha = now.toLocaleDateString('en-CA'); // Formato YYYY-MM-DD
        const hora = now.toLocaleTimeString('en-GB', { hour12: false }); // Formato HH:MM:SS

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
            if (selectedGases.co2) headers.push('CO₂ (%)');
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
        if (selectedGases.co2) rowData.push(Math.round(data.co2 * 1000) / 1000);
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

// Función para inicializar la base de datos
async function initializeDatabase() {
    try {
        databaseManager = new DatabaseManager();
        await databaseManager.connect();
        await databaseManager.initialize();
        console.log('Base de datos SQLite inicializada correctamente');
        
        // Inicializar servicio de blobs con autenticación automática
        blobSender = new BlobSender();
        
        // Configurar blob service con autenticación automática
        try {
            console.log('🔧 Configurando servicio de blobs...');
            const blobConfig = {
                baseUrl: 'https://ecoingen-api-produccion.azurewebsites.net',
                endpoint: '/api/Storage/uploadExcelMedicionesSoftware',
                apiKey: 'dummy-token', // No se usa realmente, se obtiene dinámicamente
                containerName: 'mediciones'
            };
            
            console.log('📋 Configuración de blobs:', blobConfig);
            console.log('🔐 Iniciando configuración con autenticación automática...');
            
            const configResult = await blobSender.blobService.configure(blobConfig);
            console.log('📊 Resultado de configuración:', configResult);
            
            if (configResult.success) {
                console.log('✅ Servicio de blobs configurado con autenticación automática');
            } else {
                console.log('❌ Error en configuración de blobs:', configResult.error);
            }
        } catch (error) {
            console.error('❌ Error configurando servicio de blobs:', error.message);
            console.error('📊 Stack trace:', error.stack);
        }
    } catch (error) {
        console.error('Error inicializando base de datos:', error);
    }
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
        icon: path.join(__dirname, 'src', 'assets', 'logo_eco.png'),
        titleBarStyle: 'default',
        show: false
    });

    mainWindow.loadFile('index.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', async () => {
        if (port && port.isOpen) {
            port.close();
        }
        if (databaseManager) {
            await databaseManager.close();
        }
        mainWindow = null;
    });
}

// Eventos de la aplicación
app.whenReady().then(async () => {
    await initializeDatabase();
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        // Limpiar recursos de autenticación antes de cerrar
        if (blobSender && blobSender.authService) {
            blobSender.authService.cleanup();
        }
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Limpiar recursos cuando la aplicación se cierre inesperadamente
process.on('SIGINT', () => {
    console.log('🛑 Cerrando aplicación...');
    if (blobSender && blobSender.authService) {
        blobSender.authService.cleanup();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 Cerrando aplicación...');
    if (blobSender && blobSender.authService) {
        blobSender.authService.cleanup();
    }
    process.exit(0);
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

// Marcar evento específico por gas
ipcMain.handle('mark-gas-event', async (event, gas, action) => {
    try {
        const now = new Date();
        const eventMap = {
            'ZERO': 'ZERO',
            'SPAN': 'SPAN',
            'INICIO': 'INICIO_GAS_PATRON',
            'FIN': 'FIN_INYECCION_GAS'
        };
        const resolvedEvent = eventMap[action] || 'Normal';

        // Leer datos actuales (última lectura disponible si hay puerto)
        let currentData = { o2: null, co: null, ch4: null, co2: null };
        try {
            const data = await readAnalyzerData();
            currentData = { ...currentData, ...data };
        } catch (err) {
            // Si falla la lectura, continuamos solo con marca de tiempo
            console.warn('No se pudo leer datos para el hito, se guardará solo evento:', err.message);
        }

        // Filtrar para que solo se guarde el gas indicado en Excel
        const excelData = { o2: null, co: null, ch4: null, co2: null };
        if (gas === 'o2') excelData.o2 = currentData.o2;
        if (gas === 'co') excelData.co = currentData.co;
        if (gas === 'ch4') excelData.ch4 = currentData.ch4;
        if (gas === 'co2') excelData.co2 = currentData.co2;

        // Guardar una fila en Excel con el evento específico
        await saveToExcel(excelData, `${resolvedEvent}_${gas.toUpperCase()}`);

        // Registrar en la base de datos como lectura detallada/hito si hay una medición activa
        if (databaseManager && databaseManager.isDatabaseConnected()) {
            if (currentMeasurementId) {
                const timestamp = now.toLocaleString('sv-SE');
                try {
                    await databaseManager.saveDetailedReading(
                        currentMeasurementId,
                        excelData,
                        timestamp,
                        `${resolvedEvent}_${gas.toUpperCase()}`
                    );
                } catch (error) {
                    console.error('Error guardando hito en DB:', error);
                }
            }
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
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
    
    // Crear nueva medición al iniciar el monitoreo
    try {
        const now = new Date();
        measurementStartTime = now;
        measurementData = []; // Limpiar datos anteriores
        
                // Crear nueva medición en la base de datos
                if (databaseManager && databaseManager.isDatabaseConnected()) {
                    const dbResult = await databaseManager.saveGasReading(
                        { o2: null, co: null, ch4: null }, // Datos vacíos iniciales
                        currentEventType,
                        'Iniciando sesión de monitoreo',
                        now.toLocaleString('sv-SE'), // tiempo_inicio (formato YYYY-MM-DD HH:mm:ss)
                        null // tiempo_fin (se actualizará al terminar)
                    );
                    currentMeasurementId = dbResult.medicion_id;
                    console.log(`Nueva medición iniciada con ID: ${currentMeasurementId}`);
                }
        
        // También crear entrada en Excel
        const excelResult = await saveToExcel(
            { o2: null, co: null, ch4: null }, // Datos vacíos iniciales
            currentEventType
        );
        
        mainWindow.webContents.send('measurement-started', {
            measurementId: currentMeasurementId,
            startTime: now,
            eventType: currentEventType
        });
        
    } catch (error) {
        console.error('Error creando nueva medición:', error);
        return { success: false, message: 'Error creando nueva medición: ' + error.message };
    }
    
    isReading = true;
    
    const readLoop = async () => {
        if (!isReading) return;
        
        try {
            const data = await readAnalyzerData();
            
            // Acumular datos durante la sesión de medición
            accumulateMeasurementData(data);
            
                    // Guardar lectura detallada en la base de datos
                    if (databaseManager && databaseManager.isDatabaseConnected() && currentMeasurementId) {
                        const ahora = new Date();
                        const tiempoRelativo = ahora.toLocaleString('sv-SE'); // Timestamp local (YYYY-MM-DD HH:mm:ss)
                        
                        try {
                            await databaseManager.saveDetailedReading(currentMeasurementId, data, tiempoRelativo, currentEventType);
                        } catch (error) {
                            console.error('Error guardando lectura detallada:', error);
                        }
                    }
            
            // Actualizar la medición actual en la base de datos con los datos promedio
            if (databaseManager && databaseManager.isDatabaseConnected() && currentMeasurementId) {
                // Calcular valores promedio de la sesión
                const avgData = calculateAverageData();
                
                // Actualizar la medición existente
                await updateCurrentMeasurement(avgData);
            }
            
            // También actualizar Excel con datos en tiempo real
            const result = await saveToExcel(data, currentEventType);
            
            // Enviar actualización al frontend
            mainWindow.webContents.send('data-update', {
                ...data,
                fecha: result.fecha,
                hora: result.hora,
                eventType: result.eventType,
                measurementId: currentMeasurementId,
                sessionDuration: measurementStartTime ? 
                    Math.round((new Date() - measurementStartTime) / 1000) : 0,
                totalReadings: measurementData.length
            });
            
        } catch (error) {
            console.error('Error en lectura de datos:', error);
            mainWindow.webContents.send('data-error', error.message);
        }
        
        setTimeout(readLoop, 5000); // Intervalo de lectura: 5 segundos
    };
    
    readLoop();
    
    console.log('⏰ Intervalo de lectura configurado: 5 segundos');
    return { success: true, message: 'Iniciando lectura de datos cada 5 segundos' };
});

ipcMain.handle('stop-reading', async () => {
    console.log('Deteniendo lectura de datos...');
    
            // Finalizar la medición actual
            if (currentMeasurementId && measurementData.length > 0) {
                try {
                    // Calcular valores finales promedio
                    const finalData = calculateAverageData();
                    
                    // Actualizar la medición con los valores finales
                    await updateCurrentMeasurement(finalData);
                    
                    // Actualizar tiempo de fin y observaciones con información de la sesión
                    const now = new Date();
                    const duration = measurementStartTime ? 
                        Math.round((now - measurementStartTime) / 1000) : 0;
                    const observation = `Sesión finalizada. Duración: ${duration}s, Lecturas: ${measurementData.length}`;
                    
                    // Actualizar tiempo de fin y observaciones en la tabla medicion
                    if (databaseManager && databaseManager.isDatabaseConnected()) {
                        const updateQuery = `
                            UPDATE medicion 
                            SET tiempo_fin = ?, observaciones = ?
                            WHERE id = ?
                        `;
                        
                        await new Promise((resolve, reject) => {
                            // Guardar referencia a la base de datos
                            const db = databaseManager.db;
                            
                            if (!db) {
                                reject(new Error('Base de datos no está conectada'));
                                return;
                            }
                            
                            db.run(updateQuery, [now.toLocaleString('sv-SE'), observation, currentMeasurementId], (err) => {
                                if (err) {
                                    console.error('Error actualizando tiempo de fin y observaciones:', err.message);
                                    reject(err);
                                } else {
                                    console.log(`Medición ${currentMeasurementId} finalizada con tiempo de fin y observaciones`);
                                    resolve();
                                }
                            });
                        });
                    }
            
            // Enviar notificación de medición completada
            mainWindow.webContents.send('measurement-completed', {
                measurementId: currentMeasurementId,
                duration: duration,
                totalReadings: measurementData.length,
                finalData: finalData
            });
            
            console.log(`Medición ${currentMeasurementId} completada exitosamente`);
            
        } catch (error) {
            console.error('Error finalizando medición:', error);
        }
    }
    
    // Limpiar variables de sesión
    currentMeasurementId = null;
    measurementStartTime = null;
    measurementData = [];
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

// ===== HANDLERS PARA BASE DE DATOS SQLite =====

// Obtener todas las lecturas de la base de datos
ipcMain.handle('get-all-readings', async (event, limit = null, offset = 0) => {
    try {
        if (!databaseManager || !databaseManager.isDatabaseConnected()) {
            return { success: false, error: 'Base de datos no conectada' };
        }
        
        const readings = await databaseManager.getAllReadings();
        return readings;
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Obtener lecturas por rango de fechas
ipcMain.handle('get-readings-by-date-range', async (event, startDate, endDate) => {
    try {
        if (!databaseManager || !databaseManager.isDatabaseConnected()) {
            return { success: false, error: 'Base de datos no conectada' };
        }
        
        const readings = await databaseManager.getReadingsByDateRange(startDate, endDate);
        return readings;
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Obtener lecturas por evento
ipcMain.handle('get-readings-by-event', async (event, eventType) => {
    try {
        if (!databaseManager || !databaseManager.isDatabaseConnected()) {
            return { success: false, error: 'Base de datos no conectada' };
        }
        
        const readings = await databaseManager.getReadingsByEvent(eventType);
        return { success: true, data: readings };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Obtener estadísticas de gases
ipcMain.handle('get-gas-statistics', async (event, startDate = null, endDate = null) => {
    try {
        if (!databaseManager || !databaseManager.isDatabaseConnected()) {
            return { success: false, error: 'Base de datos no conectada' };
        }
        
        const statistics = await databaseManager.getGasStatistics(startDate, endDate);
        return { success: true, data: statistics };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Exportar datos a CSV
ipcMain.handle('export-data-to-csv', async (event, startDate = null, endDate = null) => {
    try {
        if (!databaseManager || !databaseManager.isDatabaseConnected()) {
            return { success: false, error: 'Base de datos no conectada' };
        }
        
        const csvData = await databaseManager.exportToCSV(startDate, endDate);
        return { success: true, data: csvData };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Eliminar lecturas por rango de fechas
ipcMain.handle('delete-readings-by-date-range', async (event, startDate, endDate) => {
    try {
        if (!databaseManager || !databaseManager.isDatabaseConnected()) {
            return { success: false, error: 'Base de datos no conectada' };
        }
        
        const result = await databaseManager.deleteReadingsByDateRange(startDate, endDate);
        return result;
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Obtener información de la base de datos
ipcMain.handle('get-database-info', async () => {
    try {
        if (!databaseManager) {
            return { success: false, error: 'DatabaseManager no inicializado' };
        }
        
        const info = databaseManager.getDatabaseInfo();
        return { success: true, data: info };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Obtener el último ID de medición
ipcMain.handle('get-last-measurement-id', async () => {
    try {
        if (!databaseManager || !databaseManager.isDatabaseConnected()) {
            return { success: false, error: 'Base de datos no conectada' };
        }
        
        const lastId = await databaseManager.getLastMeasurementId();
        return { success: true, data: lastId };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Obtener lecturas detalladas de una medición
ipcMain.handle('get-detailed-readings', async (event, medicionId) => {
    try {
        if (!databaseManager || !databaseManager.isDatabaseConnected()) {
            return { success: false, error: 'Base de datos no conectada' };
        }
        
        const readings = await databaseManager.getDetailedReadings(medicionId);
        return readings;
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Eliminar medición
ipcMain.handle('delete-medicion', async (event, medicionId) => {
    try {
        if (!databaseManager || !databaseManager.isDatabaseConnected()) {
            return { success: false, error: 'Base de datos no conectada' };
        }
        
        const result = await databaseManager.deleteMedicion(medicionId);
        return result;
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Actualizar tiempo de fin de medición
ipcMain.handle('update-medicion-tiempo-fin', async (event, medicionId, tiempoFin) => {
    try {
        if (!databaseManager || !databaseManager.isDatabaseConnected()) {
            return { success: false, error: 'Base de datos no conectada' };
        }
        
        const result = await databaseManager.updateMedicionTiempoFin(medicionId, tiempoFin);
        return result;
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Guardar lectura manual en la base de datos
ipcMain.handle('save-manual-reading', async (event, data, eventType = 'Normal') => {
    try {
        if (!databaseManager || !databaseManager.isDatabaseConnected()) {
            return { success: false, error: 'Base de datos no conectada' };
        }
        
        const result = await databaseManager.saveGasReading(data, eventType);
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// ===== HANDLERS PARA EXPORTACIÓN Y EMAIL =====

// Exportar mediciones a Excel
ipcMain.handle('export-mediciones-excel', async (event, startDate = null, endDate = null) => {
    try {
        if (!databaseManager || !databaseManager.isDatabaseConnected()) {
            return { success: false, error: 'Base de datos no conectada' };
        }

        const mediciones = startDate && endDate 
            ? await databaseManager.getReadingsByDateRange(startDate, endDate)
            : await databaseManager.getAllReadings();

        if (mediciones.length === 0) {
            return { success: false, error: 'No hay mediciones para exportar' };
        }

        // Crear archivo Excel
        const ExcelJS = require('exceljs');
        const path = require('path');
        const os = require('os');
        
        const exportDir = path.join(os.homedir(), 'Documents', 'ModbusAnalyzer', 'exports');
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }

        const timestamp = new Date().toLocaleString('sv-SE').replace(/[:.]/g, '-').replace(' ', '_');
        const fileName = `mediciones_${timestamp}.xlsx`;
        const filePath = path.join(exportDir, fileName);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Mediciones');

        // Encabezados (formato como Excel original)
        worksheet.addRow(['ID', 'Fecha', 'Hora', 'Evento', 'Observaciones', 'O₂ (%Vol)', 'CO (ppm)', 'CH₄ (ppm)']);

        // Datos
        mediciones.forEach(medicion => {
            worksheet.addRow([
                medicion.medicion_id,
                medicion.fecha,
                medicion.hora,
                medicion.evento,
                medicion.observaciones || '',
                medicion.detalles.o2 ? medicion.detalles.o2.valor : '',
                medicion.detalles.co ? medicion.detalles.co.valor : '',
                medicion.detalles.ch4 ? medicion.detalles.ch4.valor : ''
            ]);
        });

        // Formatear encabezados
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF2C2C2C' }
        };
        headerRow.font = { color: { argb: 'FFFFFFFF' }, bold: true };

        // Ajustar ancho de columnas
        worksheet.columns = [
            { width: 10 }, // ID
            { width: 12 }, // Fecha
            { width: 10 }, // Hora
            { width: 15 }, // Evento
            { width: 20 }, // Observaciones
            { width: 12 }, // O₂
            { width: 12 }, // CO
            { width: 12 }  // CH₄
        ];

        await workbook.xlsx.writeFile(filePath);

        return { 
            success: true, 
            filePath: filePath,
            fileName: fileName,
            recordCount: mediciones.length
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});


// Verificar conexión a internet
ipcMain.handle('check-internet-connection', async () => {
    try {
        const internetChecker = new (require('./src/utils/internet.js'))();
        const result = await internetChecker.checkConnection();
        
        return {
            success: true,
            connected: result.connected,
            latency: result.latency,
            error: result.error
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});





// ==================== MANEJADORES PARA BLOBS ====================

// Enviar medición específica como blob
ipcMain.handle('send-medicion-as-blob', async (event, medicionId, format = 'json') => {
    try {
        if (!blobSender) {
            return { success: false, error: 'Servicio de blobs no inicializado' };
        }

        console.log(`📦 Enviando medición ${medicionId} como blob (formato: ${format})...`);

        // Verificar que la medición existe
        if (!databaseManager || !databaseManager.isDatabaseConnected()) {
            return { success: false, error: 'Base de datos no conectada' };
        }

        const readingsResult = await databaseManager.getAllReadings();
        if (!readingsResult.success) {
            return { success: false, error: 'Error obteniendo mediciones' };
        }

        const measurement = readingsResult.data.find(m => m.medicion_id === medicionId);
        if (!measurement) {
            return { success: false, error: `Medición con ID ${medicionId} no encontrada` };
        }

        // Enviar medición como blob
        const result = await blobSender.sendMeasurementAsBlob(medicionId, format);

        if (result.success) {
            console.log(`✅ Medición ${medicionId} enviada exitosamente como blob`);
        return { 
            success: true, 
                message: `Medición ${medicionId} enviada exitosamente como blob`,
                measurementId: result.measurementId,
                blobId: result.blobId,
                blobName: result.blobName,
                containerName: result.containerName,
                format: result.format,
                response: result.response
            };
        } else {
            console.log(`❌ Error enviando medición como blob: ${result.error}`);
            return {
                success: false,
                error: result.error
            };
        }

    } catch (error) {
        console.error('❌ Error enviando medición como blob:', error);
        return { success: false, error: error.message };
    }
});

// Enviar última medición como blob
ipcMain.handle('send-latest-medicion-as-blob', async (event, format = 'json') => {
    try {
        if (!blobSender) {
            return { success: false, error: 'Servicio de blobs no inicializado' };
        }

        console.log(`📦 Enviando última medición como blob (formato: ${format})...`);

        const result = await blobSender.sendLatestMeasurementAsBlob(format);

        if (result.success) {
            console.log(`✅ Última medición enviada exitosamente como blob`);
            return {
                success: true,
                message: 'Última medición enviada exitosamente como blob',
                measurementId: result.measurementId,
                blobId: result.blobId,
                blobName: result.blobName,
                containerName: result.containerName,
                format: result.format,
                response: result.response
            };
        } else {
            console.log(`❌ Error enviando última medición como blob: ${result.error}`);
            return {
                success: false,
                error: result.error
            };
        }

    } catch (error) {
        console.error('❌ Error enviando última medición como blob:', error);
        return { success: false, error: error.message };
    }
});

// Enviar mediciones como blobs por rango de fechas
ipcMain.handle('send-mediciones-as-blobs-range', async (event, startDate, endDate, format = 'json') => {
    try {
        if (!blobSender) {
            return { success: false, error: 'Servicio de blobs no inicializado' };
        }

        console.log(`📦 Enviando mediciones del ${startDate} al ${endDate} como blobs (formato: ${format})...`);

        const result = await blobSender.sendMeasurementsAsBlobsByDateRange(startDate, endDate, format);

        if (result.success) {
            console.log(`✅ ${result.sent} blobs enviados exitosamente`);
            return {
                success: true,
                message: `${result.sent} blobs enviados exitosamente`,
                sent: result.sent,
                total: result.total,
                blobs: result.blobs,
                response: result.response
            };
        } else {
            console.log(`❌ Error enviando blobs: ${result.error}`);
            return {
                success: false,
                sent: result.sent,
                total: result.total,
                error: result.error
            };
        }

    } catch (error) {
        console.error('❌ Error enviando mediciones como blobs:', error);
        return { success: false, error: error.message };
    }
});

// Verificar estado del servicio de blobs
ipcMain.handle('check-blob-service-status', async () => {
    try {
        if (!blobSender) {
            return { success: false, error: 'Servicio de blobs no inicializado' };
        }

        const status = await blobSender.checkServiceStatus();
        return {
            success: true,
            ...status
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Crear configuración de blobs de ejemplo
ipcMain.handle('create-blob-config', async () => {
    try {
        if (!blobSender) {
            blobSender = new (require('./src/utils/blob-sender.js'))();
        }

        const result = await blobSender.createExampleConfig();
        return result;
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Verificar conexión a internet para el indicador
ipcMain.handle('check-internet-for-indicator', async () => {
    try {
        const InternetChecker = require('./src/utils/internet.js');
        const internetChecker = new InternetChecker();
        
        const result = await internetChecker.checkConnection();

        return { 
            success: true, 
            connected: result.connected,
            latency: result.latency || 0,
            error: result.connected ? null : (result.error || 'Sin conexión a internet')
        };
    } catch (error) {
        return { success: false, connected: false, error: error.message };
    }
});

// Enviar medición individual a plataforma desde interfaz
ipcMain.handle('send-medicion-to-platform-ui', async (event, medicionId, format = 'json') => {
    try {
        if (!blobSender) {
            return { success: false, error: 'Servicio de blobs no inicializado' };
        }

        console.log(`📦 Enviando medición ${medicionId} a plataforma desde interfaz...`);

        const result = await blobSender.sendMeasurementAsBlob(medicionId, format);

        if (result.success) {
            console.log(`✅ Medición ${medicionId} enviada exitosamente a plataforma`);
            return {
                success: true,
                message: `Medición ${medicionId} enviada exitosamente a la plataforma`,
                measurementId: result.measurementId,
                blobId: result.blobId,
                blobName: result.blobName,
                format: result.format,
                markedAsSent: result.markedAsSent
            };
        } else {
            console.log(`❌ Error enviando medición a plataforma: ${result.error}`);
            return {
                success: false,
                error: result.error
            };
        }

    } catch (error) {
        console.error('❌ Error enviando medición a plataforma:', error);
        return { success: false, error: error.message };
    }
});