// Script para enviar una medición específica al laboratorio
const EmailSender = require('./src/utils/email-sender.js');
const DatabaseManager = require('./src/utils/database.js');

async function enviarMedicionAlLaboratorio() {
    console.log('🏭 Enviando medición al laboratorio\n');

    // Configuración
    const LAB_EMAIL = 'laboratorio@example.com'; // Cambiar por el email del laboratorio
    const INCLUIR_EXCEL = true;
    
    try {
        // 1. Inicializar servicios
        console.log('1️⃣ Inicializando servicios...');
        const emailSender = new EmailSender();
        const dbManager = new DatabaseManager();
        
        await dbManager.connect();
        await dbManager.initialize();
        console.log('✅ Base de datos conectada');

        // 2. Obtener mediciones disponibles
        console.log('\n2️⃣ Obteniendo mediciones disponibles...');
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
            
            const saveResult = await dbManager.saveGasReading(testData, 'Prueba Laboratorio', 'Medición de prueba para envío al laboratorio');
            
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

        // 3. Mostrar mediciones disponibles
        console.log('\n3️⃣ Mediciones disponibles:');
        readingsResult.data.forEach((medicion, index) => {
            console.log(`   ${index + 1}. ID: ${medicion.medicion_id} - ${medicion.fecha} ${medicion.hora} - Evento: ${medicion.evento} - Lecturas: ${medicion.total_lecturas}`);
        });

        // 4. Seleccionar medición (por defecto la primera)
        const medicionId = readingsResult.data[0].medicion_id;
        console.log(`\n4️⃣ Enviando medición ID ${medicionId} al laboratorio...`);

        // 5. Verificar conexión a internet
        console.log('\n5️⃣ Verificando conexión a internet...');
        const InternetChecker = require('./src/utils/internet.js');
        const internetChecker = new InternetChecker();
        
        const connectionResult = await internetChecker.checkConnection();
        if (!connectionResult.connected) {
            console.log('❌ No hay conexión a internet. Abortando envío.');
            return;
        }
        console.log(`✅ Conexión a internet verificada (${connectionResult.latency}ms)`);

        // 6. Enviar medición al laboratorio
        console.log('\n6️⃣ Enviando medición al laboratorio...');
        const result = await emailSender.sendMeasurementReportWithAttachment(
            medicionId,
            LAB_EMAIL,
            INCLUIR_EXCEL ? 'excel' : null
        );

        if (result.success) {
            console.log('✅ ¡Medición enviada exitosamente al laboratorio!');
            console.log(`   📧 Email: ${LAB_EMAIL}`);
            console.log(`   📊 Medición ID: ${medicionId}`);
            console.log(`   📎 Excel adjunto: ${INCLUIR_EXCEL ? 'Sí' : 'No'}`);
            console.log(`   📬 Message ID: ${result.messageId}`);
        } else {
            console.log(`❌ Error enviando medición: ${result.error}`);
        }

        // 7. Cerrar conexiones
        await dbManager.disconnect();
        console.log('\n✅ Proceso completado');

    } catch (error) {
        console.error('❌ Error en el proceso:', error.message);
    }
}

// Función para mostrar ayuda
function mostrarAyuda() {
    console.log('📧 Envío de mediciones al laboratorio\n');
    console.log('Este script te permite enviar una medición específica al laboratorio.');
    console.log('Incluye un archivo Excel con todos los datos de la medición.\n');
    
    console.log('📋 Pasos:');
    console.log('1. Configura tu email en email-config.json');
    console.log('2. Cambia LAB_EMAIL en este script por el email del laboratorio');
    console.log('3. Ejecuta: node enviar-medicion-lab.js\n');
    
    console.log('🔧 Configuración:');
    console.log('- LAB_EMAIL: Email del laboratorio');
    console.log('- INCLUIR_EXCEL: true/false para incluir archivo Excel');
    console.log('- Se envía automáticamente la primera medición disponible\n');
    
    console.log('💡 Si no hay mediciones, se crea una de prueba automáticamente.');
}

// Ejecutar según argumentos
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    mostrarAyuda();
} else {
    enviarMedicionAlLaboratorio().catch(error => {
        console.error('❌ Error fatal:', error.message);
        process.exit(1);
    });
}
