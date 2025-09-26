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
        
        // Detectar si está en modo empaquetado
        const isPackaged = process.env.NODE_ENV === 'production' || 
                          (process.mainModule && process.mainModule.filename.indexOf('app.asar') !== -1) ||
                          process.resourcesPath;
        
        if (isPackaged) {
            // En modo empaquetado, buscar en el directorio de recursos
            this.configPath = path.join(process.resourcesPath || __dirname, 'blob-config.json');
        } else {
            // En modo desarrollo, buscar en el directorio raíz del proyecto
            this.configPath = path.join(__dirname, '..', '..', 'blob-config.json');
        }
        
        console.log('🔍 Ruta de configuración detectada:', this.configPath);
        console.log('🔍 Modo empaquetado:', isPackaged);
        this.isInitialized = false;
    }

    /**
     * Inicializa el servicio de envío a blobs
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async initialize() {
        try {
            console.log('🚀 Inicializando servicio de envío a blobs...');
            console.log('📋 Estado inicial del servicio:');
            console.log(`   - Internet Checker: ${this.internetChecker ? '✅ Instanciado' : '❌ No instanciado'}`);
            console.log(`   - Blob Service: ${this.blobService ? '✅ Instanciado' : '❌ No instanciado'}`);
            console.log(`   - Database Manager: ${this.dbManager ? '✅ Instanciado' : '❌ No instanciado'}`);
            console.log(`   - Config Path: ${this.configPath}`);

            // 1. Verificar conexión a internet
            console.log('🔍 Verificando conexión a internet...');
            const connectionResult = await this.internetChecker.checkConnection();
            console.log(`📊 Resultado de conexión:`, connectionResult);
            
            if (!connectionResult.connected) {
                console.log('⚠️ No hay conexión a internet. Intentando esperar...');
                const waitResult = await this.internetChecker.waitForConnection(3000, 5);
                console.log(`📊 Resultado de espera:`, waitResult);
                
                if (!waitResult.connected) {
                    console.log('❌ No se pudo establecer conexión a internet después de esperar');
                    return { 
                        success: false, 
                        error: 'No se pudo establecer conexión a internet' 
                    };
                }
            }

            console.log('✅ Conexión a internet verificada');

            // 2. Cargar configuración de blobs
            console.log('📦 Cargando configuración de blobs...');
            console.log(`   - Archivo de configuración: ${this.configPath}`);
            const configResult = await this.blobService.loadConfigFromFile(this.configPath);
            console.log(`📊 Resultado de carga de configuración:`, configResult);
            
            if (!configResult.success) {
                console.log('❌ Error cargando configuración de blobs');
                console.log('🔧 Intentando crear configuración por defecto...');
                
                // Crear configuración por defecto
                const defaultConfig = {
                    baseUrl: "https://ecoingen-api-produccion.azurewebsites.net",
                    apiKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJsYWJvcmF0b3Jpb0BlY29pbmdlbi5jb20iLCJyb2wiOiJsYWJvcmF0b3JpbyIsIkxpc3RhRW1wcmVzYXMiOiJ7XCIyXCI6W3tcIklkXCI6MSxcIkRlc2NyaXBjaW9uXCI6XCJEUzEzOFwifSx7XCJJZFwiOjIsXCJEZXNjcmlwY2lvblwiOlwiU0lOQURFUiBNRU5TVUFMXCJ9LHtcIklkXCI6MyxcIkRlc2NyaXBjaW9uXCI6XCJTSU5BREVSIEFOVUFMXCJ9LHtcIklkXCI6NCxcIkRlc2NyaXBjaW9uXCI6XCJTSU5BREVSIEFOVUFMXCJ9LHtcIklkXCI6NSxcIkRlc2NyaXBjaW9uXCI6XCJERUNMQVJBQ0lPTiBKVVJBREFcIn0se1wiSWRcIjo2LFwiRGVzY3JpcGNpb25cIjpcIkNBVEFTVFJPIFNJU0FUXCJ9LHtcIklkXCI6NyxcIkRlc2NyaXBjaW9uXCI6XCJSRVNJRFVPT1MgUEVMSUdST1NPUyAoU0lEUkVQKVwifSx7XCJJZFwiOjgsXCJEZXNjcmlwY2lvblwiOlwiREVTRU1QRVxcdTAwRDFPIEFNQklFTlRBTCBFTVBSRVNBUklBTCAoREFFKVwifSx7XCJJZFwiOjEwLFwiRGVzY3JpcGNpb25cIjpcIlJFU1BPTlNBQklMSURBRCBERUwgUFJPRFVDVE9SIChMRVkgUkVQKVwifSx7XCJJZFwiOjExLFwiRGVzY3JpcGNpb25cIjpcIlJFUE9SVEUgVFJJTUVTVFJBTFwifSx7XCJJZFwiOjEyLFwiRGVzY3JpcGNpb25cIjpcIkhVRUxMQSBDQVJCT05PIC0gUExBTiAxXCJ9LHtcIklkXCI6MTUsXCJEZXNjcmlwY2lvblwiOlwiQkFMQU5DRSBOQUNJT05BTCBFTkVSR0lBXCJ9LHtcIklkXCI6MTgsXCJEZXNjcmlwY2lvblwiOlwiQVVESVRPUklBXCJ9XX0iLCJJZFRyYW5zcG9ydGlzdGEiOiIwIiwiSWQiOiI0NyIsIm5iZiI6MTc1ODcyOTA4MiwiemV4cCI6MTc1ODgxNTQ4MiwiaXNzIjoiaHR0cHM6Ly93d3cuZWNvaW5nZW4uY2wvIiwiYXVkIjoiRWNvaW5nZW4ifQ.Zcw4cUYQQUkS_PNskYcnn-75IXRketDu6Bf8rrMIkfI",
                    endpoint: "/api/Storage/uploadExcelMedicionesSoftware",
                    containerName: "mediciones",
                    headers: {
                        "accept": "*/*",
                        "X-Source": "ModbusAnalyzer",
                        "X-Version": "1.0"
                    }
                };
                
                const createResult = await this.blobService.saveConfigToFile(defaultConfig, this.configPath);
                if (createResult.success) {
                    console.log('✅ Configuración por defecto creada');
                    // Intentar cargar la configuración recién creada
                    const reloadResult = await this.blobService.loadConfigFromFile(this.configPath);
                    if (reloadResult.success) {
                        console.log('✅ Configuración cargada exitosamente');
                    } else {
                        return { 
                            success: false, 
                            error: `Error cargando configuración: ${reloadResult.error}` 
                        };
                    }
                } else {
                    return { 
                        success: false, 
                        error: `Error creando configuración: ${createResult.error}` 
                    };
                }
            }

            console.log('✅ Configuración de blobs cargada');

            // 3. Verificar conexión con endpoint de blobs
            console.log('🔍 Verificando conexión con endpoint de blobs...');
            const verifyResult = await this.blobService.verifyConnection();
            console.log(`📊 Resultado de verificación de endpoint:`, verifyResult);
            
            if (!verifyResult.success) {
                console.log(`⚠️ No se pudo verificar conexión con endpoint: ${verifyResult.error}`);
                console.log('⚠️ Continuando sin verificación de endpoint...');
            } else {
                console.log('✅ Conexión con endpoint de blobs verificada');
            }

            // 4. Conectar a base de datos
            console.log('🗄️ Conectando a base de datos...');
            await this.dbManager.connect();
            console.log('✅ Base de datos conectada');
            
            await this.dbManager.initialize();
            console.log('✅ Base de datos inicializada');

            this.isInitialized = true;
            console.log('✅ Servicio de envío a blobs inicializado correctamente');
            console.log('📋 Estado final del servicio:');
            console.log(`   - Inicializado: ${this.isInitialized ? '✅ Sí' : '❌ No'}`);
            console.log(`   - Internet: ${connectionResult.connected ? '✅ Conectado' : '❌ Desconectado'}`);
            console.log(`   - Blob Service: ${this.blobService ? '✅ Disponible' : '❌ No disponible'}`);
            console.log(`   - Database: ${this.dbManager ? '✅ Conectado' : '❌ Desconectado'}`);

            return { success: true };

        } catch (error) {
            console.error('❌ Error inicializando servicio:', error.message);
            console.error('📊 Stack trace completo:', error.stack);
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
        console.log(`\n🚀 === INICIANDO ENVÍO DE MEDICIÓN ===`);
        console.log(`📋 Parámetros de entrada:`);
        console.log(`   - Medición ID: ${medicionId}`);
        console.log(`   - Formato: ${format}`);
        console.log(`   - Servicio inicializado: ${this.isInitialized ? '✅ Sí' : '❌ No'}`);

        if (!this.isInitialized) {
            console.log('🔄 Servicio no inicializado, inicializando...');
            const initResult = await this.initialize();
            console.log(`📊 Resultado de inicialización:`, initResult);
            if (!initResult.success) {
                console.log('❌ Falló la inicialización del servicio');
                return { success: false, error: initResult.error };
            }
        }

        try {
            console.log(`📤 Enviando medición ${medicionId} como blob (formato: ${format})...`);

            // Obtener datos de la medición
            console.log('🔍 Obteniendo todas las mediciones de la base de datos...');
            const readingsResult = await this.dbManager.getAllReadings();
            console.log(`📊 Resultado de getAllReadings:`, {
                success: readingsResult.success,
                dataLength: readingsResult.data ? readingsResult.data.length : 0,
                error: readingsResult.error
            });
            
            if (!readingsResult.success) {
                console.log('❌ Error obteniendo mediciones de la base de datos');
                return { 
                    success: false, 
                    error: 'Error obteniendo mediciones de la base de datos' 
                };
            }

            console.log(`📋 Total de mediciones encontradas: ${readingsResult.data.length}`);
            const measurement = readingsResult.data.find(m => m.medicion_id === medicionId);
            
            if (!measurement) {
                console.log(`❌ Medición con ID ${medicionId} no encontrada`);
                console.log('📋 IDs de mediciones disponibles:', readingsResult.data.map(m => m.medicion_id));
                return { 
                    success: false, 
                    error: `Medición con ID ${medicionId} no encontrada` 
                };
            }

            console.log(`✅ Medición encontrada:`, {
                id: measurement.medicion_id,
                fecha: measurement.fecha,
                tipo_evento: measurement.tipo_evento,
                duracion: measurement.duracion
            });

            // Obtener lecturas detalladas
            console.log(`🔍 Obteniendo lecturas detalladas para medición ${medicionId}...`);
            const detailedResult = await this.dbManager.getDetailedReadings(medicionId);
            console.log(`📊 Resultado de getDetailedReadings:`, {
                success: detailedResult.success,
                dataLength: detailedResult.data ? detailedResult.data.length : 0,
                error: detailedResult.error
            });
            
            const readings = detailedResult.success ? detailedResult.data : [];
            console.log(`✅ Datos obtenidos: ${readings.length} lecturas detalladas`);

            if (readings.length > 0) {
                console.log(`📋 Muestra de lecturas (primeras 3):`, readings.slice(0, 3));
            }

            // Verificar estado de autenticación antes del envío
            console.log('🔐 Verificando estado de autenticación...');
            if (this.blobService.authService) {
                const tokenInfo = this.blobService.authService.getTokenInfo();
                console.log(`📊 Estado del token:`, tokenInfo);
            } else {
                console.log('⚠️ AuthService no disponible');
            }

            // Enviar como blob
            console.log('📤 Iniciando envío como blob...');
            const result = await this.blobService.uploadMeasurementBlob(measurement, readings, format);
            console.log(`📊 Resultado del envío:`, {
                success: result.success,
                blobId: result.blobId,
                blobName: result.blobName,
                error: result.error
            });

            if (result.success) {
                console.log(`✅ Medición ${medicionId} enviada exitosamente como blob`);
                console.log(`📋 Detalles del blob enviado:`);
                console.log(`   - Blob ID: ${result.blobId}`);
                console.log(`   - Blob Name: ${result.blobName}`);
                console.log(`   - Container: ${result.containerName}`);
                console.log(`   - Formato: ${format}`);
                
                // Marcar medición como enviada a la plataforma
                console.log('🏷️ Marcando medición como enviada a la plataforma...');
                try {
                    const markResult = await this.dbManager.markMedicionAsSentToPlatform(medicionId);
                    console.log(`📊 Resultado de marcado:`, markResult);
                    if (markResult.success) {
                        console.log(`✅ Medición ${medicionId} marcada como enviada a la plataforma`);
                    } else {
                        console.log(`⚠️ No se pudo marcar la medición como enviada: ${markResult.error}`);
                    }
                } catch (error) {
                    console.log(`⚠️ Error marcando medición como enviada: ${error.message}`);
                }
                
                console.log(`🎉 === ENVÍO COMPLETADO EXITOSAMENTE ===\n`);
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
                console.log(`❌ Falló el envío del blob: ${result.error}`);
                console.log(`❌ === ENVÍO FALLÓ ===\n`);
                return { success: false, error: result.error };
            }

        } catch (error) {
            console.error('❌ Error enviando medición como blob:', error.message);
            console.error('📊 Stack trace completo:', error.stack);
            console.log(`❌ === ENVÍO FALLÓ CON EXCEPCIÓN ===\n`);
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
                baseUrl: "https://ecoingen-api-produccion.azurewebsites.net",
                apiKey: "tu-api-key-aqui",
                endpoint: "/api/Storage/uploadExcelMedicionesSoftware",
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
