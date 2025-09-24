// Script para enviar una medición específica como blob al contenedor
const BlobSender = require('./src/utils/blob-sender.js');
const DatabaseManager = require('./src/utils/database.js');

async function enviarMedicionComoBlob() {
    console.log('📦 Enviando medición como blob al contenedor\n');

    try {
        // 1. Inicializar servicios
        console.log('1️⃣ Inicializando servicios...');
        const blobSender = new BlobSender();
        const dbManager = new DatabaseManager();
        
        await dbManager.connect();
        await dbManager.initialize();
        console.log('✅ Base de datos conectada');

        // 2. Crear configuración de ejemplo si no existe
        console.log('\n2️⃣ Verificando configuración...');
        const configResult = await blobSender.createExampleConfig();
        
        if (configResult.success) {
            console.log(`✅ Archivo de configuración creado: ${configResult.configPath}`);
            console.log('📝 Por favor, edita este archivo con la URL y API key de tu endpoint de blobs\n');
            return;
        }

        // 3. Obtener mediciones disponibles
        console.log('\n3️⃣ Obteniendo mediciones disponibles...');
        const readingsResult = await dbManager.getAllReadings();
        
        if (!readingsResult.success || readingsResult.data.length === 0) {
            console.log('⚠️ No se encontraron mediciones en la base de datos');
            
            // Crear medición de prueba
            console.log('📝 Creando medición de prueba...');
            const testData = {
                o2: 20.5,
                co: 15.2,
                ch4: 0.1
            };
            
            const saveResult = await dbManager.saveGasReading(testData, 'Prueba Blob', 'Medición de prueba para envío como blob');
            
            if (saveResult.success) {
                console.log(`✅ Medición de prueba creada con ID: ${saveResult.medicion_id}`);
                
                // Agregar lecturas detalladas de prueba
                for (let i = 0; i < 10; i++) {
                    await dbManager.saveDetailedReading(
                        saveResult.medicion_id,
                        {
                            o2: 20.5 + (Math.random() - 0.5) * 2,
                            co: 15.2 + (Math.random() - 0.5) * 5,
                            ch4: 0.1 + (Math.random() - 0.5) * 0.2
                        },
                        `${i * 30}s`,
                        'Normal'
                    );
                }
                
                console.log('✅ Lecturas detalladas de prueba creadas');
                
                // Obtener mediciones nuevamente
                const newReadingsResult = await dbManager.getAllReadings();
                if (newReadingsResult.success && newReadingsResult.data.length > 0) {
                    readingsResult.data = newReadingsResult.data;
                }
            }
        }

        // 4. Mostrar mediciones disponibles
        console.log('\n4️⃣ Mediciones disponibles:');
        readingsResult.data.forEach((medicion, index) => {
            console.log(`   ${index + 1}. ID: ${medicion.medicion_id} - ${medicion.fecha} ${medicion.hora} - Evento: ${medicion.evento} - Lecturas: ${medicion.total_lecturas}`);
        });

        // 5. Seleccionar medición y formato
        const medicionId = readingsResult.data[0].medicion_id;
        const format = 'json'; // Puedes cambiar a 'csv' o 'excel'
        
        console.log(`\n5️⃣ Enviando medición ID ${medicionId} como blob (formato: ${format})...`);

        // 6. Verificar conexión a internet
        console.log('\n6️⃣ Verificando conexión a internet...');
        const InternetChecker = require('./src/utils/internet.js');
        const internetChecker = new InternetChecker();
        
        const connectionResult = await internetChecker.checkConnection();
        if (!connectionResult.connected) {
            console.log('❌ No hay conexión a internet. Abortando envío.');
            return;
        }
        console.log(`✅ Conexión a internet verificada (${connectionResult.latency}ms)`);

        // 7. Enviar medición como blob
        console.log('\n7️⃣ Enviando medición como blob...');
        const result = await blobSender.sendMeasurementAsBlob(medicionId, format);

        if (result.success) {
            console.log('✅ ¡Medición enviada exitosamente como blob!');
            console.log(`   📦 Blob ID: ${result.blobId}`);
            console.log(`   📁 Blob Name: ${result.blobName}`);
            console.log(`   🗂️ Container: ${result.containerName}`);
            console.log(`   📄 Formato: ${result.format}`);
            console.log(`   🌐 Respuesta: ${JSON.stringify(result.response, null, 2)}`);
        } else {
            console.log(`❌ Error enviando medición como blob: ${result.error}`);
            
            // Mostrar sugerencias para resolver el problema
            console.log('\n💡 Posibles soluciones:');
            console.log('   1. Verifica que la URL del endpoint sea correcta');
            console.log('   2. Comprueba que la API key sea válida');
            console.log('   3. Asegúrate de que el endpoint esté funcionando');
            console.log('   4. Verifica que el endpoint acepte el formato de datos enviado');
            console.log('   5. Comprueba que el contenedor de blobs exista');
        }

        // 8. Cerrar conexiones
        await dbManager.disconnect();
        console.log('\n✅ Proceso completado');

    } catch (error) {
        console.error('❌ Error en el proceso:', error.message);
    }
}

// Función para mostrar ayuda
function mostrarAyuda() {
    console.log('📦 Envío de mediciones como blobs\n');
    console.log('Este script te permite enviar una medición específica como blob a tu contenedor.');
    console.log('Los datos se envían directamente vía API REST a tu endpoint.\n');
    
    console.log('📋 Pasos:');
    console.log('1. Ejecuta el script para crear el archivo de configuración');
    console.log('2. Edita blob-config.json con tu información:');
    console.log('   - baseUrl: URL de tu plataforma');
    console.log('   - apiKey: Tu clave API');
    console.log('   - endpoint: Endpoint para recibir blobs');
    console.log('   - containerName: Nombre del contenedor de blobs');
    console.log('3. Ejecuta el script nuevamente para enviar la medición\n');
    
    console.log('🔧 Configuración de ejemplo:');
    console.log('{');
    console.log('  "baseUrl": "https://api.miplataforma.com",');
    console.log('  "apiKey": "tu-api-key-aqui",');
    console.log('  "endpoint": "/api/blobs/upload",');
    console.log('  "containerName": "mediciones"');
    console.log('}\n');
    
    console.log('📄 Formatos soportados:');
    console.log('   - json: Datos estructurados en JSON');
    console.log('   - csv: Datos en formato CSV');
    console.log('   - excel: Datos estructurados para generar Excel\n');
    
    console.log('💡 Si no hay mediciones, se crea una de prueba automáticamente.');
    console.log('📊 Los datos incluyen toda la información de la medición y sus lecturas detalladas.');
}

// Función para probar diferentes formatos
async function probarFormatos() {
    console.log('🧪 Probando diferentes formatos de blob...\n');
    
    try {
        const blobSender = new BlobSender();
        const dbManager = new DatabaseManager();
        
        await dbManager.connect();
        await dbManager.initialize();
        
        // Obtener primera medición
        const readingsResult = await dbManager.getAllReadings();
        if (!readingsResult.success || readingsResult.data.length === 0) {
            console.log('❌ No hay mediciones para probar');
            return;
        }
        
        const medicionId = readingsResult.data[0].medicion_id;
        const formats = ['json', 'csv', 'excel'];
        
        for (const format of formats) {
            console.log(`\n📤 Probando formato: ${format}`);
            
            try {
                const result = await blobSender.sendMeasurementAsBlob(medicionId, format);
                
                if (result.success) {
                    console.log(`✅ Formato ${format}: Éxito`);
                    console.log(`   Blob: ${result.blobName}`);
                } else {
                    console.log(`❌ Formato ${format}: ${result.error}`);
                }
            } catch (error) {
                console.log(`❌ Formato ${format}: Error - ${error.message}`);
            }
        }
        
        await dbManager.disconnect();
        
    } catch (error) {
        console.error('❌ Error en la prueba:', error.message);
    }
}

// Ejecutar según argumentos
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    mostrarAyuda();
} else if (args.includes('--test-formats')) {
    probarFormatos().catch(error => {
        console.error('❌ Error en la prueba:', error.message);
        process.exit(1);
    });
} else {
    enviarMedicionComoBlob().catch(error => {
        console.error('❌ Error fatal:', error.message);
        process.exit(1);
    });
}
