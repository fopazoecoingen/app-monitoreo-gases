// Script para probar las funciones de database.js
const DatabaseManager = require('./src/utils/database');
const path = require('path');
const os = require('os');

async function testFunctions() {
    const dbPath = path.join(os.homedir(), 'Documents', 'ModbusAnalyzer', 'modbus_data.db');
    const databaseManager = new DatabaseManager(dbPath);

    try {
        await databaseManager.connect();
        console.log('✅ Conectado a la base de datos');

        // Probar getAllReadings
        console.log('\n🔍 Probando getAllReadings...');
        const allReadings = await databaseManager.getAllReadings();
        console.log('Resultado getAllReadings:', {
            success: allReadings.success,
            dataLength: allReadings.data ? allReadings.data.length : 'undefined',
            error: allReadings.error || 'none'
        });

        if (allReadings.success && allReadings.data && allReadings.data.length > 0) {
            console.log('Primera medición:', allReadings.data[0]);
        }

        // Probar getReadingsByDateRange
        console.log('\n🔍 Probando getReadingsByDateRange...');
        const dateRangeReadings = await databaseManager.getReadingsByDateRange('2025-09-23', '2025-09-23');
        console.log('Resultado getReadingsByDateRange:', {
            success: dateRangeReadings.success,
            dataLength: dateRangeReadings.data ? dateRangeReadings.data.length : 'undefined',
            error: dateRangeReadings.error || 'none'
        });

        if (dateRangeReadings.success && dateRangeReadings.data && dateRangeReadings.data.length > 0) {
            console.log('Primera medición del rango:', dateRangeReadings.data[0]);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await databaseManager.disconnect();
        console.log('✅ Desconectado de la base de datos');
    }
}

testFunctions();
