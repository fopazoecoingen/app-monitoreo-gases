// Script para verificar las mediciones en la base de datos
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

async function testDatabase() {
    const dbPath = path.join(os.homedir(), 'Documents', 'ModbusAnalyzer', 'modbus_data.db');
    
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error conectando:', err.message);
            return;
        }
        console.log('✅ Conectado a:', dbPath);
    });

    // Verificar tabla medicion
    console.log('\n📊 Verificando tabla medicion:');
    db.all("SELECT COUNT(*) as total FROM medicion", (err, rows) => {
        if (err) {
            console.error('Error contando mediciones:', err.message);
        } else {
            console.log(`Total de mediciones: ${rows[0].total}`);
        }
    });

    // Verificar tabla lecturas_detalladas
    console.log('\n📊 Verificando tabla lecturas_detalladas:');
    db.all("SELECT COUNT(*) as total FROM lecturas_detalladas", (err, rows) => {
        if (err) {
            console.error('Error contando lecturas:', err.message);
        } else {
            console.log(`Total de lecturas detalladas: ${rows[0].total}`);
        }
    });

    // Mostrar algunas mediciones
    console.log('\n📋 Últimas 5 mediciones:');
    db.all(`
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
        GROUP BY m.id 
        ORDER BY m.fecha DESC, m.hora DESC 
        LIMIT 5
    `, (err, rows) => {
        if (err) {
            console.error('Error obteniendo mediciones:', err.message);
        } else {
            if (rows.length === 0) {
                console.log('❌ No hay mediciones en la base de datos');
            } else {
                console.log('✅ Mediciones encontradas:');
                rows.forEach(row => {
                    console.log(`ID: ${row.medicion_id}, Fecha: ${row.fecha}, Hora: ${row.hora}, Evento: ${row.evento}, Lecturas: ${row.total_lecturas}`);
                });
            }
        }
        db.close();
    });
}

testDatabase();
