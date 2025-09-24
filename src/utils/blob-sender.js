// Módulo integrado para envío de mediciones a contenedor de blobs
const InternetChecker = require('./internet.js');
const BlobService = require('./blob-service.js');
const DatabaseManager = require('./database.js');
const path = require('path');

class BlobSender {
    constructor() {
        this.internetChecker = new InternetChecker();
        this.blobService = new BlobService();
        this.dbManager = new DatabaseManager();
        this.configPath = path.join(process.cwd(), 'blob-config.json');
        this.isInitialized = false;
    }

    /**
     * Inicializa el servicio de envío a blobs
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async initialize() {
        try {
            console.log('🚀 Inicializando servicio de envío a blobs...');

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

            // 2. Cargar configuración de blobs
            console.log('📦 Cargando configuración de blobs...');
            const configResult = await this.blobService.loadConfigFromFile(this.configPath);
            
            if (!configResult.success) {
                return { 
                    success: false, 
                    error: `Error cargando configuración: ${configResult.error}` 
                };
            }

            console.log('✅ Configuración de blobs cargada');

            // 3. Verificar conexión con endpoint de blobs
            console.log('🔍 Verificando conexión con endpoint de blobs...');
            const verifyResult = await this.blobService.verifyConnection();
            
            if (!verifyResult.success) {
                console.log(`⚠️ No se pudo verificar conexión con endpoint: ${verifyResult.error}`);
                // No abortar, continuar con el envío
            } else {
                console.log('✅ Conexión con endpoint de blobs verificada');
            }

            // 4. Conectar a base de datos
            console.log('🗄️ Conectando a base de datos...');
            await this.dbManager.connect();
            await this.dbManager.initialize();

            this.isInitialized = true;
            console.log('✅ Servicio de envío a blobs inicializado correctamente');

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
     * Envía una medición específica como blob
     * @param {number} medicionId - ID de la medición a enviar
     * @param {string} format - Formato del blob ('json', 'csv', 'excel')
     * @returns {Promise<{success: boolean, measurementId?: number, blobId?: string, error?: string}>}
     */
    async sendMeasurementAsBlob(medicionId, format = 'json') {
        if (!this.isInitialized) {
            const initResult = await this.initialize();
            if (!initResult.success) {
                return { success: false, error: initResult.error };
            }
        }

        try {
            console.log(`📤 Enviando medición ${medicionId} como blob (formato: ${format})...`);

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

            // Enviar como blob
            const result = await this.blobService.uploadMeasurementBlob(measurement, readings, format);

            if (result.success) {
                console.log(`✅ Medición ${medicionId} enviada exitosamente como blob`);
                
                // Marcar medición como enviada a la plataforma
                try {
                    const markResult = await this.dbManager.markMedicionAsSentToPlatform(medicionId);
                    if (markResult.success) {
                        console.log(`✅ Medición ${medicionId} marcada como enviada a la plataforma`);
                    } else {
                        console.log(`⚠️ No se pudo marcar la medición como enviada: ${markResult.error}`);
                    }
                } catch (error) {
                    console.log(`⚠️ Error marcando medición como enviada: ${error.message}`);
                }
                
                return {
                    success: true,
                    measurementId: medicionId,
                    blobId: result.blobId,
                    blobName: result.blobName,
                    containerName: result.containerName,
                    format: format,
                    response: result.response,
                    markedAsSent: true
                };
            } else {
                return { success: false, error: result.error };
            }

        } catch (error) {
            console.error('❌ Error enviando medición como blob:', error.message);
            return { 
                success: false, 
                error: `Error enviando medición: ${error.message}` 
            };
        }
    }

    /**
     * Envía la última medición como blob
     * @param {string} format - Formato del blob ('json', 'csv', 'excel')
     * @returns {Promise<{success: boolean, measurementId?: number, error?: string}>}
     */
    async sendLatestMeasurementAsBlob(format = 'json') {
        if (!this.isInitialized) {
            const initResult = await this.initialize();
            if (!initResult.success) {
                return { success: false, error: initResult.error };
            }
        }

        try {
            console.log(`📤 Enviando última medición como blob (formato: ${format})...`);

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
            const result = await this.sendMeasurementAsBlob(medicionId, format);
            
            if (result.success) {
                result.measurementId = medicionId;
            }

            return result;

        } catch (error) {
            console.error('❌ Error enviando última medición como blob:', error.message);
            return { 
                success: false, 
                error: `Error enviando última medición: ${error.message}` 
            };
        }
    }

    /**
     * Envía múltiples mediciones como blobs por rango de fechas
     * @param {string} startDate - Fecha de inicio (YYYY-MM-DD)
     * @param {string} endDate - Fecha de fin (YYYY-MM-DD)
     * @param {string} format - Formato del blob ('json', 'csv', 'excel')
     * @returns {Promise<{success: boolean, sent: number, total: number, blobs?: Array, error?: string}>}
     */
    async sendMeasurementsAsBlobsByDateRange(startDate, endDate, format = 'json') {
        if (!this.isInitialized) {
            const initResult = await this.initialize();
            if (!initResult.success) {
                return { success: false, sent: 0, total: 0, error: initResult.error };
            }
        }

        try {
            console.log(`📤 Enviando mediciones del ${startDate} al ${endDate} como blobs (formato: ${format})...`);

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

            let sentCount = 0;
            const blobs = [];

            // Enviar cada medición como blob individual
            for (const measurement of measurements) {
                try {
                    // Obtener lecturas detalladas para esta medición
                    const detailedResult = await this.dbManager.getDetailedReadings(measurement.medicion_id);
                    const readings = detailedResult.success ? detailedResult.data : [];

                    const result = await this.blobService.uploadMeasurementBlob(measurement, readings, format);
                    
                    if (result.success) {
                        sentCount++;
                        blobs.push({
                            measurementId: measurement.medicion_id,
                            blobId: result.blobId,
                            blobName: result.blobName,
                            format: format
                        });
                        console.log(`✅ Blob ${sentCount}/${measurements.length} enviado: ${result.blobName}`);
                        
                        // Marcar medición como enviada a la plataforma
                        try {
                            const markResult = await this.dbManager.markMedicionAsSentToPlatform(measurement.medicion_id);
                            if (markResult.success) {
                                console.log(`✅ Medición ${measurement.medicion_id} marcada como enviada`);
                            }
                        } catch (error) {
                            console.log(`⚠️ Error marcando medición ${measurement.medicion_id} como enviada: ${error.message}`);
                        }
                    } else {
                        console.log(`❌ Error enviando blob para medición ${measurement.medicion_id}: ${result.error}`);
                    }

                    // Pequeña pausa entre envíos
                    await new Promise(resolve => setTimeout(resolve, 500));

                } catch (error) {
                    console.log(`❌ Error procesando medición ${measurement.medicion_id}: ${error.message}`);
                }
            }

            return {
                success: sentCount > 0,
                sent: sentCount,
                total: measurements.length,
                blobs: blobs,
                message: `Enviados ${sentCount} de ${measurements.length} blobs`
            };

        } catch (error) {
            console.error('❌ Error enviando mediciones como blobs:', error.message);
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
     * @returns {Promise<{internet: boolean, blobService: boolean, database: boolean, error?: string}>}
     */
    async checkServiceStatus() {
        const status = {
            internet: false,
            blobService: false,
            database: false
        };

        try {
            // Verificar internet
            const connectionResult = await this.internetChecker.checkConnection();
            status.internet = connectionResult.connected;

            // Verificar servicio de blobs
            if (this.blobService.isServiceConfigured()) {
                const verifyResult = await this.blobService.verifyConnection();
                status.blobService = verifyResult.success;
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
            console.log('✅ Servicio de envío a blobs cerrado');
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
                endpoint: "/api/blobs/upload",
                containerName: "mediciones",
                headers: {
                    "X-Source": "ModbusAnalyzer",
                    "X-Version": "1.0"
                }
            };

            await this.blobService.saveConfigToFile(exampleConfig, this.configPath);

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

module.exports = BlobSender;
