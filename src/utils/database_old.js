// Utilidades para manejo de base de datos SQLite
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const os = require('os');

class DatabaseManager {
    constructor(dbPath = null) {
        // Si no se especifica ruta, usar la carpeta de documentos del usuario
        if (!dbPath) {
            const dbDir = path.join(os.homedir(), 'Documents', 'ModbusAnalyzer');
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }
            this.dbPath = path.join(dbDir, 'modbus_data.db');
        } else {
            this.dbPath = dbPath;
        }
        
        this.db = null;
        this.isConnected = false;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Error conectando a la base de datos:', err.message);
                    reject(err);
                } else {
                    console.log('Conectado a la base de datos SQLite:', this.dbPath);
                    this.isConnected = true;
                    
                    // Habilitar foreign keys
                    this.db.run('PRAGMA foreign_keys = ON', (err) => {
                        if (err) {
                            console.error('Error habilitando foreign keys:', err.message);
                        }
                    });
                    
                    resolve();
                }
            });
        });
    }

    disconnect() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('Error cerrando base de datos:', err.message);
                    } else {
                        console.log('Base de datos cerrada');
                    }
                    this.isConnected = false;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    isDatabaseConnected() {
        return this.isConnected && this.db !== null;
    }

    async initialize() {
        if (!this.isConnected) {
            await this.connect();
        }

        // Migrar tabla lecturas_detalladas si es necesario
        await this.migrateLecturasDetalladasIfNeeded();

        return new Promise((resolve, reject) => {
            // Crear tabla medicion
            const createMedicionTable = `
                CREATE TABLE IF NOT EXISTS medicion (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    fecha TEXT NOT NULL,
                    hora TEXT NOT NULL,
                    evento TEXT DEFAULT 'Normal',
                    observaciones TEXT,
                    tiempo_inicio DATETIME,
                    tiempo_fin DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;

            // Tabla detalle_medicion eliminada - no se usaba

            // Crear tabla para guardar todas las lecturas individuales durante una sesión
            const createLecturasDetalladasTable = `
                CREATE TABLE IF NOT EXISTS lecturas_detalladas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    medicion_id INTEGER NOT NULL,
                    o2 REAL NULL,
                    co REAL NULL,
                    ch4 REAL NULL,
                    tiempo_relativo TEXT NOT NULL,
                    evento TEXT DEFAULT 'Normal',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (medicion_id) REFERENCES medicion (id) ON DELETE CASCADE
                )
            `;

            this.db.run(createMedicionTable, (err) => {
                if (err) {
                    console.error('Error creando tabla medicion:', err.message);
                    reject(err);
                    return;
                }

                console.log('Tabla medicion creada/verificada exitosamente');

                // Verificar si la tabla medicion necesita migración para agregar campos de tiempo
                this.migrateMedicionTableIfNeeded().then(() => {
                    // Crear tabla de lecturas detalladas directamente
                    this.db.run(createLecturasDetalladasTable, (err) => {
                        if (err) {
                            console.error('Error creando tabla lecturas_detalladas:', err.message);
                            reject(err);
                            return;
                        }

                        console.log('Tabla lecturas_detalladas creada exitosamente');

                        // Crear índices para mejorar rendimiento
                        this.createIndexes()
                            .then(() => {
                                console.log('Base de datos inicializada correctamente');
                                resolve();
                            })
                            .catch(reject);
                    });
                }).catch(reject);
            });
        });
    }

    async migrateMedicionTableIfNeeded() {
        return new Promise((resolve, reject) => {
            // Verificar si la tabla medicion tiene las columnas de tiempo
            this.db.all("PRAGMA table_info(medicion)", (err, columns) => {
                if (err) {
                    console.error('Error verificando columnas de medicion:', err.message);
                    reject(err);
                    return;
                }

                const hasTiempoInicio = columns.some(col => col.name === 'tiempo_inicio');
                const hasTiempoFin = columns.some(col => col.name === 'tiempo_fin');

                if (!hasTiempoInicio || !hasTiempoFin) {
                    console.log('Migrando tabla medicion para agregar campos de tiempo...');
                    
                    // Agregar las columnas de tiempo si no existen
                    const alterQueries = [];
                    if (!hasTiempoInicio) {
                        alterQueries.push('ALTER TABLE medicion ADD COLUMN tiempo_inicio DATETIME');
                    }
                    if (!hasTiempoFin) {
                        alterQueries.push('ALTER TABLE medicion ADD COLUMN tiempo_fin DATETIME');
                    }

                    let completed = 0;
                    alterQueries.forEach((query, index) => {
                        this.db.run(query, (err) => {
                            if (err) {
                                console.error(`Error ejecutando migración ${index + 1}:`, err.message);
                                reject(err);
                                return;
                            }
                            completed++;
                            if (completed === alterQueries.length) {
                                console.log('Tabla medicion migrada exitosamente');
                                resolve();
                            }
                        });
                    });
                } else {
                    console.log('Tabla medicion ya tiene campos de tiempo');
                    resolve();
                }
            });
        });
    }

    verifyDetalleMedicionTable(createDetalleMedicionTable, createLecturasDetalladasTable, resolve, reject) {
        // Verificar si la tabla detalle_medicion existe con el esquema antiguo
        this.db.get("PRAGMA table_info(detalle_medicion)", (err, result) => {
            if (err) {
                // La tabla no existe, crear con nuevo esquema
                this.createDetalleMedicionTable(createDetalleMedicionTable, createLecturasDetalladasTable, resolve, reject);
            } else {
                // Verificar si tiene las columnas nuevas
                this.db.all("PRAGMA table_info(detalle_medicion)", (err, columns) => {
                    if (err) {
                        console.error('Error verificando columnas:', err.message);
                        reject(err);
                        return;
                    }

                    const hasNewColumns = columns.some(col => col.name === 'o2');
                    
                    if (!hasNewColumns) {
                        console.log('Migrando tabla detalle_medicion al nuevo esquema...');
                        this.migrateDetalleMedicionTable().then(() => {
                            // Crear tabla lecturas_detalladas después de la migración
                            this.db.run(createLecturasDetalladasTable, (err) => {
                                if (err) {
                                    console.error('Error creando tabla lecturas_detalladas:', err.message);
                                    reject(err);
                                } else {
                                    console.log('Tabla lecturas_detalladas creada exitosamente');
                                    this.createIndexes().then(resolve).catch(reject);
                                }
                            });
                        }).catch(reject);
                    } else {
                        console.log('Tabla detalle_medicion ya tiene el nuevo esquema');
                        // Verificar si existe la tabla lecturas_detalladas
                        this.db.all("PRAGMA table_info(lecturas_detalladas)", (err, columns) => {
                            if (err || !columns || columns.length === 0) {
                                // La tabla no existe, crearla
                                this.db.run(createLecturasDetalladasTable, (err) => {
                                    if (err) {
                                        console.error('Error creando tabla lecturas_detalladas:', err.message);
                                        reject(err);
                                    } else {
                                        console.log('Tabla lecturas_detalladas creada exitosamente');
                                        this.createIndexes().then(resolve).catch(reject);
                                    }
                                });
                            } else {
                                console.log('Tabla lecturas_detalladas ya existe');
                                this.createIndexes().then(resolve).catch(reject);
                            }
                        });
                    }
                });
            }
        });
    }

    createDetalleMedicionTable(createDetalleMedicionTable, createLecturasDetalladasTable, resolve, reject) {
        this.db.run(createDetalleMedicionTable, (err) => {
            if (err) {
                console.error('Error creando tabla detalle_medicion:', err.message);
                reject(err);
                return;
            }

            console.log('Tabla detalle_medicion creada exitosamente');

            // Crear tabla de lecturas detalladas
            this.db.run(createLecturasDetalladasTable, (err) => {
                if (err) {
                    console.error('Error creando tabla lecturas_detalladas:', err.message);
                    reject(err);
                    return;
                }

                console.log('Tabla lecturas_detalladas creada exitosamente');

                // Crear índices para mejorar el rendimiento
                this.createIndexes().then(resolve).catch(reject);
            });
        });
    }

    // Migrar tabla detalle_medicion al nuevo esquema
    async migrateDetalleMedicionTable() {
        return new Promise((resolve, reject) => {
            // Crear tabla temporal con nuevo esquema
            const createTempTable = `
                CREATE TABLE detalle_medicion_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    medicion_id INTEGER NOT NULL,
                    o2 REAL NULL,
                    co REAL NULL,
                    ch4 REAL NULL,
                    unidad_o2 TEXT DEFAULT '%Vol',
                    unidad_co TEXT DEFAULT 'ppm',
                    unidad_ch4 TEXT DEFAULT 'ppm',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (medicion_id) REFERENCES medicion (id) ON DELETE CASCADE
                )
            `;

            // Crear la tabla temporal
            this.db.run(createTempTable, (err) => {
                if (err) {
                    console.error('Error creando tabla temporal:', err.message);
                    reject(err);
                    return;
                }

                console.log('Tabla temporal creada exitosamente');

                // Migrar datos existentes
                const migrateDataQuery = `
                    INSERT INTO detalle_medicion_new (medicion_id, o2, co, ch4, unidad_o2, unidad_co, unidad_ch4, created_at)
                    SELECT 
                        medicion_id,
                        MAX(CASE WHEN gas_tipo = 'O2' THEN valor END) as o2,
                        MAX(CASE WHEN gas_tipo = 'CO' THEN valor END) as co,
                        MAX(CASE WHEN gas_tipo = 'CH4' THEN valor END) as ch4,
                        MAX(CASE WHEN gas_tipo = 'O2' THEN unidad END) as unidad_o2,
                        MAX(CASE WHEN gas_tipo = 'CO' THEN unidad END) as unidad_co,
                        MAX(CASE WHEN gas_tipo = 'CH4' THEN unidad END) as unidad_ch4,
                        MAX(created_at) as created_at
                    FROM detalle_medicion
                    GROUP BY medicion_id
                `;

                this.db.run(migrateDataQuery, (err) => {
                    if (err) {
                        console.error('Error migrando datos:', err.message);
                        reject(err);
                        return;
                    }

                    console.log('Datos migrados exitosamente');

                    // Eliminar tabla antigua
                    this.db.run('DROP TABLE detalle_medicion', (err) => {
                        if (err) {
                            console.error('Error eliminando tabla antigua:', err.message);
                            reject(err);
                            return;
                        }

                        // Renombrar tabla temporal
                        this.db.run('ALTER TABLE detalle_medicion_new RENAME TO detalle_medicion', (err) => {
                            if (err) {
                                console.error('Error renombrando tabla:', err.message);
                                reject(err);
                                return;
                            }

                            console.log('Migración completada exitosamente');
                            resolve();
                        });
                    });
                });
            });
        });
    }

    // Crear índices para mejorar el rendimiento
    async createIndexes() {
        return new Promise((resolve, reject) => {
            const indexes = [
                'CREATE INDEX IF NOT EXISTS idx_medicion_fecha ON medicion(fecha)',
                'CREATE INDEX IF NOT EXISTS idx_medicion_evento ON medicion(evento)',
                'CREATE INDEX IF NOT EXISTS idx_medicion_created_at ON medicion(created_at)',
                'CREATE INDEX IF NOT EXISTS idx_detalle_medicion_id ON detalle_medicion(medicion_id)',
                'CREATE INDEX IF NOT EXISTS idx_lecturas_medicion_id ON lecturas_detalladas(medicion_id)',
                'CREATE INDEX IF NOT EXISTS idx_lecturas_tiempo ON lecturas_detalladas(tiempo_relativo)',
                'CREATE INDEX IF NOT EXISTS idx_lecturas_created_at ON lecturas_detalladas(created_at)'
            ];

            let completed = 0;
            indexes.forEach((indexQuery, index) => {
                this.db.run(indexQuery, (err) => {
                    if (err) {
                        console.error('Error creando índice:', err.message);
                        reject(err);
                        return;
                    }
                    completed++;
                    if (completed === indexes.length) {
                        console.log('Índices creados exitosamente');
                        resolve();
                    }
                });
            });
        });
    }

    // Guardar una medición de gases (nueva estructura normalizada)
    async saveGasReading(data, eventType = 'Normal', observaciones = null, tiempoInicio = null, tiempoFin = null) {
        if (!this.isConnected) {
            throw new Error('Base de datos no conectada');
        }

        const now = new Date();
        // Usar zona horaria local en lugar de UTC
        const fecha = now.toLocaleDateString('en-CA'); // Formato YYYY-MM-DD
        const hora = now.toLocaleTimeString('en-GB', { hour12: false }); // Formato HH:MM:SS

        return new Promise((resolve, reject) => {
            // Guardar referencia a la base de datos
            const db = this.db;
            
            // Verificar que la base de datos esté conectada
            if (!db) {
                reject(new Error('Base de datos no está conectada'));
                return;
            }

            // Primero insertar en tabla medicion
            const insertMedicionQuery = `
                INSERT INTO medicion (fecha, hora, evento, observaciones, tiempo_inicio, tiempo_fin)
                VALUES (?, ?, ?, ?, ?, ?)
            `;

            db.run(insertMedicionQuery, [
                fecha,
                hora,
                eventType,
                observaciones,
                tiempoInicio,
                tiempoFin
            ], function(err) {
                if (err) {
                    console.error('Error guardando medición:', err.message);
                    reject(err);
                    return;
                }

                const medicionId = this.lastID;
                console.log(`Medición guardada con ID: ${medicionId}`);

                // Insertar en tabla detalle_medicion
                const insertDetalleQuery = `
                    INSERT INTO detalle_medicion (medicion_id, o2, co, ch4, unidad_o2, unidad_co, unidad_ch4)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `;

                db.run(insertDetalleQuery, [
                    medicionId,
                    data.o2 !== undefined && data.o2 !== null ? data.o2 : null,
                    data.co !== undefined && data.co !== null ? data.co : null,
                    data.ch4 !== undefined && data.ch4 !== null ? data.ch4 : null,
                    '%Vol',
                    'ppm',
                    'ppm'
                ], function(err) {
                    if (err) {
                        console.error('Error guardando detalle de medición:', err.message);
                        reject(err);
                        return;
                    }

                    resolve({
                        success: true,
                        medicion_id: medicionId,
                        fecha: fecha,
                        hora: hora
                    });
                });
            });
        });
    }

    // Obtener todas las mediciones
    async getAllReadings(limit = null, offset = 0) {
        if (!this.isConnected) {
            throw new Error('Base de datos no conectada');
        }

        return new Promise((resolve, reject) => {
            let query = `
                SELECT 
                    m.id as medicion_id,
                    m.fecha,
                    m.hora,
                    m.evento,
                    m.observaciones,
                    m.tiempo_inicio,
                    m.tiempo_fin,
                    m.created_at,
                    d.o2,
                    d.co,
                    d.ch4,
                    d.unidad_o2,
                    d.unidad_co,
                    d.unidad_ch4
                FROM medicion m
                LEFT JOIN detalle_medicion d ON m.id = d.medicion_id
                ORDER BY m.created_at DESC
            `;

            if (limit) {
                query += ` LIMIT ${limit} OFFSET ${offset}`;
            }

            this.db.all(query, (err, rows) => {
                if (err) {
                    console.error('Error obteniendo mediciones:', err.message);
                    reject(err);
                } else {
                    // Procesar los datos para que tengan la estructura esperada
                    const processedData = rows.map(row => ({
                        medicion_id: row.medicion_id,
                        fecha: row.fecha,
                        hora: row.hora,
                        evento: row.evento,
                        observaciones: row.observaciones,
                        tiempo_inicio: row.tiempo_inicio,
                        tiempo_fin: row.tiempo_fin,
                        created_at: row.created_at,
                        detalles: {
                            o2: row.o2 ? { valor: row.o2, unidad: row.unidad_o2 } : null,
                            co: row.co ? { valor: row.co, unidad: row.unidad_co } : null,
                            ch4: row.ch4 ? { valor: row.ch4, unidad: row.unidad_ch4 } : null
                        }
                    }));

                    resolve(processedData);
                }
            });
        });
    }

    // Obtener mediciones por rango de fechas
    async getReadingsByDateRange(startDate, endDate) {
        if (!this.isConnected) {
            throw new Error('Base de datos no conectada');
        }

        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    m.id as medicion_id,
                    m.fecha,
                    m.hora,
                    m.evento,
                    m.observaciones,
                    m.tiempo_inicio,
                    m.tiempo_fin,
                    m.created_at,
                    d.o2,
                    d.co,
                    d.ch4,
                    d.unidad_o2,
                    d.unidad_co,
                    d.unidad_ch4
                FROM medicion m
                LEFT JOIN detalle_medicion d ON m.id = d.medicion_id
                WHERE m.fecha BETWEEN ? AND ?
                ORDER BY m.created_at DESC
            `;

            this.db.all(query, [startDate, endDate], (err, rows) => {
                if (err) {
                    console.error('Error obteniendo mediciones por fecha:', err.message);
                    reject(err);
                } else {
                    const processedData = rows.map(row => ({
                        medicion_id: row.medicion_id,
                        fecha: row.fecha,
                        hora: row.hora,
                        evento: row.evento,
                        observaciones: row.observaciones,
                        tiempo_inicio: row.tiempo_inicio,
                        tiempo_fin: row.tiempo_fin,
                        created_at: row.created_at,
                        detalles: {
                            o2: row.o2 ? { valor: row.o2, unidad: row.unidad_o2 } : null,
                            co: row.co ? { valor: row.co, unidad: row.unidad_co } : null,
                            ch4: row.ch4 ? { valor: row.ch4, unidad: row.unidad_ch4 } : null
                        }
                    }));

                    resolve(processedData);
                }
            });
        });
    }

    // Obtener mediciones por evento
    async getReadingsByEvent(eventType) {
        if (!this.isConnected) {
            throw new Error('Base de datos no conectada');
        }

        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    m.id as medicion_id,
                    m.fecha,
                    m.hora,
                    m.evento,
                    m.observaciones,
                    m.tiempo_inicio,
                    m.tiempo_fin,
                    m.created_at,
                    d.o2,
                    d.co,
                    d.ch4,
                    d.unidad_o2,
                    d.unidad_co,
                    d.unidad_ch4
                FROM medicion m
                LEFT JOIN detalle_medicion d ON m.id = d.medicion_id
                WHERE m.evento = ?
                ORDER BY m.created_at DESC
            `;

            this.db.all(query, [eventType], (err, rows) => {
                if (err) {
                    console.error('Error obteniendo mediciones por evento:', err.message);
                    reject(err);
                } else {
                    const processedData = rows.map(row => ({
                        medicion_id: row.medicion_id,
                        fecha: row.fecha,
                        hora: row.hora,
                        evento: row.evento,
                        observaciones: row.observaciones,
                        tiempo_inicio: row.tiempo_inicio,
                        tiempo_fin: row.tiempo_fin,
                        created_at: row.created_at,
                        detalles: {
                            o2: row.o2 ? { valor: row.o2, unidad: row.unidad_o2 } : null,
                            co: row.co ? { valor: row.co, unidad: row.unidad_co } : null,
                            ch4: row.ch4 ? { valor: row.ch4, unidad: row.unidad_ch4 } : null
                        }
                    }));

                    resolve(processedData);
                }
            });
        });
    }

    // Obtener estadísticas de gases
    async getGasStatistics(startDate = null, endDate = null) {
        if (!this.isConnected) {
            throw new Error('Base de datos no conectada');
        }

        return new Promise((resolve, reject) => {
            let query = `
                SELECT 
                    COUNT(*) as total_mediciones,
                    AVG(d.o2) as avg_o2,
                    MIN(d.o2) as min_o2,
                    MAX(d.o2) as max_o2,
                    AVG(d.co) as avg_co,
                    MIN(d.co) as min_co,
                    MAX(d.co) as max_co,
                    AVG(d.ch4) as avg_ch4,
                    MIN(d.ch4) as min_ch4,
                    MAX(d.ch4) as max_ch4
                FROM medicion m
                LEFT JOIN detalle_medicion d ON m.id = d.medicion_id
                WHERE d.o2 IS NOT NULL OR d.co IS NOT NULL OR d.ch4 IS NOT NULL
            `;

            const params = [];
            if (startDate && endDate) {
                query += ` AND m.fecha BETWEEN ? AND ?`;
                params.push(startDate, endDate);
            }

            this.db.get(query, params, (err, row) => {
                if (err) {
                    console.error('Error obteniendo estadísticas:', err.message);
                    reject(err);
                } else {
                    resolve({
                        total_mediciones: row.total_mediciones || 0,
                        o2: {
                            promedio: row.avg_o2 ? parseFloat(row.avg_o2.toFixed(2)) : null,
                            minimo: row.min_o2 ? parseFloat(row.min_o2.toFixed(2)) : null,
                            maximo: row.max_o2 ? parseFloat(row.max_o2.toFixed(2)) : null
                        },
                        co: {
                            promedio: row.avg_co ? parseFloat(row.avg_co.toFixed(2)) : null,
                            minimo: row.min_co ? parseFloat(row.min_co.toFixed(2)) : null,
                            maximo: row.max_co ? parseFloat(row.max_co.toFixed(2)) : null
                        },
                        ch4: {
                            promedio: row.avg_ch4 ? parseFloat(row.avg_ch4.toFixed(2)) : null,
                            minimo: row.min_ch4 ? parseFloat(row.min_ch4.toFixed(2)) : null,
                            maximo: row.max_ch4 ? parseFloat(row.max_ch4.toFixed(2)) : null
                        }
                    });
                }
            });
        });
    }

    // Exportar datos a CSV
    async exportToCSV(startDate, endDate) {
        if (!this.isConnected) {
            throw new Error('Base de datos no conectada');
        }

        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    m.id as medicion_id,
                    m.fecha,
                    m.hora,
                    m.evento,
                    m.observaciones,
                    m.tiempo_inicio,
                    m.tiempo_fin,
                    d.o2,
                    d.co,
                    d.ch4,
                    d.unidad_o2,
                    d.unidad_co,
                    d.unidad_ch4
                FROM medicion m
                LEFT JOIN detalle_medicion d ON m.id = d.medicion_id
                WHERE m.fecha BETWEEN ? AND ?
                ORDER BY m.created_at DESC
            `;

            this.db.all(query, [startDate, endDate], (err, rows) => {
                if (err) {
                    console.error('Error exportando datos:', err.message);
                    reject(err);
                } else {
                    // Crear CSV
                    let csv = 'ID_Medicion,Fecha,Hora,Evento,Observaciones,Tiempo_Inicio,Tiempo_Fin,O2_Valor,O2_Unidad,CO_Valor,CO_Unidad,CH4_Valor,CH4_Unidad\n';
                    
                    rows.forEach(row => {
                        csv += `${row.medicion_id},${row.fecha},${row.hora},${row.evento},"${row.observaciones || ''}",${row.tiempo_inicio || ''},${row.tiempo_fin || ''},${row.o2 || ''},${row.unidad_o2 || ''},${row.co || ''},${row.unidad_co || ''},${row.ch4 || ''},${row.unidad_ch4 || ''}\n`;
                    });

                    resolve(csv);
                }
            });
        });
    }

    // Guardar lectura detallada individual
    async saveDetailedReading(medicionId, data, tiempoRelativo, evento = 'Normal') {
        if (!this.isConnected) {
            throw new Error('Base de datos no conectada');
        }

        return new Promise((resolve, reject) => {
            const db = this.db;
            
            if (!db) {
                reject(new Error('Base de datos no está conectada'));
                return;
            }

            const query = `
                INSERT INTO lecturas_detalladas (medicion_id, o2, co, ch4, tiempo_relativo, evento)
                VALUES (?, ?, ?, ?, ?, ?)
            `;

            const params = [
                medicionId,
                data.o2 !== undefined && data.o2 !== null ? data.o2 : null,
                data.co !== undefined && data.co !== null ? data.co : null,
                data.ch4 !== undefined && data.ch4 !== null ? data.ch4 : null,
                tiempoRelativo,
                evento
            ];

            db.run(query, params, function(err) {
                if (err) {
                    console.error('Error guardando lectura detallada:', err.message);
                    reject(err);
                } else {
                    resolve({
                        success: true,
                        lectura_id: this.lastID,
                        medicion_id: medicionId,
                        tiempo_relativo: tiempoRelativo
                    });
                }
            });
        });
    }

    // Obtener todas las lecturas detalladas de una medición
    async getDetailedReadings(medicionId) {
        if (!this.isConnected) {
            throw new Error('Base de datos no conectada');
        }

        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    id,
                    o2,
                    co,
                    ch4,
                    tiempo_relativo,
                    evento,
                    created_at
                FROM lecturas_detalladas
                WHERE medicion_id = ?
                ORDER BY tiempo_relativo ASC
            `;

            this.db.all(query, [medicionId], (err, rows) => {
                if (err) {
                    console.error('Error obteniendo lecturas detalladas:', err.message);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async updateMedicionTiempoFin(medicionId, tiempoFin) {
        if (!this.isConnected) {
            throw new Error('Base de datos no conectada');
        }

        return new Promise((resolve, reject) => {
            const db = this.db;
            
            if (!db) {
                reject(new Error('Base de datos no está conectada'));
                return;
            }

            const query = `
                UPDATE medicion 
                SET tiempo_fin = ?
                WHERE id = ?
            `;

            db.run(query, [tiempoFin, medicionId], function(err) {
                if (err) {
                    console.error('Error actualizando tiempo de fin:', err.message);
                    reject(err);
                } else {
                    console.log(`Tiempo de fin actualizado para medición ${medicionId}`);
                    resolve({
                        success: true,
                        medicionId: medicionId,
                        rowsAffected: this.changes
                    });
                }
            });
        });
    }

    async deleteMedicion(medicionId) {
        if (!this.isConnected) {
            throw new Error('Base de datos no conectada');
        }

        return new Promise((resolve, reject) => {
            const db = this.db;
            
            if (!db) {
                reject(new Error('Base de datos no está conectada'));
                return;
            }

            // Usar transacción para eliminar medición y sus detalles relacionados
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                
                // Eliminar lecturas detalladas primero (por foreign key constraint)
                db.run('DELETE FROM lecturas_detalladas WHERE medicion_id = ?', [medicionId], (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        console.error('Error eliminando lecturas detalladas:', err.message);
                        reject(err);
                        return;
                    }
                    
                    // Eliminar detalle de medición
                    db.run('DELETE FROM detalle_medicion WHERE medicion_id = ?', [medicionId], (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            console.error('Error eliminando detalle de medición:', err.message);
                            reject(err);
                            return;
                        }
                        
                        // Eliminar medición principal
                        db.run('DELETE FROM medicion WHERE id = ?', [medicionId], function(err) {
                            if (err) {
                                db.run('ROLLBACK');
                                console.error('Error eliminando medición:', err.message);
                                reject(err);
                                return;
                            }
                            
                            db.run('COMMIT', (err) => {
                                if (err) {
                                    console.error('Error confirmando transacción:', err.message);
                                    reject(err);
                                } else {
                                    console.log(`Medición ${medicionId} eliminada exitosamente`);
                                    resolve({
                                        success: true,
                                        medicionId: medicionId,
                                        rowsAffected: 1
                                    });
                                }
                            });
                        });
                    });
                });
            });
        });
    }

    async migrateLecturasDetalladasIfNeeded() {
        return new Promise((resolve, reject) => {
            this.db.all("PRAGMA table_info(lecturas_detalladas)", (err, columns) => {
                if (err) {
                    console.error('Error verificando columnas de lecturas_detalladas:', err.message);
                    reject(err);
                    return;
                }
                
                const hasEvento = columns.some(col => col.name === 'evento');
                if (!hasEvento) {
                    console.log('Migrando tabla lecturas_detalladas para agregar campo evento...');
                    this.db.run('ALTER TABLE lecturas_detalladas ADD COLUMN evento TEXT DEFAULT "Normal"', (err) => {
                        if (err) {
                            console.error('Error ejecutando migración de lecturas_detalladas:', err.message);
                            reject(err);
                        } else {
                            console.log('Tabla lecturas_detalladas migrada exitosamente');
                            resolve();
                        }
                    });
                } else {
                    console.log('Tabla lecturas_detalladas ya tiene campo evento');
                    resolve();
                }
            });
        });
    }
}

module.exports = DatabaseManager;