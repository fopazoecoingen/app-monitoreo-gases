// Módulo integrado para envío de datos a plataforma web con verificación de internet
const InternetChecker = require('./internet.js');
const WebPlatformService = require('./web-platform.js');
const DatabaseManager = require('./database.js');
const path = require('path');
const fs = require('fs');

class WebSender {
    constructor() {
        this.internetChecker = new InternetChecker();
        this.webPlatformService = new WebPlatformService();
        this.dbManager = new DatabaseManager();
        this.configPath = path.join(process.cwd(), 'web-platform-config.json');
        this.isInitialized = false;
    }

    /**
     * Inicializa el servicio de envío a plataforma web
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async initialize() {
        try {
            console.log('🚀 Inicializando servicio de envío a plataforma web...');

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

            // 2. Cargar configuración de plataforma web
            console.log('🌐 Cargando configuración de plataforma web...');
            const configResult = await this.webPlatformService.loadConfigFromFile(this.configPath);
            
            if (!configResult.success) {
                return { 
                    success: false, 
                    error: `Error cargando configuración: ${configResult.error}` 
                };
            }

            console.log('✅ Configuración de plataforma web cargada');

            // 3. Verificar conexión con plataforma web
            console.log('🔍 Verificando conexión con plataforma web...');
            const verifyResult = await this.webPlatformService.verifyConnection();
            
            if (!verifyResult.success) {
                console.log(`⚠️ No se pudo verificar conexión con plataforma web: ${verifyResult.error}`);
                // No abortar, continuar con el envío
            } else {
                console.log('✅ Conexión con plataforma web verificada');
            }

            // 4. Conectar a base de datos
            console.log('🗄️ Conectando a base de datos...');
            await this.dbManager.connect();
            await this.dbManager.initialize();

            this.isInitialized = true;
            console.log('✅ Servicio de envío a plataforma web inicializado correctamente');

            return { success: true };

        } catch (error) {
            console.error('❌ Error inicializando servicio:', error.message);
            return { 
                success: false, 
                error: `Error de inicialización: ${error.message}` 
            };
        }
    }

    /**
     * Envía una medición específica a la plataforma web
     * @param {number} medicionId - ID de la medición a enviar
     * @returns {Promise<{success: boolean, measurementId?: number, error?: string}>}
     */
    async sendMeasurementToPlatform(medicionId) {
        if (!this.isInitialized) {
            const initResult = await this.initialize();
            if (!initResult.success) {
                return { success: false, error: initResult.error };
            }
        }

        try {
            console.log(`📤 Enviando medición ${medicionId} a plataforma web...`);

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

            // Enviar a plataforma web
            const result = await this.webPlatformService.sendMeasurement(measurement, readings);

            if (result.success) {
                console.log(`✅ Medición ${medicionId} enviada exitosamente a plataforma web`);
                return {
                    success: true,
                    measurementId: medicionId,
                    response: result.response
                };
            } else {
                return { success: false, error: result.error };
            }

        } catch (error) {
            console.error('❌ Error enviando medición:', error.message);
            return { 
                success: false, 
                error: `Error enviando medición: ${error.message}` 
            };
        }
    }

    /**
     * Envía la última medición a la plataforma web
     * @returns {Promise<{success: boolean, measurementId?: number, error?: string}>}
     */
    async sendLatestMeasurementToPlatform() {
        if (!this.isInitialized) {
            const initResult = await this.initialize();
            if (!initResult.success) {
                return { success: false, error: initResult.error };
            }
        }

        try {
            console.log('📤 Enviando última medición a plataforma web...');

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

            // Enviar medición
            const result = await this.sendMeasurementToPlatform(medicionId);
            
            if (result.success) {
                result.measurementId = medicionId;
            }

            return result;

        } catch (error) {
            console.error('❌ Error enviando última medición:', error.message);
            return { 
                success: false, 
                error: `Error enviando última medición: ${error.message}` 
            };
        }
    }

    /**
     * Envía mediciones por rango de fechas a la plataforma web
     * @param {string} startDate - Fecha de inicio (YYYY-MM-DD)
     * @param {string} endDate - Fecha de fin (YYYY-MM-DD)
     * @returns {Promise<{success: boolean, sent: number, total: number, error?: string}>}
     */
    async sendMeasurementsByDateRangeToPlatform(startDate, endDate) {
        if (!this.isInitialized) {
            const initResult = await this.initialize();
            if (!initResult.success) {
                return { success: false, sent: 0, total: 0, error: initResult.error };
            }
        }

        try {
            console.log(`📤 Enviando mediciones del ${startDate} al ${endDate} a plataforma web...`);

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

            // Enviar a plataforma web
            const result = await this.webPlatformService.sendMeasurementsByDateRange(measurements, startDate, endDate);

            if (result.success) {
                console.log(`✅ ${result.sent} mediciones enviadas exitosamente a plataforma web`);
            } else {
                console.log(`❌ Error enviando mediciones: ${result.error}`);
            }

            return result;

        } catch (error) {
            console.error('❌ Error enviando mediciones por rango:', error.message);
            return { 
                success: false, 
                sent: 0, 
                total: 0, 
                error: `Error enviando mediciones: ${error.message}` 
            };
        }
    }

    /**
     * Verifica el estado del servicio
     * @returns {Promise<{internet: boolean, webPlatform: boolean, database: boolean, error?: string}>}
     */
    async checkServiceStatus() {
        const status = {
            internet: false,
            webPlatform: false,
            database: false
        };

        try {
            // Verificar internet
            const connectionResult = await this.internetChecker.checkConnection();
            status.internet = connectionResult.connected;

            // Verificar plataforma web
            if (this.webPlatformService.isServiceConfigured()) {
                const verifyResult = await this.webPlatformService.verifyConnection();
                status.webPlatform = verifyResult.success;
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
            console.log('✅ Servicio de envío a plataforma web cerrado');
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
                baseUrl: "https://api.miplataforma.com",
                apiKey: "tu-api-key-aqui",
                endpoint: "/api/mediciones",
                headers: {
                    "X-Source": "ModbusAnalyzer",
                    "X-Version": "1.0"
                }
            };

            await this.webPlatformService.saveConfigToFile(exampleConfig, this.configPath);

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
     * Obtiene información de la medición para mostrar en la interfaz
     * @param {number} medicionId - ID de la medición
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async getMeasurementInfo(medicionId) {
        try {
            if (!this.isInitialized) {
                await this.dbManager.connect();
                await this.dbManager.initialize();
            }

            const readingsResult = await this.dbManager.getAllReadings();
            
            if (!readingsResult.success) {
                return { success: false, error: 'Error obteniendo mediciones' };
            }

            const measurement = readingsResult.data.find(m => m.medicion_id === medicionId);
            
            if (!measurement) {
                return { success: false, error: `Medición con ID ${medicionId} no encontrada` };
            }

            // Obtener lecturas detalladas
            const detailedResult = await this.dbManager.getDetailedReadings(medicionId);
            const readings = detailedResult.success ? detailedResult.data : [];

            return {
                success: true,
                data: {
                    ...measurement,
                    readings: readings,
                    totalReadings: readings.length,
                    hasData: readings.length > 0
                }
            };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = WebSender;
