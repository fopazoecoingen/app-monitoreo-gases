// Servicio para enviar mediciones a contenedor de blobs
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const FormData = require('form-data');
const AuthService = require('./auth-service');

class BlobService {
    constructor() {
        this.baseUrl = null;
        this.apiKey = null;
        this.endpoint = null;
        this.timeout = 30000; // 30 segundos
        this.containerName = 'mediciones'; // Nombre del contenedor de blobs
        this.authService = new AuthService(); // Servicio de autenticación automática
    }

    /**
     * Configura el servicio de blobs
     * @param {object} config - Configuración del servicio
     * @param {string} config.baseUrl - URL base de tu plataforma
     * @param {string} config.apiKey - Clave API para autenticación
     * @param {string} config.endpoint - Endpoint para recibir blobs
     * @param {string} config.containerName - Nombre del contenedor de blobs
     * @param {object} config.headers - Headers adicionales (opcional)
     */
    async configure(config) {
        try {
            this.baseUrl = config.baseUrl || 'https://ecoingen-api-produccion.azurewebsites.net';
            this.apiKey = config.apiKey; // Mantenemos para compatibilidad, pero usaremos authService
            this.endpoint = config.endpoint || '/api/Storage/uploadExcelMedicionesSoftware';
            this.containerName = config.containerName || 'mediciones';
            
            // Inicializar autenticación automática
            console.log('🔐 Inicializando autenticación automática...');
            const authSuccess = await this.authService.initialize();
            
            if (!authSuccess) {
                throw new Error('No se pudo inicializar la autenticación automática');
            }

            console.log('✅ Servicio de blobs configurado con autenticación automática');
            console.log(`   URL: ${this.baseUrl}${this.endpoint}`);
            console.log(`   Endpoint específico para Excel`);
            console.log(`   🔑 Token dinámico activado`);
            
            return { success: true, message: 'Configuración exitosa con autenticación automática' };
        } catch (error) {
            console.error('❌ Error configurando servicio de blobs:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Verifica la conexión con el endpoint de blobs
     * @returns {Promise<{success: boolean, statusCode?: number, error?: string}>}
     */
    async verifyConnection() {
        if (!this.baseUrl) {
            return { success: false, error: 'Servicio no configurado' };
        }

        try {
            console.log('🔍 Verificando conexión con endpoint de blobs...');
            
            const result = await this.makeRequest('GET', '/health', null, true);
            
            if (result.success) {
                console.log('✅ Conexión con endpoint de blobs verificada');
                return { success: true, statusCode: result.statusCode };
            } else {
                console.log(`❌ Error verificando conexión: ${result.error}`);
                return { success: false, error: result.error };
            }

        } catch (error) {
            console.error('❌ Error verificando conexión:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Envía una medición como archivo Excel al endpoint específico
     * @param {object} measurementData - Datos de la medición
     * @param {Array} readings - Lecturas detalladas
     * @param {string} format - Formato del archivo (solo 'excel' soportado)
     * @returns {Promise<{success: boolean, blobId?: string, response?: object, error?: string}>}
     */
    async uploadMeasurementBlob(measurementData, readings, format = 'excel') {
        if (!this.baseUrl) {
            return { success: false, error: 'Servicio no configurado' };
        }

        try {
            console.log(`📤 Subiendo medición ${measurementData.medicion_id} como Excel...`);
            console.log(`🔧 Configuración: ${this.baseUrl}${this.endpoint}`);
            console.log(`🆔 ID Medición a enviar: ${measurementData.medicion_id}`);
            console.log(`📊 Lecturas a enviar: ${readings.length}`);

            // Solo soportamos Excel para este endpoint
            if (format !== 'excel') {
                return { success: false, error: 'Este endpoint solo soporta archivos Excel' };
            }

            // Generar archivo Excel temporal
            const excelFilePath = await this.generateExcelFile(measurementData, readings);
            
            // Enviar archivo usando FormData
            const result = await this.uploadExcelFile(excelFilePath, measurementData.medicion_id);

            // Limpiar archivo temporal
            try {
                fs.unlinkSync(excelFilePath);
            } catch (cleanupError) {
                console.warn('⚠️ No se pudo eliminar archivo temporal:', cleanupError.message);
            }

            if (result.success) {
                console.log('✅ Archivo Excel subido exitosamente');
                return {
                    success: true,
                    blobId: result.response?.blobId || `medicion_${measurementData.medicion_id}`,
                    blobName: `medicion_${measurementData.medicion_id}.xlsx`,
                    response: result.response
                };
            } else {
                console.log(`❌ Error subiendo Excel: ${result.error}`);
                return { success: false, error: result.error };
            }

        } catch (error) {
            console.error('❌ Error subiendo Excel:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Genera un archivo Excel temporal con los datos de la medición
     * @param {object} measurementData - Datos de la medición
     * @param {Array} readings - Lecturas detalladas
     * @returns {Promise<string>} Ruta del archivo Excel generado
     */
    async generateExcelFile(measurementData, readings) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`Medicion_${measurementData.medicion_id}`);

        // Configurar columnas
        worksheet.columns = [
            { header: 'ID Lectura', key: 'id', width: 12 },
            { header: 'O2 (%)', key: 'o2', width: 10 },
            { header: 'CO (ppm)', key: 'co', width: 12 },
            { header: 'CH4 (%)', key: 'ch4', width: 12 },
            { header: 'CO2 (%)', key: 'co2', width: 12 },
            { header: 'Tiempo Relativo', key: 'tiempo_relativo', width: 18 },
            { header: 'Evento', key: 'evento', width: 15 },
            { header: 'Fecha Creación', key: 'created_at', width: 20 }
        ];

        // Agregar datos de las lecturas
        readings.forEach(reading => {
            worksheet.addRow({
                id: reading.id,
                o2: reading.o2 || '',
                co: reading.co || '',
                ch4: reading.ch4 || '',
                co2: reading.co2 || '',
                tiempo_relativo: reading.tiempo_relativo || '',
                evento: reading.evento || 'Normal',
                created_at: reading.created_at || ''
            });
        });

        // Agregar información de la medición como metadata
        worksheet.addRow([]); // Fila vacía
        worksheet.addRow(['=== INFORMACIÓN DE LA MEDICIÓN ===']);
        worksheet.addRow(['ID Medición:', measurementData.medicion_id]);
        worksheet.addRow(['Fecha:', measurementData.fecha]);
        worksheet.addRow(['Hora:', measurementData.hora]);
        worksheet.addRow(['Evento:', measurementData.evento || 'Normal']);
        worksheet.addRow(['Observaciones:', measurementData.observaciones || 'Sin observaciones']);
        worksheet.addRow(['Tiempo Inicio:', measurementData.tiempo_inicio || 'No disponible']);
        worksheet.addRow(['Tiempo Fin:', measurementData.tiempo_fin || 'No disponible']);
        worksheet.addRow(['Total Lecturas:', readings.length]);
        worksheet.addRow(['Creado:', measurementData.created_at || 'No disponible']);

        // Generar archivo temporal
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const fileName = `medicion_${measurementData.medicion_id}_${Date.now()}.xlsx`;
        const filePath = path.join(tempDir, fileName);

        await workbook.xlsx.writeFile(filePath);
        console.log(`📄 Archivo Excel generado: ${filePath}`);

        return filePath;
    }

    /**
     * Envía un archivo Excel al endpoint usando FormData (compatible con Postman)
     * @param {string} filePath - Ruta del archivo Excel
     * @param {number} medicionId - ID de la medición
     * @returns {Promise<{success: boolean, response?: object, error?: string}>}
     */
    async uploadExcelFile(filePath, medicionId) {
        return new Promise(async (resolve) => {
            try {
                // Obtener token válido dinámicamente
                const token = await this.authService.getValidToken();
                
                const url = new URL(this.baseUrl + this.endpoint + `?idMedicion=${medicionId}`);
                const isHttps = url.protocol === 'https:';
                const client = isHttps ? https : http;

                // Crear FormData usando la librería form-data
                const form = new FormData();
                form.append('file', fs.createReadStream(filePath), {
                    filename: `medicion_${medicionId}.xlsx`,
                    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                });

                // Headers con token dinámico
                const headers = {
                    'accept': '*/*',
                    'Authorization': `Bearer ${token}`,
                    'Origin': 'file://',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    ...form.getHeaders()
                };

                const options = {
                    hostname: url.hostname,
                    port: url.port || (isHttps ? 443 : 80),
                    path: url.pathname + url.search,
                    method: 'POST',
                    headers: headers,
                    timeout: this.timeout,
                    // Ignorar certificados SSL auto-firmados para desarrollo local
                    rejectUnauthorized: false
                };

                console.log(`🌐 URL COMPLETA: ${url.toString()}`);
                console.log(`📊 Archivo: ${path.basename(filePath)}`);
                console.log(`🆔 ID Medición: ${medicionId}`);
                console.log(`📋 Headers:`, JSON.stringify(headers, null, 2));
                console.log(`🔑 Token dinámico (primeros 50 chars): ${token.substring(0, 50)}...`);

                const req = client.request(options, (res) => {
                    let responseData = '';

                    res.on('data', (chunk) => {
                        responseData += chunk;
                    });

                    res.on('end', () => {
                        try {
                            let parsedResponse = null;
                            
                            if (responseData) {
                                try {
                                    parsedResponse = JSON.parse(responseData);
                                } catch (e) {
                                    parsedResponse = responseData;
                                }
                            }

                            console.log(`📊 Status: ${res.statusCode}`);
                            console.log(`📋 Response:`, responseData);

                            if (res.statusCode >= 200 && res.statusCode < 300) {
                                resolve({
                                    success: true,
                                    response: parsedResponse,
                                    statusCode: res.statusCode
                                });
                            } else {
                                resolve({
                                    success: false,
                                    error: `HTTP ${res.statusCode}: ${parsedResponse?.message || responseData || 'Error desconocido'}`,
                                    statusCode: res.statusCode,
                                    response: parsedResponse
                                });
                            }

                        } catch (error) {
                            resolve({
                                success: false,
                                error: `Error procesando respuesta: ${error.message}`,
                                statusCode: res.statusCode
                            });
                        }
                    });
                });

                req.on('error', (error) => {
                    console.error('❌ Error de conexión:', error.message);
                    resolve({
                        success: false,
                        error: `Error de conexión: ${error.message}`
                    });
                });

                req.on('timeout', () => {
                    console.error('❌ Timeout de conexión');
                    req.destroy();
                    resolve({
                        success: false,
                        error: 'Timeout de conexión'
                    });
                });

                // Pipe del FormData al request
                form.pipe(req);

            } catch (error) {
                console.error('❌ Error preparando petición:', error.message);
                resolve({
                    success: false,
                    error: `Error preparando petición: ${error.message}`
                });
            }
        });
    }

    /**
     * Prepara datos en formato JSON
     * @param {object} measurementData - Datos de la medición
     * @param {Array} readings - Lecturas detalladas
     * @returns {object} Datos estructurados en JSON
     */
    prepareJsonData(measurementData, readings) {
        return {
            measurement: {
                id: measurementData.medicion_id,
                fecha: measurementData.fecha,
                hora: measurementData.hora,
                evento: measurementData.evento || 'Normal',
                observaciones: measurementData.observaciones,
                tiempo_inicio: measurementData.tiempo_inicio,
                tiempo_fin: measurementData.tiempo_fin,
                total_lecturas: readings.length,
                created_at: measurementData.created_at
            },
            readings: readings.map(reading => ({
                id: reading.id,
                o2: reading.o2,
                co: reading.co,
                ch4: reading.ch4,
                tiempo_relativo: reading.tiempo_relativo,
                evento: reading.evento || 'Normal',
                created_at: reading.created_at
            })),
            summary: {
                totalReadings: readings.length,
                o2Stats: this.calculateStats(readings, 'o2'),
                coStats: this.calculateStats(readings, 'co'),
                ch4Stats: this.calculateStats(readings, 'ch4')
            }
        };
    }

    /**
     * Prepara datos en formato CSV
     * @param {object} measurementData - Datos de la medición
     * @param {Array} readings - Lecturas detalladas
     * @returns {string} Datos en formato CSV
     */
    prepareCsvData(measurementData, readings) {
        const headers = [
            'medicion_id',
            'fecha',
            'hora',
            'evento',
            'observaciones',
            'tiempo_inicio',
            'tiempo_fin',
            'lectura_id',
            'o2',
            'co',
            'ch4',
            'tiempo_relativo',
            'lectura_evento'
        ];

        const csvRows = [headers.join(',')];

        readings.forEach(reading => {
            const row = [
                measurementData.medicion_id,
                `"${measurementData.fecha}"`,
                `"${measurementData.hora}"`,
                `"${measurementData.evento || 'Normal'}"`,
                `"${(measurementData.observaciones || '').replace(/"/g, '""')}"`,
                `"${measurementData.tiempo_inicio || ''}"`,
                `"${measurementData.tiempo_fin || ''}"`,
                reading.id,
                reading.o2 || '',
                reading.co || '',
                reading.ch4 || '',
                `"${reading.tiempo_relativo}"`,
                `"${reading.evento || 'Normal'}"`
            ];
            csvRows.push(row.join(','));
        });

        return '\uFEFF' + csvRows.join('\n'); // BOM para UTF-8
    }

    /**
     * Prepara datos para generar Excel (estructura para que el endpoint procese)
     * @param {object} measurementData - Datos de la medición
     * @param {Array} readings - Lecturas detalladas
     * @returns {object} Datos estructurados para Excel
     */
    prepareExcelData(measurementData, readings) {
        return {
            measurement: {
                id: measurementData.medicion_id,
                fecha: measurementData.fecha,
                hora: measurementData.hora,
                evento: measurementData.evento || 'Normal',
                observaciones: measurementData.observaciones,
                tiempo_inicio: measurementData.tiempo_inicio,
                tiempo_fin: measurementData.tiempo_fin,
                total_lecturas: readings.length,
                created_at: measurementData.created_at
            },
            readings: readings.map(reading => ({
                id: reading.id,
                o2: reading.o2,
                co: reading.co,
                ch4: reading.ch4,
                tiempo_relativo: reading.tiempo_relativo,
                evento: reading.evento || 'Normal',
                created_at: reading.created_at
            })),
            excelConfig: {
                worksheetName: `Medicion_${measurementData.medicion_id}`,
                includeSummary: true,
                includeCharts: false
            }
        };
    }

    /**
     * Calcula estadísticas para un gas específico
     * @param {Array} readings - Lecturas
     * @param {string} gas - Nombre del gas ('o2', 'co', 'ch4')
     * @returns {object} Estadísticas
     */
    calculateStats(readings, gas) {
        const values = readings
            .map(r => r[gas])
            .filter(v => v !== null && v !== undefined && !isNaN(v));

        if (values.length === 0) {
            return { min: null, max: null, avg: null, count: 0 };
        }

        return {
            min: Math.min(...values),
            max: Math.max(...values),
            avg: values.reduce((a, b) => a + b, 0) / values.length,
            count: values.length
        };
    }

    /**
     * Realiza una petición HTTP/HTTPS
     * @param {string} method - Método HTTP
     * @param {string} path - Ruta del endpoint
     * @param {object} data - Datos a enviar
     * @param {boolean} skipAuth - Saltar autenticación
     * @returns {Promise<{success: boolean, response?: object, statusCode?: number, error?: string}>}
     */
    async makeRequest(method, path, data = null, skipAuth = false) {
        return new Promise((resolve) => {
            try {
                const url = new URL(this.baseUrl + path);
                const isHttps = url.protocol === 'https:';
                const client = isHttps ? https : http;

                const headers = { ...this.headers };
                if (skipAuth) {
                    delete headers.Authorization;
                }

                const options = {
                    hostname: url.hostname,
                    port: url.port || (isHttps ? 443 : 80),
                    path: url.pathname + url.search,
                    method: method,
                    headers: headers,
                    timeout: this.timeout,
                    // Ignorar certificados SSL auto-firmados para desarrollo local
                    rejectUnauthorized: false
                };

                let postData = null;
                if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                    postData = JSON.stringify(data);
                    headers['Content-Length'] = Buffer.byteLength(postData);
                }

                console.log(`🌐 ${method} ${url.toString()}`);

                const req = client.request(options, (res) => {
                    let responseData = '';

                    res.on('data', (chunk) => {
                        responseData += chunk;
                    });

                    res.on('end', () => {
                        try {
                            let parsedResponse = null;
                            
                            if (responseData) {
                                try {
                                    parsedResponse = JSON.parse(responseData);
                                } catch (e) {
                                    parsedResponse = responseData;
                                }
                            }

                            if (res.statusCode >= 200 && res.statusCode < 300) {
                                resolve({
                                    success: true,
                                    response: parsedResponse,
                                    statusCode: res.statusCode
                                });
                            } else {
                                resolve({
                                    success: false,
                                    error: `HTTP ${res.statusCode}: ${parsedResponse?.message || responseData || 'Error desconocido'}`,
                                    statusCode: res.statusCode,
                                    response: parsedResponse
                                });
                            }

                        } catch (error) {
                            resolve({
                                success: false,
                                error: `Error procesando respuesta: ${error.message}`,
                                statusCode: res.statusCode
                            });
                        }
                    });
                });

                req.on('error', (error) => {
                    resolve({
                        success: false,
                        error: `Error de conexión: ${error.message}`
                    });
                });

                req.on('timeout', () => {
                    req.destroy();
                    resolve({
                        success: false,
                        error: 'Timeout de conexión'
                    });
                });

                if (postData) {
                    req.write(postData);
                }

                req.end();

            } catch (error) {
                resolve({
                    success: false,
                    error: `Error preparando petición: ${error.message}`
                });
            }
        });
    }

    /**
     * Carga configuración desde archivo
     * @param {string} configPath - Ruta al archivo de configuración
     * @returns {Promise<{success: boolean, config?: object, error?: string}>}
     */
    async loadConfigFromFile(configPath) {
        try {
            const fs = require('fs');
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
            const fs = require('fs');
            const path = require('path');
            
            const dir = path.dirname(configPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            console.log('✅ Configuración de blobs guardada exitosamente');
            
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
     * Verifica si el servicio está configurado
     * @returns {boolean} True si está configurado
     */
    isServiceConfigured() {
        return this.baseUrl !== null && this.apiKey !== null;
    }
}

module.exports = BlobService;
