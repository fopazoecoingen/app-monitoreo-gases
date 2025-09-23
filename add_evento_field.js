// Script para agregar el campo evento a la tabla lecturas_detalladas
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

async function addEventoField() {
    const dbPath = path.join(os.homedir(), 'Documents', 'ModbusAnalyzer', 'modbus_data.db');
    
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error conectando a la base de datos:', err.message);
            return;
        }
        console.log('✅ Conectado a la base de datos:', dbPath);
    });

    // Verificar estructura actual
    db.all("PRAGMA table_info(lecturas_detalladas)", (err, columns) => {
        if (err) {
            console.error('Error verificando estructura:', err.message);
            return;
        }

        console.log('\n📊 Estructura actual:');
        columns.forEach(col => {
            console.log(`- ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : 'NULL'}`);
        });

        const hasEvento = columns.some(col => col.name === 'evento');
        console.log(`\n¿Tiene campo 'evento'? ${hasEvento ? '✅ SÍ' : '❌ NO'}`);

        if (!hasEvento) {
            console.log('\n🔧 Agregando campo evento...');
            
            // Agregar el campo evento
            db.run('ALTER TABLE lecturas_detalladas ADD COLUMN evento TEXT DEFAULT "Normal"', (err) => {
                if (err) {
                    console.error('❌ Error agregando campo evento:', err.message);
                } else {
                    console.log('✅ Campo evento agregado exitosamente');
                    
                    // Actualizar registros existentes
                    db.run('UPDATE lecturas_detalladas SET evento = "Normal"', (err) => {
                        if (err) {
                            console.error('❌ Error actualizando registros:', err.message);
                        } else {
                            console.log('✅ Registros existentes actualizados con evento "Normal"');
                            
                            // Verificar la nueva estructura
                            db.all("PRAGMA table_info(lecturas_detalladas)", (err, newColumns) => {
                                if (err) {
                                    console.error('Error verificando nueva estructura:', err.message);
                                } else {
                                    console.log('\n📊 Nueva estructura:');
                                    newColumns.forEach(col => {
                                        console.log(`- ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : 'NULL'} ${col.dflt_value ? `DEFAULT "${col.dflt_value}"` : ''}`);
                                    });
                                    
                                    // Mostrar algunos ejemplos
                                    db.all('SELECT id, medicion_id, evento, o2, co, ch4 FROM lecturas_detalladas ORDER BY id DESC LIMIT 3', (err, rows) => {
                                        if (err) {
                                            console.error('Error obteniendo ejemplos:', err.message);
                                        } else {
                                            console.log('\n📋 Ejemplos de registros:');
                                            rows.forEach(row => {
                                                console.log(`ID: ${row.id}, Medición: ${row.medicion_id}, Evento: "${row.evento}", O2: ${row.o2}, CO: ${row.co}, CH4: ${row.ch4}`);
                                            });
                                        }
                                        
                                        db.close();
                                    });
                                }
                            });
                        }
                    });
                }
            });
        } else {
            console.log('✅ El campo evento ya existe');
            db.close();
        }
    });
}

addEventoField();
