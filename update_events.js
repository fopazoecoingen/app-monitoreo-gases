// Script para actualizar eventos en registros existentes
const DatabaseManager = require('./src/utils/database');

async function updateEvents() {
    const db = new DatabaseManager();
    
    try {
        await db.connect();
        
        console.log('Conectado a la base de datos');
        
        // Verificar registros con evento NULL
        const checkQuery = 'SELECT COUNT(*) as count FROM lecturas_detalladas WHERE evento IS NULL';
        
        db.db.get(checkQuery, (err, row) => {
            if (err) {
                console.error('Error verificando registros:', err);
                return;
            }
            
            console.log(`Encontrados ${row.count} registros con evento NULL`);
            
            if (row.count > 0) {
                console.log('🔧 Actualizando registros existentes...');
                
                // Actualizar registros NULL a 'Normal'
                const updateQuery = 'UPDATE lecturas_detalladas SET evento = "Normal" WHERE evento IS NULL';
                
                db.db.run(updateQuery, (err) => {
                    if (err) {
                        console.error('Error actualizando registros:', err);
                    } else {
                        console.log('✅ Registros actualizados exitosamente');
                        
                        // Verificar que se actualizaron
                        db.db.get(checkQuery, (err, row) => {
                            if (err) {
                                console.error('Error verificando después de actualizar:', err);
                            } else {
                                console.log(`✅ Ahora hay ${row.count} registros con evento NULL`);
                                
                                // Mostrar algunos ejemplos
                                db.db.all('SELECT id, medicion_id, evento, o2, co, ch4, tiempo_relativo FROM lecturas_detalladas ORDER BY id DESC LIMIT 5', (err, rows) => {
                                    if (err) {
                                        console.error('Error obteniendo ejemplos:', err);
                                    } else {
                                        console.log('\n📊 Ejemplos de registros actualizados:');
                                        rows.forEach(row => {
                                            console.log(`ID: ${row.id}, Medición: ${row.medicion_id}, Evento: "${row.evento}", O2: ${row.o2}, CO: ${row.co}, CH4: ${row.ch4}`);
                                        });
                                    }
                                    
                                    db.disconnect();
                                });
                            }
                        });
                    }
                });
            } else {
                console.log('✅ No hay registros con evento NULL');
                
                // Mostrar algunos ejemplos de registros existentes
                db.db.all('SELECT id, medicion_id, evento, o2, co, ch4 FROM lecturas_detalladas ORDER BY id DESC LIMIT 5', (err, rows) => {
                    if (err) {
                        console.error('Error obteniendo ejemplos:', err);
                    } else {
                        console.log('\n📊 Ejemplos de registros existentes:');
                        rows.forEach(row => {
                            console.log(`ID: ${row.id}, Medición: ${row.medicion_id}, Evento: "${row.evento}", O2: ${row.o2}, CO: ${row.co}, CH4: ${row.ch4}`);
                        });
                    }
                    
                    db.disconnect();
                });
            }
        });
        
    } catch (error) {
        console.error('Error:', error);
    }
}

updateEvents();
