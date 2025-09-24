// Módulo integrado para envío de correos con verificación de internet
const InternetChecker = require('./internet.js');
const EmailService = require('./email.js');
const DatabaseManager = require('./database.js');
const path = require('path');
const fs = require('fs');

class EmailSender {
    constructor() {
        this.internetChecker = new InternetChecker();
        this.emailService = new EmailService();
        this.dbManager = new DatabaseManager();
        this.configPath = path.join(process.cwd(), 'email-config.json');
        this.isInitialized = false;
    }

    /**
     * Inicializa el servicio de envío de correos
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async initialize() {
        try {
            console.log('🚀 Inicializando servicio de envío de correos...');

            // 1. Verificar conexión a internet
            console.log('🔍 Verificando conexión a internet...');
            const connectionResult = await this.internetChecker.checkConnection();
            
            if (!connectionResult.connected) {
                console.log('⚠️ No hay conexión a internet. Intentando esperar...');
                const waitResult = await this.internetChecker.waitForConnection(3000, 5);
                
                if (!waitResult.connected) {
                    return { 
                        success: false, 
                        error: 'No se pudo establecer conexión a internet' 
                    };
                }
            }

            console.log('✅ Conexión a internet verificada');

            // 2. Cargar configuración de correo
            console.log('📧 Cargando configuración de correo...');
            const configResult = await this.emailService.loadConfigFromFile(this.configPath);
            
            if (!configResult.success) {
                return { 
                    success: false, 
                    error: `Error cargando configuración de correo: ${configResult.error}` 
                };
            }

            console.log('✅ Configuración de correo cargada');

            // 3. Verificar configuración de correo
            console.log('🔍 Verificando configuración de correo...');
            const verifyResult = await this.emailService.verifyConfiguration();
            
            if (!verifyResult.success) {
                return { 
                    success: false, 
                    error: `Error verificando configuración de correo: ${verifyResult.error}` 
                };
            }

            console.log('✅ Configuración de correo verificada');

            // 4. Conectar a base de datos
            console.log('🗄️ Conectando a base de datos...');
            await this.dbManager.connect();
            await this.dbManager.initialize();

            this.isInitialized = true;
            console.log('✅ Servicio de envío de correos inicializado correctamente');

            return { success: true };

        } catch (error) {
            console.error('❌ Error inicializando servicio de envío:', error.message);
            return { 
                success: false, 
                error: `Error de inicialización: ${error.message}` 
            };
        }
    }

    /**
     * Envía un reporte de medición por correo
     * @param {number} medicionId - ID de la medición a enviar
     * @param {string} to - Dirección de correo destinatario
     * @param {Array} attachments - Archivos adjuntos (opcional)
     * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
     */
    async sendMeasurementReport(medicionId, to, attachments = []) {
        if (!this.isInitialized) {
            const initResult = await this.initialize();
            if (!initResult.success) {
                return { success: false, error: initResult.error };
            }
        }

        try {
            console.log(`📊 Enviando reporte de medición ${medicionId} a ${to}...`);

            // Obtener datos de la medición
            const readingsResult = await this.dbManager.getAllReadings();
            
            if (!readingsResult.success) {
                return { 
                    success: false, 
                    error: 'Error obteniendo mediciones de la base de datos' 
                };
            }

            const measurement = readingsResult.data.find(m => m.medicion_id === medicionId);
            
            if (!measurement) {
                return { 
                    success: false, 
                    error: `Medición con ID ${medicionId} no encontrada` 
                };
            }

            // Obtener lecturas detalladas
            const detailedResult = await this.dbManager.getDetailedReadings(medicionId);
            const readings = detailedResult.success ? detailedResult.data : [];

            console.log(`✅ Datos obtenidos: ${readings.length} lecturas detalladas`);

            // Enviar correo
            const emailResult = await this.emailService.sendMeasurementReport(
                measurement,
                readings,
                to,
                attachments
            );

            return emailResult;

        } catch (error) {
            console.error('❌ Error enviando reporte:', error.message);
            return { 
                success: false, 
                error: `Error enviando reporte: ${error.message}` 
            };
        }
    }

    /**
     * Envía el último reporte de medición por correo
     * @param {string} to - Dirección de correo destinatario
     * @param {Array} attachments - Archivos adjuntos (opcional)
     * @returns {Promise<{success: boolean, messageId?: string, medicionId?: number, error?: string}>}
     */
    async sendLatestMeasurementReport(to, attachments = []) {
        if (!this.isInitialized) {
            const initResult = await this.initialize();
            if (!initResult.success) {
                return { success: false, error: initResult.error };
            }
        }

        try {
            console.log(`📊 Enviando último reporte de medición a ${to}...`);

            // Obtener la última medición
            const readingsResult = await this.dbManager.getAllReadings();
            
            if (!readingsResult.success || readingsResult.data.length === 0) {
                return { 
                    success: false, 
                    error: 'No se encontraron mediciones en la base de datos' 
                };
            }

            const latestMeasurement = readingsResult.data[0];
            const medicionId = latestMeasurement.medicion_id;

            console.log(`✅ Última medición encontrada: ID ${medicionId} del ${latestMeasurement.fecha}`);

            // Enviar reporte
            const result = await this.sendMeasurementReport(medicionId, to, attachments);
            
            if (result.success) {
                result.medicionId = medicionId;
            }

            return result;

        } catch (error) {
            console.error('❌ Error enviando último reporte:', error.message);
            return { 
                success: false, 
                error: `Error enviando último reporte: ${error.message}` 
            };
        }
    }

    /**
     * Envía reportes de mediciones por rango de fechas
     * @param {string} to - Dirección de correo destinatario
     * @param {string} startDate - Fecha de inicio (YYYY-MM-DD)
     * @param {string} endDate - Fecha de fin (YYYY-MM-DD)
     * @param {Array} attachments - Archivos adjuntos (opcional)
     * @returns {Promise<{success: boolean, sent: number, total: number, error?: string}>}
     */
    async sendReportsByDateRange(to, startDate, endDate, attachments = []) {
        if (!this.isInitialized) {
            const initResult = await this.initialize();
            if (!initResult.success) {
                return { success: false, sent: 0, total: 0, error: initResult.error };
            }
        }

        try {
            console.log(`📊 Enviando reportes del ${startDate} al ${endDate} a ${to}...`);

            // Obtener mediciones por rango de fechas
            const readingsResult = await this.dbManager.getReadingsByDateRange(startDate, endDate);
            
            if (!readingsResult.success || readingsResult.data.length === 0) {
                return { 
                    success: false, 
                    sent: 0, 
                    total: 0, 
                    error: 'No se encontraron mediciones en el rango de fechas especificado' 
                };
            }

            const measurements = readingsResult.data;
            let sentCount = 0;

            console.log(`✅ Encontradas ${measurements.length} mediciones en el rango`);

            // Enviar cada medición
            for (const measurement of measurements) {
                try {
                    const result = await this.sendMeasurementReport(measurement.medicion_id, to, attachments);
                    
                    if (result.success) {
                        sentCount++;
                        console.log(`✅ Reporte ${measurement.medicion_id} enviado exitosamente`);
                    } else {
                        console.log(`❌ Error enviando reporte ${measurement.medicion_id}: ${result.error}`);
                    }

                    // Pequeña pausa entre envíos para evitar spam
                    await new Promise(resolve => setTimeout(resolve, 1000));

                } catch (error) {
                    console.log(`❌ Error enviando reporte ${measurement.medicion_id}: ${error.message}`);
                }
            }

            return {
                success: sentCount > 0,
                sent: sentCount,
                total: measurements.length,
                message: `Enviados ${sentCount} de ${measurements.length} reportes`
            };

        } catch (error) {
            console.error('❌ Error enviando reportes por rango:', error.message);
            return { 
                success: false, 
                sent: 0, 
                total: 0, 
                error: `Error enviando reportes: ${error.message}` 
            };
        }
    }

    /**
     * Verifica el estado del servicio
     * @returns {Promise<{internet: boolean, email: boolean, database: boolean, error?: string}>}
     */
    async checkServiceStatus() {
        const status = {
            internet: false,
            email: false,
            database: false
        };

        try {
            // Verificar internet
            const connectionResult = await this.internetChecker.checkConnection();
            status.internet = connectionResult.connected;

            // Verificar email
            if (this.emailService.isServiceConfigured()) {
                const verifyResult = await this.emailService.verifyConfiguration();
                status.email = verifyResult.success;
            }

            // Verificar base de datos
            status.database = this.dbManager.isDatabaseConnected();

            return status;

        } catch (error) {
            return { ...status, error: error.message };
        }
    }

    /**
     * Cierra las conexiones
     */
    async close() {
        try {
            if (this.dbManager) {
                await this.dbManager.disconnect();
            }
            this.isInitialized = false;
            console.log('✅ Servicio de envío de correos cerrado');
        } catch (error) {
            console.error('❌ Error cerrando servicio:', error.message);
        }
    }

    /**
     * Crea un archivo de configuración de ejemplo
     * @returns {Promise<{success: boolean, configPath?: string, error?: string}>}
     */
    async createExampleConfig() {
        try {
            const exampleConfig = {
                host: "smtp.gmail.com",
                port: 587,
                secure: false,
                user: "tu-email@gmail.com",
                pass: "tu-app-password",
                from: "tu-email@gmail.com"
            };

            await this.emailService.saveConfigToFile(exampleConfig, this.configPath);

            return {
                success: true,
                configPath: this.configPath,
                message: 'Archivo de configuración de ejemplo creado'
            };

        } catch (error) {
            return {
                success: false,
                error: `Error creando configuración: ${error.message}`
            };
        }
    }

    /**
     * Crea un archivo adjunto (Excel o CSV) con datos de mediciones
     * @param {Array} measurements - Array de mediciones
     * @param {string} format - Formato del archivo ('excel' o 'csv')
     * @returns {Promise<{success: boolean, filePath?: string, error?: string}>}
     */
    async createAttachmentFile(measurements, format = 'excel') {
        try {
            // Crear directorio temporal
            const os = require('os');
            const tempDir = path.join(os.tmpdir(), 'modbus-analyzer');
            
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // Generar nombre de archivo único
            const timestamp = new Date().toLocaleString('sv-SE').replace(/[:.]/g, '-').replace(' ', '_');
            const fileName = `mediciones_${timestamp}.${format === 'excel' ? 'xlsx' : 'csv'}`;
            const filePath = path.join(tempDir, fileName);

            // Crear archivo según el formato
            if (format === 'excel') {
                return await this.emailService.createExcelAttachment(measurements, filePath);
            } else if (format === 'csv') {
                return await this.emailService.createCSVAttachment(measurements, filePath);
            } else {
                return { success: false, error: 'Formato no soportado. Use "excel" o "csv"' };
            }

        } catch (error) {
            console.error('❌ Error creando archivo adjunto:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Envía un reporte de medición por correo con archivo adjunto
     * @param {number} medicionId - ID de la medición a enviar
     * @param {string} to - Dirección de correo destinatario
     * @param {string} attachmentFormat - Formato del adjunto ('excel', 'csv', o null)
     * @param {Array} additionalAttachments - Archivos adjuntos adicionales (opcional)
     * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
     */
    async sendMeasurementReportWithAttachment(medicionId, to, attachmentFormat = null, additionalAttachments = []) {
        if (!this.isInitialized) {
            const initResult = await this.initialize();
            if (!initResult.success) {
                return { success: false, error: initResult.error };
            }
        }

        try {
            console.log(`📊 Enviando reporte de medición ${medicionId} a ${to} con adjunto ${attachmentFormat || 'ninguno'}...`);

            // Obtener datos de la medición
            const readingsResult = await this.dbManager.getAllReadings();
            
            if (!readingsResult.success) {
                return { 
                    success: false, 
                    error: 'Error obteniendo mediciones de la base de datos' 
                };
            }

            const measurement = readingsResult.data.find(m => m.medicion_id === medicionId);
            
            if (!measurement) {
                return { 
                    success: false, 
                    error: `Medición con ID ${medicionId} no encontrada` 
                };
            }

            // Obtener lecturas detalladas
            const detailedResult = await this.dbManager.getDetailedReadings(medicionId);
            const readings = detailedResult.success ? detailedResult.data : [];

            console.log(`✅ Datos obtenidos: ${readings.length} lecturas detalladas`);

            // Crear archivo adjunto si se especifica formato
            let finalAttachments = [...additionalAttachments];
            if (attachmentFormat) {
                const attachmentResult = await this.createAttachmentFile([measurement], attachmentFormat);
                if (attachmentResult.success) {
                    finalAttachments.push({
                        filename: path.basename(attachmentResult.filePath),
                        path: attachmentResult.filePath,
                        contentType: attachmentFormat === 'excel' 
                            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                            : 'text/csv'
                    });
                    console.log(`✅ Archivo ${attachmentFormat.toUpperCase()} adjunto creado`);
                }
            }

            // Enviar correo
            const emailResult = await this.emailService.sendMeasurementReport(
                measurement,
                readings,
                to,
                finalAttachments
            );

            // Limpiar archivos temporales después de enviar
            if (attachmentFormat && finalAttachments.length > additionalAttachments.length) {
                const tempFile = finalAttachments[finalAttachments.length - 1];
                setTimeout(() => {
                    if (fs.existsSync(tempFile.path)) {
                        fs.unlinkSync(tempFile.path);
                        console.log('🗑️ Archivo temporal eliminado');
                    }
                }, 30000); // 30 segundos
            }

            return emailResult;

        } catch (error) {
            console.error('❌ Error enviando reporte:', error.message);
            return { 
                success: false, 
                error: `Error enviando reporte: ${error.message}` 
            };
        }
    }

    /**
     * Envía reportes por rango de fechas con archivo adjunto
     * @param {string} to - Dirección de correo destinatario
     * @param {string} startDate - Fecha de inicio (YYYY-MM-DD)
     * @param {string} endDate - Fecha de fin (YYYY-MM-DD)
     * @param {string} attachmentFormat - Formato del adjunto ('excel', 'csv', o null)
     * @returns {Promise<{success: boolean, sent: number, total: number, error?: string}>}
     */
    async sendReportsByDateRangeWithAttachment(to, startDate, endDate, attachmentFormat = null) {
        if (!this.isInitialized) {
            const initResult = await this.initialize();
            if (!initResult.success) {
                return { success: false, sent: 0, total: 0, error: initResult.error };
            }
        }

        try {
            console.log(`📊 Enviando reportes del ${startDate} al ${endDate} a ${to} con adjunto ${attachmentFormat || 'ninguno'}...`);

            // Obtener mediciones por rango de fechas
            const readingsResult = await this.dbManager.getReadingsByDateRange(startDate, endDate);
            
            if (!readingsResult.success || readingsResult.data.length === 0) {
                return { 
                    success: false, 
                    sent: 0, 
                    total: 0, 
                    error: 'No se encontraron mediciones en el rango de fechas especificado' 
                };
            }

            const measurements = readingsResult.data;
            console.log(`✅ Encontradas ${measurements.length} mediciones en el rango`);

            // Crear archivo adjunto si se especifica formato
            let attachments = [];
            if (attachmentFormat) {
                const attachmentResult = await this.createAttachmentFile(measurements, attachmentFormat);
                if (attachmentResult.success) {
                    attachments.push({
                        filename: path.basename(attachmentResult.filePath),
                        path: attachmentResult.filePath,
                        contentType: attachmentFormat === 'excel' 
                            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                            : 'text/csv'
                    });
                    console.log(`✅ Archivo ${attachmentFormat.toUpperCase()} con ${measurements.length} mediciones creado`);
                }
            }

            // Enviar correo con resumen de todas las mediciones
            const subject = `Reporte de Mediciones - ${startDate} a ${endDate} - Modbus Analyzer`;
            const body = this.generateSummaryHTML(measurements, startDate, endDate);
            
            const emailResult = await this.emailService.sendMeasurementEmail(
                { fecha: startDate, hora: '00:00:00' }, // Datos ficticios para el email
                to,
                subject,
                body,
                attachments
            );

            // Limpiar archivo temporal
            if (attachmentFormat && attachments.length > 0) {
                const tempFile = attachments[0];
                setTimeout(() => {
                    if (fs.existsSync(tempFile.path)) {
                        fs.unlinkSync(tempFile.path);
                        console.log('🗑️ Archivo temporal eliminado');
                    }
                }, 30000); // 30 segundos
            }

            return {
                success: emailResult.success,
                sent: emailResult.success ? 1 : 0,
                total: measurements.length,
                message: emailResult.success ? 
                    `Reporte con ${measurements.length} mediciones enviado exitosamente` : 
                    emailResult.error
            };

        } catch (error) {
            console.error('❌ Error enviando reportes por rango:', error.message);
            return { 
                success: false, 
                sent: 0, 
                total: 0, 
                error: `Error enviando reportes: ${error.message}` 
            };
        }
    }

    /**
     * Genera HTML de resumen para múltiples mediciones
     * @param {Array} measurements - Array de mediciones
     * @param {string} startDate - Fecha de inicio
     * @param {string} endDate - Fecha de fin
     * @returns {string} HTML del resumen
     */
    generateSummaryHTML(measurements, startDate, endDate) {
        const currentDate = new Date().toLocaleString('es-ES');
        
        return `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reporte de Mediciones - Modbus Analyzer</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
                .container { max-width: 800px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .header { background-color: #2c3e50; color: white; padding: 20px; border-radius: 8px 8px 0 0; margin: -20px -20px 20px -20px; }
                .header h1 { margin: 0; font-size: 24px; }
                .header p { margin: 5px 0 0 0; opacity: 0.9; }
                .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
                .summary-item { background-color: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 4px solid #3498db; text-align: center; }
                .summary-value { font-size: 24px; font-weight: bold; color: #2c3e50; }
                .summary-label { color: #666; margin-top: 5px; }
                .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; text-align: center; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📊 Reporte de Mediciones - Modbus Analyzer</h1>
                    <p>Período: ${startDate} a ${endDate}</p>
                    <p>Generado el ${currentDate}</p>
                </div>

                <div class="summary-grid">
                    <div class="summary-item">
                        <div class="summary-value">${measurements.length}</div>
                        <div class="summary-label">Total de Mediciones</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-value">${measurements.reduce((sum, m) => sum + (m.total_lecturas || 0), 0)}</div>
                        <div class="summary-label">Total de Lecturas</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-value">${measurements.filter(m => m.evento !== 'Normal').length}</div>
                        <div class="summary-label">Eventos Especiales</div>
                    </div>
                </div>

                <div class="footer">
                    <p>Este reporte incluye un archivo Excel/CSV con todos los datos detallados</p>
                    <p>Para más información, contacte al administrador del sistema</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }
}

module.exports = EmailSender;
