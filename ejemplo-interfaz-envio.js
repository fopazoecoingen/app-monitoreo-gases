// Ejemplo de cómo usar la funcionalidad de envío al laboratorio desde la interfaz
// Este archivo muestra cómo integrar el envío de mediciones en el frontend

// Ejemplo de función para enviar medición al laboratorio desde la interfaz
async function enviarMedicionAlLaboratorio(medicionId, labEmail, incluirExcel = true) {
    try {
        console.log(`📧 Enviando medición ${medicionId} al laboratorio...`);
        
        // Mostrar indicador de carga
        mostrarIndicadorCarga('Enviando medición al laboratorio...');
        
        // Verificar conexión a internet primero
        const connectionResult = await window.electronAPI.checkInternetConnection();
        
        if (!connectionResult.success || !connectionResult.connected) {
            mostrarError('No hay conexión a internet. Verifique su conexión e intente nuevamente.');
            return;
        }
        
        console.log('✅ Conexión a internet verificada');
        
        // Enviar medición al laboratorio
        const result = await window.electronAPI.sendMedicionToLab(medicionId, labEmail, incluirExcel);
        
        if (result.success) {
            mostrarExito(`✅ Medición ${medicionId} enviada exitosamente al laboratorio!`);
            console.log('📧 Detalles del envío:', result);
            
            // Mostrar información adicional
            mostrarInformacionEnvio({
                medicionId: result.medicionId,
                labEmail: result.labEmail,
                attachmentInfo: result.attachmentInfo,
                messageId: result.messageId
            });
        } else {
            mostrarError(`❌ Error enviando medición: ${result.error}`);
        }
        
    } catch (error) {
        console.error('❌ Error en envío:', error);
        mostrarError(`❌ Error inesperado: ${error.message}`);
    } finally {
        ocultarIndicadorCarga();
    }
}

// Ejemplo de función para mostrar información de envío
function mostrarInformacionEnvio(detalles) {
    const mensaje = `
📧 Medición enviada exitosamente al laboratorio

📊 Detalles:
• ID de Medición: ${detalles.medicionId}
• Email del Laboratorio: ${detalles.labEmail}
• Adjunto: ${detalles.attachmentInfo}
• Message ID: ${detalles.messageId}

✅ La medición ha sido enviada correctamente.
    `;
    
    // Aquí usarías tu sistema de notificaciones o modales
    console.log(mensaje);
    
    // Ejemplo con alert (en producción usarías algo más elegante)
    // alert(mensaje);
}

// Ejemplo de función para mostrar indicador de carga
function mostrarIndicadorCarga(mensaje) {
    console.log(`⏳ ${mensaje}`);
    
    // Ejemplo de implementación en la interfaz
    /*
    const loader = document.createElement('div');
    loader.id = 'email-loader';
    loader.innerHTML = `
        <div class="loader-overlay">
            <div class="loader-content">
                <div class="spinner"></div>
                <p>${mensaje}</p>
            </div>
        </div>
    `;
    document.body.appendChild(loader);
    */
}

// Ejemplo de función para ocultar indicador de carga
function ocultarIndicadorCarga() {
    console.log('✅ Carga completada');
    
    // Ejemplo de implementación en la interfaz
    /*
    const loader = document.getElementById('email-loader');
    if (loader) {
        loader.remove();
    }
    */
}

// Ejemplo de función para mostrar error
function mostrarError(mensaje) {
    console.error(mensaje);
    
    // Ejemplo de implementación en la interfaz
    /*
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <div class="error-content">
            <span class="error-icon">❌</span>
            <span class="error-text">${mensaje}</span>
        </div>
    `;
    
    // Agregar a la interfaz
    const container = document.getElementById('notification-container');
    container.appendChild(errorDiv);
    
    // Auto-remover después de 5 segundos
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
    */
}

// Ejemplo de función para mostrar éxito
function mostrarExito(mensaje) {
    console.log(mensaje);
    
    // Ejemplo de implementación en la interfaz
    /*
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.innerHTML = `
        <div class="success-content">
            <span class="success-icon">✅</span>
            <span class="success-text">${mensaje}</span>
        </div>
    `;
    
    // Agregar a la interfaz
    const container = document.getElementById('notification-container');
    container.appendChild(successDiv);
    
    // Auto-remover después de 5 segundos
    setTimeout(() => {
        successDiv.remove();
    }, 5000);
    */
}

// Ejemplo de HTML para botón de envío al laboratorio
const ejemploHTML = `
<!-- Botón para enviar medición al laboratorio -->
<div class="medicion-item" data-medicion-id="123">
    <div class="medicion-info">
        <h3>Medición #123</h3>
        <p>Fecha: 2024-01-15 14:30:00</p>
        <p>Evento: Normal</p>
        <p>Lecturas: 150</p>
    </div>
    
    <div class="medicion-actions">
        <button class="btn btn-primary" onclick="verMedicion(123)">
            📊 Ver Detalles
        </button>
        
        <button class="btn btn-success" onclick="enviarAlLaboratorio(123)">
            🏭 Enviar al Laboratorio
        </button>
        
        <button class="btn btn-info" onclick="exportarExcel(123)">
            📎 Exportar Excel
        </button>
    </div>
</div>

<!-- Modal para envío al laboratorio -->
<div id="lab-email-modal" class="modal" style="display: none;">
    <div class="modal-content">
        <div class="modal-header">
            <h3>📧 Enviar al Laboratorio</h3>
            <span class="close" onclick="cerrarModal()">&times;</span>
        </div>
        
        <div class="modal-body">
            <div class="form-group">
                <label for="lab-email">Email del Laboratorio:</label>
                <input type="email" id="lab-email" placeholder="laboratorio@example.com" required>
            </div>
            
            <div class="form-group">
                <label>
                    <input type="checkbox" id="incluir-excel" checked>
                    📎 Incluir archivo Excel con datos detallados
                </label>
            </div>
            
            <div class="form-group">
                <label for="medicion-info">Información de la medición:</label>
                <div id="medicion-info" class="medicion-summary">
                    <!-- Se llena dinámicamente -->
                </div>
            </div>
        </div>
        
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="cerrarModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="confirmarEnvio()">
                📧 Enviar al Laboratorio
            </button>
        </div>
    </div>
</div>
`;

// Ejemplo de funciones para manejar el modal
function enviarAlLaboratorio(medicionId) {
    // Obtener información de la medición
    const medicion = obtenerMedicionPorId(medicionId);
    
    // Llenar información en el modal
    document.getElementById('medicion-info').innerHTML = `
        <strong>ID:</strong> ${medicion.id}<br>
        <strong>Fecha:</strong> ${medicion.fecha}<br>
        <strong>Hora:</strong> ${medicion.hora}<br>
        <strong>Evento:</strong> ${medicion.evento}<br>
        <strong>Lecturas:</strong> ${medicion.total_lecturas}
    `;
    
    // Mostrar modal
    document.getElementById('lab-email-modal').style.display = 'block';
    
    // Guardar ID de medición para usar en confirmarEnvio
    document.getElementById('lab-email-modal').dataset.medicionId = medicionId;
}

function confirmarEnvio() {
    const medicionId = document.getElementById('lab-email-modal').dataset.medicionId;
    const labEmail = document.getElementById('lab-email').value;
    const incluirExcel = document.getElementById('incluir-excel').checked;
    
    if (!labEmail) {
        mostrarError('Por favor ingrese el email del laboratorio');
        return;
    }
    
    // Cerrar modal
    cerrarModal();
    
    // Enviar medición
    enviarMedicionAlLaboratorio(medicionId, labEmail, incluirExcel);
}

function cerrarModal() {
    document.getElementById('lab-email-modal').style.display = 'none';
    document.getElementById('lab-email').value = '';
    document.getElementById('incluir-excel').checked = true;
}

// Ejemplo de CSS para los estilos
const ejemploCSS = `
.medicion-item {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 15px;
    margin: 10px 0;
    background: white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.medicion-info {
    margin-bottom: 10px;
}

.medicion-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.btn {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.3s;
}

.btn-primary {
    background-color: #007bff;
    color: white;
}

.btn-success {
    background-color: #28a745;
    color: white;
}

.btn-info {
    background-color: #17a2b8;
    color: white;
}

.btn:hover {
    opacity: 0.8;
}

.modal {
    position: fixed;
    z-index: 1000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0,0,0,0.5);
}

.modal-content {
    background-color: white;
    margin: 5% auto;
    padding: 0;
    border-radius: 8px;
    width: 80%;
    max-width: 500px;
}

.modal-header {
    padding: 20px;
    border-bottom: 1px solid #ddd;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.modal-body {
    padding: 20px;
}

.modal-footer {
    padding: 20px;
    border-top: 1px solid #ddd;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

.form-group {
    margin-bottom: 15px;
}

.form-group label {
    display: block;
    margin-bottom: 5px;
    font-weight: bold;
}

.form-group input {
    width: 100%;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    box-sizing: border-box;
}

.medicion-summary {
    background-color: #f8f9fa;
    padding: 10px;
    border-radius: 4px;
    border-left: 4px solid #007bff;
}

.close {
    font-size: 24px;
    font-weight: bold;
    cursor: pointer;
    color: #aaa;
}

.close:hover {
    color: #000;
}

.error-message, .success-message {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px;
    border-radius: 4px;
    color: white;
    z-index: 1001;
    max-width: 400px;
}

.error-message {
    background-color: #dc3545;
}

.success-message {
    background-color: #28a745;
}

.loader-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0,0,0,0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1002;
}

.loader-content {
    background-color: white;
    padding: 30px;
    border-radius: 8px;
    text-align: center;
}

.spinner {
    border: 4px solid #f3f3f3;
    border-top: 4px solid #3498db;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 2s linear infinite;
    margin: 0 auto 15px;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
`;

// Exportar funciones para uso en la interfaz
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        enviarMedicionAlLaboratorio,
        mostrarInformacionEnvio,
        mostrarIndicadorCarga,
        ocultarIndicadorCarga,
        mostrarError,
        mostrarExito,
        enviarAlLaboratorio,
        confirmarEnvio,
        cerrarModal,
        ejemploHTML,
        ejemploCSS
    };
}

console.log('📧 Ejemplo de integración de envío al laboratorio cargado');
console.log('💡 Usa las funciones exportadas para integrar en tu interfaz');
