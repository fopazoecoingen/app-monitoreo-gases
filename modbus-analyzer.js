const { SerialPort } = require('serialport');
const XLSX = require('xlsx');
const fs = require('fs');

// Configuración
const EXCEL_FILE = 'lecturas_ch4_co_o2.xlsx';
const PORT = 'COM9'; // Cambiar según tu puerto
const BAUDRATE = 9600;
const SLAVE_ID = 1;

// Direcciones de los registros (ajustar según tu analizador)
const ADDR_O2 = 4;   // 40005 - 40001
const ADDR_CO = 7;   // Confirmado
const ADDR_CH4 = 11; // Confirmado

// Crear puerto serie
const port = new SerialPort({
    path: PORT,
    baudRate: BAUDRATE,
    dataBits: 8,
    stopBits: 1,
    parity: 'none'
});

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
function readHoldingRegisters(startAddress, quantity, gasName = '') {
    return new Promise((resolve, reject) => {
        const frame = createModbusFrame(SLAVE_ID, 0x03, startAddress, quantity);
        
        let responseBuffer = Buffer.alloc(0);
        let dataReceived = false;
        
        const timeout = setTimeout(() => {
            if (!dataReceived) {
                port.removeAllListeners('data');
                reject(new Error(`Timeout al leer ${gasName}`));
            }
        }, 5000);
        
        const dataHandler = (data) => {
            if (dataReceived) return;
            
            responseBuffer = Buffer.concat([responseBuffer, data]);
            
            // Verificar si tenemos una respuesta completa
            if (responseBuffer.length >= 5) {
                const byteCount = responseBuffer[2];
                const expectedLength = 3 + byteCount + 2; // slave + func + bytecount + data + crc
                
                if (responseBuffer.length >= expectedLength) {
                    dataReceived = true;
                    clearTimeout(timeout);
                    port.removeAllListeners('data');
                    
                    // Verificar CRC (Modbus RTU usa Little Endian para CRC)
                    const receivedCRC = responseBuffer.readUInt16LE(expectedLength - 2);
                    const calculatedCRC = calculateCRC16(responseBuffer.slice(0, expectedLength - 2));
                    
                    if (receivedCRC === calculatedCRC) {
                        // Extraer datos de los registros
                        const registers = [];
                        for (let i = 0; i < byteCount / 2; i++) {
                            const register = responseBuffer.readUInt16BE(3 + i * 2);
                            registers.push(register);
                        }
                        resolve({ data: registers });
                    } else {
                        reject(new Error(`CRC inválido para ${gasName}`));
                    }
                }
            }
        };
        
        port.on('data', dataHandler);
        port.write(frame);
    });
}

// Función para inicializar archivo Excel
function initializeExcelFile() {
    if (!fs.existsSync(EXCEL_FILE)) {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([
            ['Fecha', 'Hora', 'O₂ (%Vol)', 'CO (ppm)', 'CH₄ (ppm)']
        ]);
        XLSX.utils.book_append_sheet(wb, ws, 'Gases');
        XLSX.writeFile(wb, EXCEL_FILE);
        console.log('📊 Archivo Excel creado:', EXCEL_FILE);
    }
}

// Función para decodificar float de 32 bits desde registros Modbus
function decodeFloat32(registers) {
    // Los registros vienen en orden Big Endian
    const buffer = Buffer.alloc(4);
    buffer.writeUInt16BE(registers[0], 0);
    buffer.writeUInt16BE(registers[1], 2);
    return buffer.readFloatBE(0);
}

// Función para leer datos del analizador
async function readAnalyzerData() {
    try {
        // Leer registros de O₂, CO y CH₄ secuencialmente
        const o2Registers = await readHoldingRegisters(ADDR_O2, 2, 'O₂');
        await new Promise(resolve => setTimeout(resolve, 200)); // Pausa entre lecturas
        
        const coRegisters = await readHoldingRegisters(ADDR_CO, 2, 'CO');
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const ch4Registers = await readHoldingRegisters(ADDR_CH4, 2, 'CH₄');

        // Decodificar valores float
        const o2 = decodeFloat32(o2Registers.data);
        const co = decodeFloat32(coRegisters.data);
        const ch4 = decodeFloat32(ch4Registers.data);

        return { o2, co, ch4 };
    } catch (error) {
        console.error('❌ Error al leer datos del analizador:', error.message);
        return null;
    }
}

// Función para guardar datos en Excel
function saveToExcel(o2, co, ch4) {
    try {
        const now = new Date();
        const fecha = now.toISOString().split('T')[0];
        const hora = now.toTimeString().split(' ')[0];

        // Leer archivo existente
        const wb = XLSX.readFile(EXCEL_FILE);
        const ws = wb.Sheets['Gases'];
        
        // Agregar nueva fila
        const newRow = [fecha, hora, Math.round(o2 * 1000) / 1000, Math.round(co * 1000) / 1000, Math.round(ch4 * 1000) / 1000];
        XLSX.utils.sheet_add_aoa(ws, [newRow], { origin: -1 });
        
        // Guardar archivo
        XLSX.writeFile(wb, EXCEL_FILE);
        
        console.log(`🧪 ${fecha} ${hora} → O₂: ${o2.toFixed(3)} %Vol | CO: ${co.toFixed(3)} ppm | CH₄: ${ch4.toFixed(3)} ppm`);
    } catch (error) {
        console.error('❌ Error al guardar en Excel:', error.message);
    }
}

// Función para probar conexión básica
async function testConnection() {
    try {
        // Intentar leer un solo registro para probar
        const testRegisters = await readHoldingRegisters(0, 1, 'TEST');
        return true;
    } catch (error) {
        return false;
    }
}

// Función principal
async function main() {
    console.log('🚀 Iniciando aplicación Modbus Analyzer...\n');
    
    // Inicializar archivo Excel
    initializeExcelFile();
    
    try {
        // Conectar al analizador
        console.log(`📡 Conectando al analizador en puerto ${PORT}...`);
        
        await new Promise((resolve, reject) => {
            port.on('open', () => {
                console.log('✅ Conectado al analizador exitosamente');
                resolve();
            });
            
            port.on('error', (err) => {
                console.error('❌ Error de puerto serie:', err.message);
                reject(err);
            });
        });
        
        // Probar conexión básica
        const connectionOk = await testConnection();
        if (!connectionOk) {
            console.log('❌ No se pudo conectar al analizador');
            console.log('💡 Verifica que el analizador esté encendido y conectado');
            return;
        }
        
        console.log('📊 Registrando O₂, CO y CH₄ en Excel...\n');
        
        // Bucle principal de lectura
        while (true) {
            const data = await readAnalyzerData();
            
            if (data) {
                saveToExcel(data.o2, data.co, data.ch4);
            } else {
                console.log('❌ Error al leer uno o más gases');
            }
            
            // Esperar 5 segundos antes de la siguiente lectura
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
    } catch (error) {
        console.error('❌ Error de conexión:', error.message);
        console.log('💡 Verifica que:');
        console.log('   - El puerto COM esté correcto');
        console.log('   - El analizador esté conectado y encendido');
        console.log('   - No haya otra aplicación usando el puerto');
    }
}

// Manejo de interrupciones
process.on('SIGINT', async () => {
    console.log('\n⛔ Lectura interrumpida por el usuario.');
    try {
        port.close();
        console.log('🔌 Conexión cerrada.');
    } catch (error) {
        console.error('Error al cerrar conexión:', error.message);
    }
    process.exit(0);
});

// Iniciar aplicación
main().catch(console.error);