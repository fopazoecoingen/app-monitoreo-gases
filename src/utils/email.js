// Servicio de envío de correos electrónicos
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

class EmailService {
    constructor() {
        this.transporter = null;
        this.isConfigured = false;
        this.config = null;
    }

    /**
     * Configura el servicio de correo
     * @param {object} config - Configuración del correo
     * @param {string} config.host - Servidor SMTP
     * @param {number} config.port - Puerto SMTP
     * @param {boolean} config.secure - Si usar SSL/TLS
     * @param {string} config.user - Usuario de correo
     * @param {string} config.pass - Contraseña o app password
     * @param {string} config.from - Dirección de correo remitente
     */
    configure(config) {
        try {
            this.config = config;
            
            this.transporter = nodemailer.createTransporter({
                host: config.host,
                port: config.port,
                secure: config.secure || false, // true para puerto 465, false para otros puertos
                auth: {
                    user: config.user,
                    pass: config.pass
                },
                tls: {
                    rejectUnauthorized: false // Para servidores con certificados autofirmados
                }
            });

            this.isConfigured = true;
            console.log('✅ Servicio de correo configurado correctamente');
            
            return { success: true, message: 'Configuración exitosa' };
        } catch (error) {
            console.error('❌ Error configurando servicio de correo:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Verifica la configuración del correo
     * @returns {Promise<{success: boolean, message?: string, error?: string}>}
     */
    async verifyConfiguration() {
        if (!this.isConfigured || !this.transporter) {
            return { 
                success: false, 
                error: 'Servicio de correo no configurado' 
            };
        }

        try {
            console.log('🔍 Verificando configuración de correo...');
            await this.transporter.verify();
            console.log('✅ Configuración de correo verificada exitosamente');
            return { 
                success: true, 
                message: 'Configuración verificada correctamente' 
            };
        } catch (error) {
            console.error('❌ Error verificando configuración de correo:', error.message);
            return { 
                success: false, 
                error: `Error de verificación: ${error.message}` 
            };
        }
    }

    /**
     * Envía un correo con datos de medición
     * @param {object} data - Datos de la medición
     * @param {string} to - Dirección de correo destinatario
     * @param {string} subject - Asunto del correo
     * @param {string} body - Cuerpo del correo
     * @param {Array} attachments - Archivos adjuntos (opcional)
     * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
     */
    async sendMeasurementEmail(data, to, subject, body, attachments = []) {
        if (!this.isConfigured || !this.transporter) {
            return { 
                success: false, 
                error: 'Servicio de correo no configurado' 
            };
        }

        try {
            console.log('📧 Enviando correo con datos de medición...');

            const mailOptions = {
                from: this.config.from,
                to: to,
                subject: subject,
                html: body,
                attachments: attachments
            };

            const result = await this.transporter.sendMail(mailOptions);
            
            console.log('✅ Correo enviado exitosamente:', result.messageId);
            return {
                success: true,
                messageId: result.messageId,
                message: 'Correo enviado correctamente'
            };

        } catch (error) {
            console.error('❌ Error enviando correo:', error.message);
            return {
                success: false,
                error: `Error enviando correo: ${error.message}`
            };
        }
    }

    /**
     * Genera el HTML del correo con datos de medición
     * @param {object} measurementData - Datos de la medición
     * @param {Array} readings - Lecturas detalladas
     * @returns {string} HTML del correo
     */
    generateEmailHTML(measurementData, readings = []) {
        const currentDate = new Date().toLocaleString('es-ES');
        
        let html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reporte de Medición - Modbus Analyzer</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
                .container { max-width: 800px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .header { background-color: #2c3e50; color: white; padding: 20px; border-radius: 8px 8px 0 0; margin: -20px -20px 20px -20px; }
                .header h1 { margin: 0; font-size: 24px; }
                .header p { margin: 5px 0 0 0; opacity: 0.9; }
                .info-section { margin-bottom: 25px; }
                .info-section h2 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 5px; }
                .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-top: 15px; }
                .info-item { background-color: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 4px solid #3498db; }
                .info-label { font-weight: bold; color: #2c3e50; }
                .info-value { margin-top: 5px; color: #555; }
                .readings-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                .readings-table th, .readings-table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                .readings-table th { background-color: #3498db; color: white; }
                .readings-table tr:nth-child(even) { background-color: #f2f2f2; }
                .evento-normal { color: #27ae60; font-weight: bold; }
                .evento-alerta { color: #e74c3c; font-weight: bold; }
                .evento-advertencia { color: #f39c12; font-weight: bold; }
                .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; text-align: center; }
                .no-data { color: #999; font-style: italic; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📊 Reporte de Medición - Modbus Analyzer</h1>
                    <p>Generado el ${currentDate}</p>
                </div>

                <div class="info-section">
                    <h2>📋 Información General</h2>
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">ID de Medición</div>
                            <div class="info-value">${measurementData.id || 'N/A'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Fecha</div>
                            <div class="info-value">${measurementData.fecha || 'N/A'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Hora</div>
                            <div class="info-value">${measurementData.hora || 'N/A'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Evento</div>
                            <div class="info-value">
                                <span class="evento-${measurementData.evento?.toLowerCase() || 'normal'}">
                                    ${measurementData.evento || 'Normal'}
                                </span>
                            </div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Tiempo de Inicio</div>
                            <div class="info-value">${measurementData.tiempo_inicio || 'N/A'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Tiempo de Fin</div>
                            <div class="info-value">${measurementData.tiempo_fin || 'N/A'}</div>
                        </div>
                    </div>
                </div>

                ${measurementData.observaciones ? `
                <div class="info-section">
                    <h2>📝 Observaciones</h2>
                    <div class="info-item">
                        <div class="info-value">${measurementData.observaciones}</div>
                    </div>
                </div>
                ` : ''}

                <div class="info-section">
                    <h2>📈 Resumen de Lecturas</h2>
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">Total de Lecturas</div>
                            <div class="info-value">${readings.length}</div>
                        </div>
        `;

        if (readings.length > 0) {
            // Calcular estadísticas
            const o2Values = readings.filter(r => r.o2 !== null && r.o2 !== undefined).map(r => r.o2);
            const coValues = readings.filter(r => r.co !== null && r.co !== undefined).map(r => r.co);
            const ch4Values = readings.filter(r => r.ch4 !== null && r.ch4 !== undefined).map(r => r.ch4);

            const getStats = (values) => {
                if (values.length === 0) return { min: 'N/A', max: 'N/A', avg: 'N/A' };
                const min = Math.min(...values).toFixed(2);
                const max = Math.max(...values).toFixed(2);
                const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
                return { min, max, avg };
            };

            const o2Stats = getStats(o2Values);
            const coStats = getStats(coValues);
            const ch4Stats = getStats(ch4Values);

            html += `
                        <div class="info-item">
                            <div class="info-label">O₂ - Mín/Máx/Promedio (%)</div>
                            <div class="info-value">${o2Stats.min} / ${o2Stats.max} / ${o2Stats.avg}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">CO - Mín/Máx/Promedio (ppm)</div>
                            <div class="info-value">${coStats.min} / ${coStats.max} / ${coStats.avg}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">CH₄ - Mín/Máx/Promedio (%)</div>
                            <div class="info-value">${ch4Stats.min} / ${ch4Stats.max} / ${ch4Stats.avg}</div>
                        </div>
                    </div>
                </div>

                <div class="info-section">
                    <h2>📊 Lecturas Detalladas</h2>
                    ${readings.length > 0 ? `
                    <table class="readings-table">
                        <thead>
                            <tr>
                                <th>Tiempo Relativo</th>
                                <th>O₂ (%)</th>
                                <th>CO (ppm)</th>
                                <th>CH₄ (%)</th>
                                <th>Evento</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${readings.slice(0, 50).map(reading => `
                                <tr>
                                    <td>${reading.tiempo_relativo || 'N/A'}</td>
                                    <td>${reading.o2 !== null && reading.o2 !== undefined ? reading.o2.toFixed(2) : 'N/A'}</td>
                                    <td>${reading.co !== null && reading.co !== undefined ? reading.co.toFixed(2) : 'N/A'}</td>
                                    <td>${reading.ch4 !== null && reading.ch4 !== undefined ? reading.ch4.toFixed(2) : 'N/A'}</td>
                                    <td>
                                        <span class="evento-${reading.evento?.toLowerCase() || 'normal'}">
                                            ${reading.evento || 'Normal'}
                                        </span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    ${readings.length > 50 ? `<p class="no-data">... y ${readings.length - 50} lecturas más</p>` : ''}
                    ` : `
                    <div class="no-data">No hay lecturas detalladas disponibles</div>
                    `}
                </div>
            `;
        } else {
            html += `
                        <div class="info-item">
                            <div class="info-label">Estado</div>
                            <div class="info-value no-data">Sin lecturas disponibles</div>
                        </div>
                    </div>
                </div>
            `;
        }

        html += `
                <div class="footer">
                    <p>Este reporte fue generado automáticamente por Modbus Analyzer</p>
                    <p>Para más información, contacte al administrador del sistema</p>
                </div>
            </div>
        </body>
        </html>
        `;

        return html;
    }

    /**
     * Envía un reporte completo de medición por correo
     * @param {object} measurementData - Datos de la medición
     * @param {Array} readings - Lecturas detalladas
     * @param {string} to - Dirección de correo destinatario
     * @param {Array} attachments - Archivos adjuntos (opcional)
     * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
     */
    async sendMeasurementReport(measurementData, readings, to, attachments = []) {
        const subject = `Reporte de Medición - ${measurementData.fecha} ${measurementData.hora} - Modbus Analyzer`;
        const body = this.generateEmailHTML(measurementData, readings);
        
        return await this.sendMeasurementEmail(measurementData, to, subject, body, attachments);
    }

    /**
     * Crea un archivo Excel con datos de medición
     * @param {Array} measurements - Array de mediciones
     * @param {string} filePath - Ruta donde guardar el archivo Excel
     * @returns {Promise<{success: boolean, filePath?: string, error?: string}>}
     */
    async createExcelAttachment(measurements, filePath) {
        try {
            const ExcelJS = require('exceljs');
            const workbook = new ExcelJS.Workbook();
            
            // Crear hoja de mediciones
            const worksheet = workbook.addWorksheet('Mediciones');
            
            // Agregar encabezados
            worksheet.addRow([
                'ID Medición',
                'Fecha',
                'Hora',
                'Evento',
                'Observaciones',
                'Tiempo Inicio',
                'Tiempo Fin',
                'Total Lecturas'
            ]);

            // Agregar datos
            measurements.forEach(measurement => {
                worksheet.addRow([
                    measurement.medicion_id,
                    measurement.fecha,
                    measurement.hora,
                    measurement.evento || 'Normal',
                    measurement.observaciones || '',
                    measurement.tiempo_inicio || '',
                    measurement.tiempo_fin || '',
                    measurement.total_lecturas || 0
                ]);
            });

            // Formatear encabezados
            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF2C3E50' }
            };
            headerRow.font = { color: { argb: 'FFFFFFFF' }, bold: true };

            // Ajustar ancho de columnas
            worksheet.columns = [
                { width: 12 }, // ID
                { width: 12 }, // Fecha
                { width: 10 }, // Hora
                { width: 15 }, // Evento
                { width: 25 }, // Observaciones
                { width: 18 }, // Tiempo Inicio
                { width: 18 }, // Tiempo Fin
                { width: 15 }  // Total Lecturas
            ];

            // Guardar archivo
            await workbook.xlsx.writeFile(filePath);
            
            console.log(`✅ Archivo Excel creado: ${filePath}`);
            return { success: true, filePath: filePath };

        } catch (error) {
            console.error('❌ Error creando archivo Excel:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Crea un archivo CSV con datos de medición
     * @param {Array} measurements - Array de mediciones
     * @param {string} filePath - Ruta donde guardar el archivo CSV
     * @returns {Promise<{success: boolean, filePath?: string, error?: string}>}
     */
    async createCSVAttachment(measurements, filePath) {
        try {
            const headers = [
                'ID Medición',
                'Fecha',
                'Hora',
                'Evento',
                'Observaciones',
                'Tiempo Inicio',
                'Tiempo Fin',
                'Total Lecturas'
            ];

            const csvContent = [
                headers.join(','),
                ...measurements.map(measurement => [
                    measurement.medicion_id,
                    `"${measurement.fecha}"`,
                    `"${measurement.hora}"`,
                    `"${measurement.evento || 'Normal'}"`,
                    `"${(measurement.observaciones || '').replace(/"/g, '""')}"`,
                    `"${measurement.tiempo_inicio || ''}"`,
                    `"${measurement.tiempo_fin || ''}"`,
                    measurement.total_lecturas || 0
                ].join(','))
            ].join('\n');

            // Agregar BOM para UTF-8
            const csvWithBOM = '\uFEFF' + csvContent;
            
            require('fs').writeFileSync(filePath, csvWithBOM, 'utf8');
            
            console.log(`✅ Archivo CSV creado: ${filePath}`);
            return { success: true, filePath: filePath };

        } catch (error) {
            console.error('❌ Error creando archivo CSV:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Carga configuración desde archivo
     * @param {string} configPath - Ruta al archivo de configuración
     * @returns {Promise<{success: boolean, config?: object, error?: string}>}
     */
    async loadConfigFromFile(configPath) {
        try {
            if (!fs.existsSync(configPath)) {
                return { 
                    success: false, 
                    error: 'Archivo de configuración no encontrado' 
                };
            }

            const configData = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configData);
            
            const result = this.configure(config);
            return result.success ? 
                { success: true, config: config } : 
                result;

        } catch (error) {
            console.error('❌ Error cargando configuración:', error.message);
            return { 
                success: false, 
                error: `Error cargando configuración: ${error.message}` 
            };
        }
    }

    /**
     * Guarda configuración en archivo
     * @param {object} config - Configuración a guardar
     * @param {string} configPath - Ruta al archivo de configuración
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async saveConfigToFile(config, configPath) {
        try {
            // Crear directorio si no existe
            const dir = path.dirname(configPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            console.log('✅ Configuración de correo guardada exitosamente');
            
            return { success: true };
        } catch (error) {
            console.error('❌ Error guardando configuración:', error.message);
            return { 
                success: false, 
                error: `Error guardando configuración: ${error.message}` 
            };
        }
    }

    /**
     * Obtiene la configuración actual
     * @returns {object|null} Configuración actual o null si no está configurado
     */
    getCurrentConfig() {
        return this.isConfigured ? this.config : null;
    }

    /**
     * Verifica si el servicio está configurado
     * @returns {boolean} True si está configurado
     */
    isServiceConfigured() {
        return this.isConfigured;
    }
}

module.exports = EmailService;
