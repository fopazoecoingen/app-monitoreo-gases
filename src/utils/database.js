// Utilidades para manejo de base de datos SQLite - Versión simplificada
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
                        console.log('Base de datos desconectada');
                    }
                    this.isConnected = false;
                    resolve();
                });
            } else {
                this.isConnected = false;
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
                    enviado_plataforma INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;

            // Crear tabla para guardar todas las lecturas individuales durante una sesión
            const createLecturasDetalladasTable = `
                CREATE TABLE IF NOT EXISTS lecturas_detalladas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    medicion_id INTEGER NOT NULL,
                    o2 REAL NULL,
                    co REAL NULL,
                    ch4 REAL NULL,
                    co2 REAL NULL,
                    tiempo_relativo TEXT NOT NULL,
                    evento TEXT DEFAULT 'Normal',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (medicion_id) REFERENCES medicion (id) ON DELETE CASCADE
                )
            `;

            console.log('🔍 Ejecutando CREATE TABLE medicion...');
            this.db.run(createMedicionTable, (err) => {
                if (err) {
                    console.error('❌ Error creando tabla medicion:', err.message);
                    console.error('❌ Error completo:', err);
                    reject(err);
                    return;
                }

                console.log('✅ Tabla medicion creada/verificada exitosamente');

                // Verificar si la tabla medicion necesita migración para agregar campos de tiempo
                this.migrateMedicionTableIfNeeded().then(() => {
                    // Verificar si necesita agregar columna enviado_plataforma
                    this.addEnviadoPlataformaFieldIfNeeded().then(() => {
                        // Crear tabla de lecturas detalladas directamente
                    console.log('🔍 Ejecutando CREATE TABLE lecturas_detalladas...');
                    this.db.run(createLecturasDetalladasTable, (err) => {
                        if (err) {
                            console.error('❌ Error creando tabla lecturas_detalladas:', err.message);
                            console.error('❌ Error completo:', err);
                            reject(err);
                            return;
                        }

                        console.log('✅ Tabla lecturas_detalladas creada exitosamente');

                        // Verificar y agregar campo CO2 si no existe
                        this.addCo2FieldIfNeeded()
                            .then(() => {
                                // Crear índices para mejorar rendimiento
                                this.createIndexes()
                                    .then(() => {
                                        console.log('Base de datos inicializada correctamente');
                                        resolve();
                                    })
                                    .catch(reject);
                            })
                            .catch(reject);
                        });
                    });
                }).catch(reject);
            });
        });
    }

    async migrateMedicionTableIfNeeded() {
        return new Promise((resolve, reject) => {
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

    async addEnviadoPlataformaFieldIfNeeded() {
        return new Promise((resolve, reject) => {
            this.db.all("PRAGMA table_info(medicion)", (err, columns) => {
                if (err) {
                    console.error('Error verificando columnas de medicion para enviado_plataforma:', err.message);
                    reject(err);
                    return;
                }
                
                const hasEnviadoPlataforma = columns.some(col => col.name === 'enviado_plataforma');
                if (!hasEnviadoPlataforma) {
                    console.log('Migrando tabla medicion para agregar campo enviado_plataforma...');
                    this.db.run('ALTER TABLE medicion ADD COLUMN enviado_plataforma INTEGER DEFAULT 0', (err) => {
                        if (err) {
                            console.error('Error ejecutando migración enviado_plataforma:', err.message);
                            reject(err);
                        } else {
                            console.log('Campo enviado_plataforma agregado exitosamente a medicion');
                            resolve();
                        }
                    });
                } else {
                    console.log('Tabla medicion ya tiene campo enviado_plataforma');
                    resolve();
                }
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
                            // Actualizar registros existentes que tengan NULL
                            this.db.run('UPDATE lecturas_detalladas SET evento = "Normal" WHERE evento IS NULL', (err) => {
                                if (err) {
                                    console.error('Error actualizando registros existentes:', err.message);
                                } else {
                                    console.log('Registros existentes actualizados con evento Normal');
                                }
                                resolve();
                            });
                        }
                    });
                } else {
                    console.log('Tabla lecturas_detalladas ya tiene campo evento');
                    // Verificar si hay registros con evento NULL y actualizarlos
                    this.db.run('UPDATE lecturas_detalladas SET evento = "Normal" WHERE evento IS NULL', (err) => {
                        if (err) {
                            console.error('Error actualizando registros con evento NULL:', err.message);
                        } else {
                            console.log('Registros con evento NULL actualizados');
                        }
                        resolve();
                    });
                }
            });
        });
    }

    async addCo2FieldIfNeeded() {
        return new Promise((resolve, reject) => {
            this.db.all("PRAGMA table_info(lecturas_detalladas)", (err, columns) => {
                if (err) {
                    console.error('Error verificando columnas de lecturas_detalladas para CO2:', err.message);
                    reject(err);
                    return;
                }
                
                const hasCo2 = columns.some(col => col.name === 'co2');
                if (!hasCo2) {
                    console.log('Migrando tabla lecturas_detalladas para agregar campo CO2...');
                    this.db.run('ALTER TABLE lecturas_detalladas ADD COLUMN co2 REAL NULL', (err) => {
                        if (err) {
                            console.error('Error ejecutando migración CO2:', err.message);
                            reject(err);
                        } else {
                            console.log('Campo CO2 agregado exitosamente a lecturas_detalladas');
                            resolve();
                        }
                    });
                } else {
                    console.log('Tabla lecturas_detalladas ya tiene campo CO2');
                    resolve();
                }
            });
        });
    }

    async createIndexes() {
        return new Promise((resolve, reject) => {
            const indexes = [
                'CREATE INDEX IF NOT EXISTS idx_medicion_fecha ON medicion(fecha)',
                'CREATE INDEX IF NOT EXISTS idx_medicion_evento ON medicion(evento)',
                'CREATE INDEX IF NOT EXISTS idx_lecturas_medicion_id ON lecturas_detalladas(medicion_id)',
                'CREATE INDEX IF NOT EXISTS idx_lecturas_tiempo ON lecturas_detalladas(tiempo_relativo)',
                'CREATE INDEX IF NOT EXISTS idx_lecturas_evento ON lecturas_detalladas(evento)'
            ];

            let completed = 0;
            indexes.forEach((indexQuery, i) => {
                this.db.run(indexQuery, (err) => {
                    if (err) {
                        console.error(`Error creando índice ${i + 1}:`, err.message);
                        reject(err);
                        return;
                    }
                    completed++;
                    if (completed === indexes.length) {
                        console.log('Índices creados correctamente');
                        resolve();
                    }
                });
            });
        });
    }

    // Guardar nueva medición
    async saveGasReading(data, eventType = 'Normal', observaciones = null, tiempoInicio = null, tiempoFin = null) {
        if (!this.isConnected) {
            throw new Error('Base de datos no conectada');
        }

        const now = new Date();
        // Usar zona horaria local correcta
        const fecha = now.toLocaleDateString('es-CL'); // Formato DD/MM/YYYY para Chile
        const hora = now.toLocaleTimeString('es-CL', { 
            hour12: false, 
            timeZone: 'America/Santiago' 
        }); // Formato HH:MM:SS en zona horaria de Chile

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
                INSERT INTO medicion (fecha, hora, evento, observaciones, tiempo_inicio, tiempo_fin, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            // Usar la misma fecha/hora para created_at
            const created_at = `${fecha} ${hora}`;

            db.run(insertMedicionQuery, [fecha, hora, eventType, observaciones, tiempoInicio, tiempoFin, created_at], function(err) {
                if (err) {
                    console.error('Error guardando medición:', err.message);
                    reject(err);
                } else {
                    const medicionId = this.lastID;
                    console.log(`Medición guardada con ID: ${medicionId}`);

                    resolve({
                        success: true,
                        medicion_id: medicionId,
                        fecha: fecha,
                        hora: hora
                    });
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
                INSERT INTO lecturas_detalladas (medicion_id, o2, co, ch4, co2, tiempo_relativo, evento, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            // Usar la misma fecha/hora que la medición principal
            const now = new Date();
            const fecha = now.toLocaleDateString('es-CL');
            const hora = now.toLocaleTimeString('es-CL', { 
                hour12: false, 
                timeZone: 'America/Santiago' 
            });
            const created_at = `${fecha} ${hora}`;

            const params = [
                medicionId,
                data.o2 !== undefined && data.o2 !== null ? data.o2 : null,
                data.co !== undefined && data.co !== null ? data.co : null,
                data.ch4 !== undefined && data.ch4 !== null ? data.ch4 : null,
                data.co2 !== undefined && data.co2 !== null ? data.co2 : null,
                tiempoRelativo,
                evento,
                created_at
            ];

            db.run(query, params, function(err) {
                if (err) {
                    console.error('Error guardando lectura detallada:', err.message);
                    reject(err);
                } else {
                    resolve({
                        success: true,
                        lectura_id: this.lastID
                    });
                }
            });
        });
    }

    // Obtener todas las mediciones
    async getAllReadings() {
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
                    m.enviado_plataforma,
                    m.created_at,
                    COUNT(l.id) as total_lecturas
                FROM medicion m
                LEFT JOIN lecturas_detalladas l ON m.id = l.medicion_id
                GROUP BY m.id
                ORDER BY m.created_at DESC
            `;

            this.db.all(query, (err, rows) => {
                if (err) {
                    console.error('Error obteniendo mediciones:', err.message);
                    reject(err);
                } else {
                    console.log(`📊 Obtenidas ${rows.length} mediciones de la base de datos`);
                    resolve({
                        success: true,
                        data: rows
                    });
                }
            });
        });
    }

    // Obtener lecturas detalladas de una medición
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
                    co2,
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
                    console.log(`📊 Obtenidas ${rows.length} lecturas detalladas para medición ${medicionId}`);
                    resolve({
                        success: true,
                        data: rows
                    });
                }
            });
        });
    }

    // Obtener mediciones por rango de fechas
    async getReadingsByDateRange(startDate = null, endDate = null) {
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
                    m.enviado_plataforma,
                    m.created_at,
                    COUNT(l.id) as total_lecturas
                FROM medicion m
                LEFT JOIN lecturas_detalladas l ON m.id = l.medicion_id
            `;
            
            const params = [];
            const conditions = [];

            if (startDate) {
                conditions.push('m.fecha >= ?');
                params.push(startDate);
            }

            if (endDate) {
                conditions.push('m.fecha <= ?');
                params.push(endDate);
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            query += ' GROUP BY m.id ORDER BY m.fecha DESC, m.hora DESC';

            this.db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('Error obteniendo mediciones por rango de fechas:', err.message);
                    reject(err);
                } else {
                    console.log(`📊 Obtenidas ${rows.length} mediciones por rango de fechas`);
                    resolve({
                        success: true,
                        data: rows
                    });
                }
            });
        });
    }

    // Eliminar medición
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

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                db.run('DELETE FROM lecturas_detalladas WHERE medicion_id = ?', [medicionId], (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        console.error('Error eliminando lecturas detalladas:', err.message);
                        reject(err);
                        return;
                    }
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
    }

    // Actualizar tiempo de fin de medición
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

    // Exportar datos a CSV
    async exportToCSV(startDate = null, endDate = null) {
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
                    COUNT(l.id) as total_lecturas
                FROM medicion m
                LEFT JOIN lecturas_detalladas l ON m.id = l.medicion_id
            `;
            
            const params = [];
            if (startDate && endDate) {
                query += ' WHERE m.fecha BETWEEN ? AND ?';
                params.push(startDate, endDate);
            }
            
            query += ' GROUP BY m.id ORDER BY m.created_at DESC';

            this.db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('Error exportando datos:', err.message);
                    reject(err);
                } else {
                    // Crear CSV
                    const headers = ['ID', 'Fecha', 'Hora', 'Evento', 'Observaciones', 'Tiempo_Inicio', 'Tiempo_Fin', 'Total_Lecturas'];
                    const csvContent = [
                        headers.join(','),
                        ...rows.map(row => [
                            row.medicion_id,
                            `"${row.fecha}"`,
                            `"${row.hora}"`,
                            `"${row.evento}"`,
                            `"${row.observaciones || ''}"`,
                            `"${row.tiempo_inicio || ''}"`,
                            `"${row.tiempo_fin || ''}"`,
                            row.total_lecturas
                        ].join(','))
                    ].join('\n');

                    resolve({
                        success: true,
                        data: '\uFEFF' + csvContent // BOM para UTF-8
                    });
                }
            });
        });
    }

    /**
     * Marca una medición como enviada a la plataforma
     * @param {number} medicionId - ID de la medición
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    markMedicionAsSentToPlatform(medicionId) {
        return new Promise((resolve) => {
            if (!this.db) {
                resolve({ success: false, error: 'Base de datos no conectada' });
                return;
            }

            const query = 'UPDATE medicion SET enviado_plataforma = 1 WHERE id = ?';
            
            this.db.run(query, [medicionId], (err) => {
                if (err) {
                    console.error('Error marcando medición como enviada:', err.message);
                    resolve({ success: false, error: err.message });
                } else {
                    console.log(`✅ Medición ${medicionId} marcada como enviada a la plataforma`);
                    resolve({ success: true });
                }
            });
        });
    }

    /**
     * Marca múltiples mediciones como enviadas a la plataforma
     * @param {Array<number>} medicionIds - Array de IDs de mediciones
     * @returns {Promise<{success: boolean, updated: number, error?: string}>}
     */
    markMultipleMedicionesAsSentToPlatform(medicionIds) {
        return new Promise((resolve) => {
            if (!this.db) {
                resolve({ success: false, updated: 0, error: 'Base de datos no conectada' });
                return;
            }

            if (!medicionIds || medicionIds.length === 0) {
                resolve({ success: false, updated: 0, error: 'No hay mediciones para marcar' });
                return;
            }

            const placeholders = medicionIds.map(() => '?').join(',');
            const query = `UPDATE medicion SET enviado_plataforma = 1 WHERE id IN (${placeholders})`;
            
            this.db.run(query, medicionIds, function(err) {
                if (err) {
                    console.error('Error marcando mediciones como enviadas:', err.message);
                    resolve({ success: false, updated: 0, error: err.message });
                } else {
                    console.log(`✅ ${this.changes} mediciones marcadas como enviadas a la plataforma`);
                    resolve({ success: true, updated: this.changes });
                }
            });
        });
    }

    /**
     * Obtiene el estado de envío de una medición
     * @param {number} medicionId - ID de la medición
     * @returns {Promise<{success: boolean, sent: boolean, error?: string}>}
     */
    getMedicionSentStatus(medicionId) {
        return new Promise((resolve) => {
            if (!this.db) {
                resolve({ success: false, sent: false, error: 'Base de datos no conectada' });
                return;
            }

            const query = 'SELECT enviado_plataforma FROM medicion WHERE id = ?';
            
            this.db.get(query, [medicionId], (err, row) => {
                if (err) {
                    console.error('Error obteniendo estado de envío:', err.message);
                    resolve({ success: false, sent: false, error: err.message });
                } else if (!row) {
                    resolve({ success: false, sent: false, error: 'Medición no encontrada' });
                } else {
                    resolve({ success: true, sent: Boolean(row.enviado_plataforma) });
                }
            });
        });
    }
}

module.exports = DatabaseManager;
