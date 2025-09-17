// Utilidades para comunicación Modbus RTU
const { SerialPort } = require('serialport');

class ModbusRTU {
    constructor() {
        this.port = null;
        this.isConnected = false;
    }

    // Función para calcular CRC16 Modbus
    calculateCRC16(data) {
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

    // Crear frame Modbus RTU
    createModbusFrame(slaveId, functionCode, startAddress, quantity) {
        const buffer = Buffer.alloc(8);
        buffer[0] = slaveId;
        buffer[1] = functionCode;
        buffer.writeUInt16BE(startAddress, 2);
        buffer.writeUInt16BE(quantity, 4);
        
        const crc = this.calculateCRC16(buffer.slice(0, 6));
        buffer.writeUInt16LE(crc, 6);
        
        return buffer;
    }

    // Leer registros de retención
    async readHoldingRegisters(slaveId, startAddress, quantity) {
        if (!this.port || !this.isConnected) {
            throw new Error('Puerto no conectado');
        }

        const frame = this.createModbusFrame(slaveId, 0x03, startAddress, quantity);
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout al leer datos del analizador'));
            }, 2000);

            this.port.write(frame, (err) => {
                if (err) {
                    clearTimeout(timeout);
                    reject(err);
                    return;
                }
            });

            this.port.once('data', (data) => {
                clearTimeout(timeout);
                try {
                    const result = this.parseResponse(data, slaveId, 0x03, quantity);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    // Parsear respuesta Modbus
    parseResponse(responseBuffer, expectedSlaveId, expectedFunctionCode, expectedQuantity) {
        if (responseBuffer.length < 5) {
            throw new Error('Respuesta muy corta');
        }

        const slaveId = responseBuffer[0];
        const functionCode = responseBuffer[1];
        const byteCount = responseBuffer[2];
        const expectedLength = 3 + byteCount + 2;

        if (responseBuffer.length < expectedLength) {
            throw new Error('Respuesta incompleta');
        }

        if (slaveId !== expectedSlaveId) {
            throw new Error(`ID de esclavo incorrecto: esperado ${expectedSlaveId}, recibido ${slaveId}`);
        }

        if (functionCode !== expectedFunctionCode) {
            throw new Error(`Código de función incorrecto: esperado ${expectedFunctionCode}, recibido ${functionCode}`);
        }

        // Verificar CRC
        const receivedCRC = responseBuffer.readUInt16LE(expectedLength - 2);
        const calculatedCRC = this.calculateCRC16(responseBuffer.slice(0, expectedLength - 2));
        
        if (receivedCRC !== calculatedCRC) {
            throw new Error('CRC inválido');
        }

        // Extraer datos
        const data = responseBuffer.slice(3, 3 + byteCount);
        const registers = [];
        
        for (let i = 0; i < data.length; i += 2) {
            registers.push(data.readUInt16BE(i));
        }

        return registers;
    }

    // Decodificar float de 32 bits
    decodeFloat32(highReg, lowReg) {
        const buffer = Buffer.alloc(4);
        buffer.writeUInt16BE(highReg, 0);
        buffer.writeUInt16BE(lowReg, 2);
        return buffer.readFloatBE(0);
    }

    // Conectar al puerto serie
    async connect(portPath, baudRate = 9600) {
        return new Promise((resolve, reject) => {
            this.port = new SerialPort({
                path: portPath,
                baudRate: baudRate,
                dataBits: 8,
                stopBits: 1,
                parity: 'none'
            });

            this.port.on('open', () => {
                this.isConnected = true;
                resolve({ success: true, message: 'Conectado exitosamente' });
            });

            this.port.on('error', (err) => {
                this.isConnected = false;
                reject(err);
            });
        });
    }

    // Desconectar
    async disconnect() {
        return new Promise((resolve) => {
            if (this.port) {
                this.port.close(() => {
                    this.isConnected = false;
                    this.port = null;
                    resolve({ success: true, message: 'Desconectado exitosamente' });
                });
            } else {
                resolve({ success: true, message: 'Ya estaba desconectado' });
            }
        });
    }

    // Leer datos del analizador
    async readAnalyzerData(slaveId, addrO2, addrCO, addrCH4) {
        try {
            const [o2High, o2Low] = await this.readHoldingRegisters(slaveId, addrO2, 2);
            const [coHigh, coLow] = await this.readHoldingRegisters(slaveId, addrCO, 2);
            const [ch4High, ch4Low] = await this.readHoldingRegisters(slaveId, addrCH4, 2);

            const o2 = this.decodeFloat32(o2High, o2Low);
            const co = this.decodeFloat32(coHigh, coLow);
            const ch4 = this.decodeFloat32(ch4High, ch4Low);

            return { o2, co, ch4 };
        } catch (error) {
            throw new Error(`Error al leer datos: ${error.message}`);
        }
    }
}

module.exports = ModbusRTU;
