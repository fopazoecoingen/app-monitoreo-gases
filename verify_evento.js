// Script para verificar el campo evento con query directa
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

async function verifyEvento() {
    const dbPath = path.join(os.homedir(), 'Documents', 'ModbusAnalyzer', 'modbus_data.db');
    
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error conectando:', err.message);
            return;
        }
        console.log('✅ Conectado a:', dbPath);
    });

    // Query directa para ver la estructura
    console.log('\n🔍 Verificando estructura con PRAGMA:');
    db.all("PRAGMA table_info(lecturas_detalladas)", (err, columns) => {
        if (err) {
            console.error('Error:', err.message);
            return;
        }

        console.log('Columnas encontradas:');
        columns.forEach((col, index) => {
            console.log(`${index + 1}. ${col.name} - ${col.type} - ${col.notnull ? 'NOT NULL' : 'NULL'} - Default: ${col.dflt_value || 'none'}`);
        });

        // Query para ver si el campo evento existe
        console.log('\n🔍 Probando SELECT con campo evento:');
        db.all("SELECT id, medicion_id, evento, o2, co, ch4 FROM lecturas_detalladas LIMIT 3", (err, rows) => {
            if (err) {
                console.error('❌ Error en SELECT (campo evento no existe):', err.message);
                
                // Intentar sin el campo evento
                console.log('\n🔍 Probando SELECT sin campo evento:');
                db.all("SELECT id, medicion_id, o2, co, ch4 FROM lecturas_detalladas LIMIT 3", (err, rows) => {
                    if (err) {
                        console.error('Error en SELECT sin evento:', err.message);
                    } else {
                        console.log('✅ Query sin evento funciona. Ejemplos:');
                        rows.forEach(row => {
                            console.log(`ID: ${row.id}, Medición: ${row.medicion_id}, O2: ${row.o2}, CO: ${row.co}, CH4: ${row.ch4}`);
                        });
                    }
                    db.close();
                });
            } else {
                console.log('✅ Query con evento funciona. Ejemplos:');
                rows.forEach(row => {
                    console.log(`ID: ${row.id}, Medición: ${row.medicion_id}, Evento: "${row.evento}", O2: ${row.o2}, CO: ${row.co}, CH4: ${row.ch4}`);
                });
                db.close();
            }
        });
    });
}

verifyEvento();
