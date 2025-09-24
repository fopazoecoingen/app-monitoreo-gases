// Servicio para enviar datos a plataforma web
const https = require('https');
const http = require('http');

class WebPlatformService {
    constructor() {
        this.baseUrl = null;
        this.apiKey = null;
        this.endpoint = null;
        this.timeout = 30000; // 30 segundos
    }

    /**
     * Configura el servicio de plataforma web
     * @param {object} config - Configuración de la plataforma
     * @param {string} config.baseUrl - URL base de la plataforma (ej: https://api.miplataforma.com)
     * @param {string} config.apiKey - Clave API para autenticación
     * @param {string} config.endpoint - Endpoint para enviar mediciones (ej: /api/mediciones)
     * @param {object} config.headers - Headers adicionales (opcional)
     */
    configure(config) {
        try {
            this.baseUrl = config.baseUrl;
            this.apiKey = config.apiKey;
            this.endpoint = config.endpoint || '/api/mediciones';
            
            // Headers por defecto
            this.headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                'User-Agent': 'ModbusAnalyzer/1.0',
                ...config.headers
            };

            console.log('✅ Servicio de plataforma web configurado');
            console.log(`   URL: ${this.baseUrl}${this.endpoint}`);
            
            return { success: true, message: 'Configuración exitosa' };
        } catch (error) {
            console.error('❌ Error configurando servicio web:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Verifica la conexión con la plataforma web
     * @returns {Promise<{success: boolean, statusCode?: number, error?: string}>}
     */
    async verifyConnection() {
        if (!this.baseUrl) {
            return { success: false, error: 'Servicio no configurado' };
        }

        try {
            console.log('🔍 Verificando conexión con plataforma web...');
            
            const result = await this.makeRequest('GET', '/health', null, true);
            
            if (result.success) {
                console.log('✅ Conexión con plataforma web verificada');
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
     * Envía una medición a la plataforma web
     * @param {object} measurementData - Datos de la medición
     * @param {Array} readings - Lecturas detalladas
     * @returns {Promise<{success: boolean, response?: object, error?: string}>}
     */
    async sendMeasurement(measurementData, readings) {
        if (!this.baseUrl) {
            return { success: false, error: 'Servicio no configurado' };
        }

        try {
            console.log(`📤 Enviando medición ${measurementData.medicion_id} a plataforma web...`);

            // Preparar datos para envío
            const payload = {
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
                metadata: {
                    source: 'ModbusAnalyzer',
                    version: '1.0',
                    sent_at: new Date().toISOString(),
                    total_records: readings.length
                }
            };

            const result = await this.makeRequest('POST', this.endpoint, payload);

            if (result.success) {
                console.log('✅ Medición enviada exitosamente a plataforma web');
                return {
                    success: true,
                    response: result.response,
                    measurementId: measurementData.medicion_id
                };
            } else {
                console.log(`❌ Error enviando medición: ${result.error}`);
                return { success: false, error: result.error };
            }

        } catch (error) {
            console.error('❌ Error enviando medición:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Envía múltiples mediciones por rango de fechas
     * @param {Array} measurements - Array de mediciones
     * @param {string} startDate - Fecha de inicio
     * @param {string} endDate - Fecha de fin
     * @returns {Promise<{success: boolean, sent: number, total: number, error?: string}>}
     */
    async sendMeasurementsByDateRange(measurements, startDate, endDate) {
        if (!this.baseUrl) {
            return { success: false, sent: 0, total: 0, error: 'Servicio no configurado' };
        }

        try {
            console.log(`📤 Enviando ${measurements.length} mediciones del ${startDate} al ${endDate}...`);

            const payload = {
                measurements: measurements.map(measurement => ({
                    id: measurement.medicion_id,
                    fecha: measurement.fecha,
                    hora: measurement.hora,
                    evento: measurement.evento || 'Normal',
                    observaciones: measurement.observaciones,
                    tiempo_inicio: measurement.tiempo_inicio,
                    tiempo_fin: measurement.tiempo_fin,
                    total_lecturas: measurement.total_lecturas,
                    created_at: measurement.created_at
                })),
                date_range: {
                    start: startDate,
                    end: endDate
                },
                metadata: {
                    source: 'ModbusAnalyzer',
                    version: '1.0',
                    sent_at: new Date().toISOString(),
                    total_measurements: measurements.length
                }
            };

            const result = await this.makeRequest('POST', '/api/mediciones/batch', payload);

            if (result.success) {
                console.log(`✅ ${measurements.length} mediciones enviadas exitosamente`);
                return {
                    success: true,
                    sent: measurements.length,
                    total: measurements.length,
                    response: result.response
                };
            } else {
                console.log(`❌ Error enviando mediciones: ${result.error}`);
                return { success: false, sent: 0, total: measurements.length, error: result.error };
            }

        } catch (error) {
            console.error('❌ Error enviando mediciones:', error.message);
            return { success: false, sent: 0, total: measurements.length, error: error.message };
        }
    }

    /**
     * Realiza una petición HTTP/HTTPS
     * @param {string} method - Método HTTP (GET, POST, PUT, etc.)
     * @param {string} path - Ruta del endpoint
     * @param {object} data - Datos a enviar (opcional)
     * @param {boolean} skipAuth - Saltar autenticación para health check
     * @returns {Promise<{success: boolean, response?: object, statusCode?: number, error?: string}>}
     */
    async makeRequest(method, path, data = null, skipAuth = false) {
        return new Promise((resolve) => {
            try {
                const url = new URL(this.baseUrl + path);
                const isHttps = url.protocol === 'https:';
                const client = isHttps ? https : http;

                // Preparar headers
                const headers = { ...this.headers };
                if (skipAuth) {
                    delete headers.Authorization;
                }

                // Preparar opciones de la petición
                const options = {
                    hostname: url.hostname,
                    port: url.port || (isHttps ? 443 : 80),
                    path: url.pathname + url.search,
                    method: method,
                    headers: headers,
                    timeout: this.timeout
                };

                // Si hay datos, agregarlos al body
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
                            
                            // Intentar parsear JSON si hay contenido
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

                // Enviar datos si los hay
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
            
            // Crear directorio si no existe
            const dir = path.dirname(configPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            console.log('✅ Configuración de plataforma web guardada exitosamente');
            
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
        return this.baseUrl ? {
            baseUrl: this.baseUrl,
            apiKey: this.apiKey,
            endpoint: this.endpoint,
            headers: this.headers
        } : null;
    }

    /**
     * Verifica si el servicio está configurado
     * @returns {boolean} True si está configurado
     */
    isServiceConfigured() {
        return this.baseUrl !== null && this.apiKey !== null;
    }
}

module.exports = WebPlatformService;
