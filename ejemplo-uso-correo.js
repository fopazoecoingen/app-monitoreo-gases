// Ejemplo de uso del servicio de envío de correos
const EmailSender = require('./src/utils/email-sender.js');

async function ejemploUso() {
    console.log('📧 Ejemplo de uso del servicio de envío de correos\n');

    // 1. Crear instancia del servicio
    const emailSender = new EmailSender();

    // 2. Crear archivo de configuración de ejemplo
    console.log('1️⃣ Creando archivo de configuración de ejemplo...');
    const configResult = await emailSender.createExampleConfig();
    
    if (configResult.success) {
        console.log(`✅ Archivo de configuración creado: ${configResult.configPath}`);
        console.log('📝 Edita este archivo con tu información de correo antes de continuar\n');
    } else {
        console.log(`❌ Error creando configuración: ${configResult.error}\n`);
        return;
    }

    // 3. Verificar conexión a internet
    console.log('2️⃣ Verificando conexión a internet...');
    const internetChecker = new (require('./src/utils/internet.js'))();
    const connectionResult = await internetChecker.checkConnection();
    
    if (connectionResult.connected) {
        console.log(`✅ Conexión a internet verificada (latencia: ${connectionResult.latency}ms)\n`);
    } else {
        console.log(`❌ No hay conexión a internet: ${connectionResult.error}\n`);
        return;
    }

    // 4. Verificar estado del servicio
    console.log('3️⃣ Verificando estado del servicio...');
    const status = await emailSender.checkServiceStatus();
    
    console.log('Estado del servicio:');
    console.log(`  - Internet: ${status.internet ? '✅ Conectado' : '❌ Desconectado'}`);
    console.log(`  - Correo: ${status.email ? '✅ Configurado' : '❌ No configurado'}`);
    console.log(`  - Base de datos: ${status.database ? '✅ Conectada' : '❌ Desconectada'}\n`);

    if (!status.email) {
        console.log('⚠️ El servicio de correo no está configurado.');
        console.log('📝 Por favor, edita el archivo email-config.json con tu información de correo.\n');
        return;
    }

    // 5. Ejemplo de envío de correo (solo si está configurado)
    console.log('4️⃣ Ejemplo de envío de correo...');
    console.log('📧 Para enviar un correo, usa:');
    console.log('   await emailSender.sendLatestMeasurementReport("destinatario@email.com");');
    console.log('   o');
    console.log('   await emailSender.sendReportsByDateRange("destinatario@email.com", "2024-01-01", "2024-01-31");\n');

    // 6. Información de red
    console.log('5️⃣ Información de red:');
    const networkInfo = internetChecker.getNetworkInfo();
    console.log(`   Hostname: ${networkInfo.hostname}`);
    console.log(`   Plataforma: ${networkInfo.platform}`);
    console.log('   Interfaces de red:');
    networkInfo.interfaces.forEach(iface => {
        console.log(`     - ${iface.name}: ${iface.address}`);
    });

    console.log('\n🏁 Ejemplo completado');
    console.log('\n📋 Pasos siguientes:');
    console.log('1. Edita email-config.json con tu información de correo');
    console.log('2. Asegúrate de tener conexión a internet');
    console.log('3. Usa el servicio en tu aplicación');
}

// Ejecutar ejemplo
ejemploUso().catch(error => {
    console.error('❌ Error en el ejemplo:', error.message);
    process.exit(1);
});
