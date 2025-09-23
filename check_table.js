// Script para verificar la estructura de la tabla lecturas_detalladas
const DatabaseManager = require('./src/utils/database');

async function checkTable() {
    const db = new DatabaseManager();
    
    try {
        await db.connect();
        
        console.log('Conectado a la base de datos');
        
        // Verificar estructura de la tabla
        const checkQuery = 'PRAGMA table_info(lecturas_detalladas)';
        
        db.db.all(checkQuery, (err, columns) => {
            if (err) {
                console.error('Error verificando estructura de tabla:', err);
                return;
            }
            
            console.log('\n📊 Estructura actual de la tabla lecturas_detalladas:');
            console.log('----------------------------------------');
            columns.forEach(col => {
                console.log(`${col.name} - ${col.type} - ${col.notnull ? 'NOT NULL' : 'NULL'} - Default: ${col.dflt_value || 'none'}`);
            });
            
            const hasEvento = columns.some(col => col.name === 'evento');
            console.log(`\n¿Tiene campo 'evento'? ${hasEvento ? '✅ SÍ' : '❌ NO'}`);
            
            if (!hasEvento) {
                console.log('\n🔧 Agregando campo evento...');
                
                // Agregar el campo evento
                db.db.run('ALTER TABLE lecturas_detalladas ADD COLUMN evento TEXT DEFAULT "Normal"', (err) => {
                    if (err) {
                        console.error('Error agregando campo evento:', err);
                    } else {
                        console.log('✅ Campo evento agregado exitosamente');
                        
                        // Actualizar registros existentes
                        db.db.run('UPDATE lecturas_detalladas SET evento = "Normal"', (err) => {
                            if (err) {
                                console.error('Error actualizando registros existentes:', err);
                            } else {
                                console.log('✅ Registros existentes actualizados con evento "Normal"');
                                
                                // Mostrar algunos ejemplos
                                db.db.all('SELECT id, medicion_id, evento, o2, co, ch4 FROM lecturas_detalladas ORDER BY id DESC LIMIT 3', (err, rows) => {
                                    if (err) {
                                        console.error('Error obteniendo ejemplos:', err);
                                    } else {
                                        console.log('\n📋 Ejemplos de registros con evento:');
                                        rows.forEach(row => {
                                            console.log(`ID: ${row.id}, Medición: ${row.medicion_id}, Evento: ${row.evento}, O2: ${row.o2}, CO: ${row.co}, CH4: ${row.ch4}`);
                                        });
                                    }
                                    
                                    db.disconnect();
                                });
                            }
                        });
                    }
                });
            } else {
                console.log('✅ El campo evento ya existe');
                db.disconnect();
            }
        });
        
    } catch (error) {
        console.error('Error:', error);
    }
}

checkTable();
