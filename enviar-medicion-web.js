// Script para enviar una medición específica a la plataforma web
const WebSender = require('./src/utils/web-sender.js');
const DatabaseManager = require('./src/utils/database.js');

async function enviarMedicionAPlataformaWeb() {
    console.log('🌐 Enviando medición a plataforma web\n');

    try {
        // 1. Inicializar servicios
        console.log('1️⃣ Inicializando servicios...');
        const webSender = new WebSender();
        const dbManager = new DatabaseManager();
        
        await dbManager.connect();
        await dbManager.initialize();
        console.log('✅ Base de datos conectada');

        // 2. Crear configuración de ejemplo si no existe
        console.log('\n2️⃣ Verificando configuración...');
        const configResult = await webSender.createExampleConfig();
        
        if (configResult.success) {
            console.log(`✅ Archivo de configuración creado: ${configResult.configPath}`);
            console.log('📝 Por favor, edita este archivo con la URL y API key de tu plataforma web\n');
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
            
            const saveResult = await dbManager.saveGasReading(testData, 'Prueba Web', 'Medición de prueba para envío a plataforma web');
            
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

        // 5. Seleccionar medición (por defecto la primera)
        const medicionId = readingsResult.data[0].medicion_id;
        console.log(`\n5️⃣ Enviando medición ID ${medicionId} a plataforma web...`);

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

        // 7. Enviar medición a plataforma web
        console.log('\n7️⃣ Enviando medición a plataforma web...');
        const result = await webSender.sendMeasurementToPlatform(medicionId);

        if (result.success) {
            console.log('✅ ¡Medición enviada exitosamente a plataforma web!');
            console.log(`   📊 Medición ID: ${result.measurementId}`);
            console.log(`   🌐 Respuesta: ${JSON.stringify(result.response, null, 2)}`);
        } else {
            console.log(`❌ Error enviando medición: ${result.error}`);
            
            // Mostrar sugerencias para resolver el problema
            console.log('\n💡 Posibles soluciones:');
            console.log('   1. Verifica que la URL de la plataforma web sea correcta');
            console.log('   2. Comprueba que la API key sea válida');
            console.log('   3. Asegúrate de que la plataforma web esté funcionando');
            console.log('   4. Verifica que el endpoint sea correcto');
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
    console.log('🌐 Envío de mediciones a plataforma web\n');
    console.log('Este script te permite enviar una medición específica a tu plataforma web.');
    console.log('Los datos se envían directamente vía API REST.\n');
    
    console.log('📋 Pasos:');
    console.log('1. Ejecuta el script para crear el archivo de configuración');
    console.log('2. Edita web-platform-config.json con tu información:');
    console.log('   - baseUrl: URL de tu plataforma web');
    console.log('   - apiKey: Tu clave API');
    console.log('   - endpoint: Endpoint para recibir mediciones');
    console.log('3. Ejecuta el script nuevamente para enviar la medición\n');
    
    console.log('🔧 Configuración de ejemplo:');
    console.log('{');
    console.log('  "baseUrl": "https://api.miplataforma.com",');
    console.log('  "apiKey": "tu-api-key-aqui",');
    console.log('  "endpoint": "/api/mediciones"');
    console.log('}\n');
    
    console.log('💡 Si no hay mediciones, se crea una de prueba automáticamente.');
    console.log('📊 Los datos se envían en formato JSON con toda la información de la medición.');
}

// Función para probar la configuración
async function probarConfiguracion() {
    console.log('🧪 Probando configuración de plataforma web...\n');
    
    try {
        const webSender = new WebSender();
        
        // Crear configuración de ejemplo
        const configResult = await webSender.createExampleConfig();
        if (configResult.success) {
            console.log(`✅ Archivo de configuración creado: ${configResult.configPath}`);
        }
        
        // Intentar cargar configuración
        const loadResult = await webSender.webPlatformService.loadConfigFromFile(configResult.configPath);
        if (loadResult.success) {
            console.log('✅ Configuración cargada correctamente');
            
            // Verificar conexión
            const verifyResult = await webSender.webPlatformService.verifyConnection();
            if (verifyResult.success) {
                console.log('✅ Conexión con plataforma web verificada');
            } else {
                console.log(`⚠️ No se pudo verificar conexión: ${verifyResult.error}`);
                console.log('💡 Esto es normal si la URL es de ejemplo');
            }
        } else {
            console.log(`❌ Error cargando configuración: ${loadResult.error}`);
        }
        
    } catch (error) {
        console.error('❌ Error en la prueba:', error.message);
    }
}

// Ejecutar según argumentos
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    mostrarAyuda();
} else if (args.includes('--test-config')) {
    probarConfiguracion().catch(error => {
        console.error('❌ Error en la prueba:', error.message);
        process.exit(1);
    });
} else {
    enviarMedicionAPlataformaWeb().catch(error => {
        console.error('❌ Error fatal:', error.message);
        process.exit(1);
    });
}
