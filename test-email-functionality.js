// Script para probar la funcionalidad de verificación de internet y envío de correos
const InternetChecker = require('./src/utils/internet.js');
const EmailService = require('./src/utils/email.js');
const DatabaseManager = require('./src/utils/database.js');
const path = require('path');
const os = require('os');

async function testEmailFunctionality() {
    console.log('🚀 Iniciando prueba de funcionalidad de correo electrónico...\n');

    // 1. Verificar conexión a internet
    console.log('1️⃣ Verificando conexión a internet...');
    const internetChecker = new InternetChecker();
    
    try {
        const connectionResult = await internetChecker.checkConnection();
        
        if (connectionResult.connected) {
            console.log(`✅ Conexión a internet verificada (latencia: ${connectionResult.latency}ms)\n`);
        } else {
            console.log(`❌ No hay conexión a internet: ${connectionResult.error}\n`);
            
            // Intentar esperar por conexión
            console.log('🔄 Intentando esperar por conexión...');
            const waitResult = await internetChecker.waitForConnection(3000, 5);
            
            if (waitResult.connected) {
                console.log(`✅ Conexión establecida después de ${waitResult.attempts} intentos\n`);
            } else {
                console.log('❌ No se pudo establecer conexión a internet. Abortando prueba.\n');
                return;
            }
        }
    } catch (error) {
        console.error('❌ Error verificando conexión:', error.message);
        return;
    }

    // 2. Configurar servicio de correo
    console.log('2️⃣ Configurando servicio de correo...');
    const emailService = new EmailService();
    
    // Intentar cargar configuración desde archivo
    const configPath = path.join(__dirname, 'email-config.json');
    let configResult = await emailService.loadConfigFromFile(configPath);
    
    if (!configResult.success) {
        console.log('⚠️ No se encontró archivo de configuración. Usando configuración de ejemplo...');
        console.log('📝 Por favor, crea un archivo email-config.json basado en email-config-example.json\n');
        
        // Mostrar información de red
        const networkInfo = internetChecker.getNetworkInfo();
        console.log('📡 Información de red:');
        console.log(`   Hostname: ${networkInfo.hostname}`);
        console.log(`   Plataforma: ${networkInfo.platform}`);
        console.log('   Interfaces de red:');
        networkInfo.interfaces.forEach(iface => {
            console.log(`     - ${iface.name}: ${iface.address}`);
        });
        console.log('');
        
        return;
    }

    console.log('✅ Configuración de correo cargada exitosamente\n');

    // 3. Verificar configuración de correo
    console.log('3️⃣ Verificando configuración de correo...');
    const verifyResult = await emailService.verifyConfiguration();
    
    if (verifyResult.success) {
        console.log('✅ Configuración de correo verificada exitosamente\n');
    } else {
        console.log(`❌ Error verificando configuración de correo: ${verifyResult.error}\n`);
        return;
    }

    // 4. Conectar a base de datos y obtener datos de prueba
    console.log('4️⃣ Obteniendo datos de medición para prueba...');
    const dbManager = new DatabaseManager();
    
    try {
        await dbManager.connect();
        await dbManager.initialize();
        
        // Obtener la última medición
        const readingsResult = await dbManager.getAllReadings();
        
        if (readingsResult.success && readingsResult.data.length > 0) {
            const latestMeasurement = readingsResult.data[0];
            console.log(`✅ Encontrada medición de prueba: ID ${latestMeasurement.medicion_id} del ${latestMeasurement.fecha}`);
            
            // Obtener lecturas detalladas
            const detailedResult = await dbManager.getDetailedReadings(latestMeasurement.medicion_id);
            const readings = detailedResult.success ? detailedResult.data : [];
            
            console.log(`✅ Obtenidas ${readings.length} lecturas detalladas\n`);

            // 5. Enviar correo de prueba
            console.log('5️⃣ Enviando correo de prueba...');
            
            // Usar un correo de prueba (deberías cambiarlo por el tuyo)
            const testEmail = 'test@example.com'; // Cambiar por tu email
            console.log(`📧 Enviando a: ${testEmail}`);
            
            const emailResult = await emailService.sendMeasurementReport(
                latestMeasurement,
                readings,
                testEmail
            );

            if (emailResult.success) {
                console.log('✅ Correo enviado exitosamente!');
                console.log(`   Message ID: ${emailResult.messageId}`);
            } else {
                console.log(`❌ Error enviando correo: ${emailResult.error}`);
            }

        } else {
            console.log('⚠️ No se encontraron mediciones en la base de datos para enviar\n');
            
            // Crear datos de prueba
            console.log('📝 Creando datos de prueba...');
            const testData = {
                o2: 20.5,
                co: 15.2,
                ch4: 0.1
            };
            
            const saveResult = await dbManager.saveGasReading(testData, 'Prueba', 'Medición de prueba para envío de correo');
            
            if (saveResult.success) {
                console.log(`✅ Datos de prueba creados con ID: ${saveResult.medicion_id}`);
                
                // Agregar algunas lecturas detalladas de prueba
                for (let i = 0; i < 5; i++) {
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
                console.log('🔄 Ejecuta el script nuevamente para enviar el correo de prueba\n');
            } else {
                console.log(`❌ Error creando datos de prueba: ${saveResult.error}\n`);
            }
        }

        await dbManager.disconnect();

    } catch (error) {
        console.error('❌ Error trabajando con base de datos:', error.message);
    }

    console.log('\n🏁 Prueba completada');
}

// Función para crear configuración de correo interactiva
async function createEmailConfig() {
    console.log('📧 Configuración de correo electrónico\n');
    console.log('Este script te ayudará a configurar el envío de correos.\n');
    
    console.log('Para Gmail:');
    console.log('1. Ve a tu cuenta de Google');
    console.log('2. Activa la verificación en 2 pasos');
    console.log('3. Genera una "Contraseña de aplicación"');
    console.log('4. Usa esa contraseña aquí\n');
    
    console.log('Para otros proveedores, consulta la documentación de tu proveedor de correo.\n');
    
    const config = {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        user: 'tu-email@gmail.com',
        pass: 'tu-app-password',
        from: 'tu-email@gmail.com'
    };
    
    const configPath = path.join(__dirname, 'email-config.json');
    
    // Crear archivo de configuración de ejemplo
    const fs = require('fs');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    console.log(`✅ Archivo de configuración creado: ${configPath}`);
    console.log('📝 Por favor, edita este archivo con tu información de correo antes de usar el servicio.\n');
}

// Ejecutar según el argumento
const args = process.argv.slice(2);

if (args.includes('--config')) {
    createEmailConfig();
} else {
    testEmailFunctionality().catch(error => {
        console.error('❌ Error en la prueba:', error.message);
        process.exit(1);
    });
}
