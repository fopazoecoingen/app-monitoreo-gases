// DOM Elements
const portInput = document.getElementById('portInput');
const slaveIdInput = document.getElementById('slaveIdInput');
const intervalInput = document.getElementById('intervalInput');
const connectBtn = document.getElementById('connectBtn');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const loadingOverlay = document.getElementById('loadingOverlay');
const toast = document.getElementById('toast');

// Tab management
let currentTab = 'realtime';

// Gas value elements (only for monitoring view now)
// const o2Value = document.getElementById('o2Value'); // Removed from main view
// const coValue = document.getElementById('coValue'); // Removed from main view  
// const ch4Value = document.getElementById('ch4Value'); // Removed from main view
// Calibration elements (only used in monitoring view now)
const calibrationStatus = document.getElementById('calibrationStatus');
const lastEvent = document.getElementById('lastEvent');
const totalReadingsElement = document.getElementById('totalReadings');
const totalEventsElement = document.getElementById('totalEvents');
const excelFileStatus = document.getElementById('excelFileStatus');
const connectionStatusInfo = document.getElementById('connectionStatusInfo');
const settingsExcelPath = document.getElementById('settingsExcelPath');
const settingsSelectPathBtn = document.getElementById('settingsSelectPathBtn');

// Gas selection elements (main tab)
const monitorO2MainCheckbox = document.getElementById('monitorO2Main');
const monitorCOMainCheckbox = document.getElementById('monitorCOMain');
const monitorCH4MainCheckbox = document.getElementById('monitorCH4Main');
const monitorCO2MainCheckbox = document.getElementById('monitorCO2Main');
const saveSettingsBtn = document.getElementById('saveSettings');

// Monitoring view elements
const stopMonitoringBtn = document.getElementById('stopMonitoringBtn');
const exitMonitoringBtn = document.getElementById('exitMonitoringBtn');
const monitoringTimeElement = document.getElementById('monitoringTime');
const monitoringDataCountElement = document.getElementById('monitoringDataCount');
const monitoringLastReadingElement = document.getElementById('monitoringLastReading');
const monitoringGasCardsContainer = document.getElementById('monitoringGasCards');
const monitoringChartContainer = document.getElementById('monitoringChartContainer');

// Gas detail modal elements
const gasDetailModal = document.getElementById('gasDetailModal');
const modalGasTitle = document.getElementById('modalGasTitle');
const modalGasValue = document.getElementById('modalGasValue');
const modalGasUnit = document.getElementById('modalGasUnit');
const modalGasStatus = document.getElementById('modalGasStatus');
const closeModalBtn = document.getElementById('closeModalBtn');
const gasEventLog = document.getElementById('gasEventLog');

// Gas detail chart and data
let gasDetailChart = null;
let currentGasType = null;
let gasEventHistory = [];

// Verify elements exist
// Elements removed from UI in compact layout; guard silently
if (!totalReadingsElement) {
    // console.error('totalReadingsElement not found'); // Comentado - elemento no existe
}
if (!totalEventsElement) {
    // console.error('totalEventsElement not found'); // Comentado - elemento no existe
}
if (!excelFileStatus) {
    console.error('excelFileStatus element not found');
}
if (!connectionStatusInfo) {
    console.error('connectionStatusInfo element not found');
}

// Tab elements
const menuItems = document.querySelectorAll('.menu-item');
const tabPanes = document.querySelectorAll('.tab-pane');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');

// State
let isConnected = false;
let isReading = false;
let dataHistory = [];
let currentCalibrationEvent = 'Normal';
let totalEvents = 0;
let totalReadings = 0;

// Monitoring view state
let monitoringStartTime = null;
let monitoringTimer = null;
let monitoringDataCount = 0;
let monitoringCharts = {};

// Chart instances
let o2Chart = null;
let coChart = null;
let ch4Chart = null;
let co2Chart = null;

// Chart data
const maxDataPoints = 50; // Máximo de puntos en el gráfico
let chartData = {
    labels: [],
    o2: [],
    co: [],
    ch4: [],
    co2: []
};

// Reference lines for each gas
let referenceLines = {
    o2: null,
    co: null,
    ch4: null,
    co2: null
};

// Calibration phases and commands
let currentCalibrationPhase = 'initial';
const calibrationPhases = {
    initial: {
        name: 'Calibración Inicial',
        commands: ['ZERO', 'SPAN', 'MEDIO'],
        description: 'zero c1, spam c1, medio c1, zero c2i, spam c2i, medio c2i'
    },
    intermediate: {
        name: 'Calibración Intermedia',
        commands: ['INICIO_MEDICION_1', 'TERMINO_1ERA_CORRIDA', 'ZERO_C2_INT', 'SPAN_C2_INT', 'MEDIO_C2_INT'],
        description: 'Inicio Medicion 1, Termino 1era Corrida, zero c2 int, spam c2 int, medio c2 int'
    },
    final: {
        name: 'Calibración Final',
        commands: ['INICIO_MEDICION_2', 'TERMINO_2DA_CORRIDA', 'ZERO_C2_F', 'SPAN_C2_F', 'MEDIO_C2_F'],
        description: 'Inicio Medicion 2, Termino 2da Corrida, zero c2 f, spam c2 f, medio c2 f'
    }
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
});

async function initializeApp() {
    updateStatus('disconnected');
    
    // Inicializar gráficos
    initializeCharts();
    
    // Actualizar información del archivo
    updateFileInfo();
    
    // Cargar configuración de gases
    await loadGasConfiguration();
    
    // Sidebar is now fixed, no initialization needed
    
    // Auto-conectar al iniciar la aplicación
    try {
        showLoading('Conectando automáticamente...');
        const result = await window.electronAPI.autoConnect();
        
        if (result.success) {
            updateStatus('connected');
            updatePortDisplay(result.port, result.slaveId);
            showToast('success', `Conectado automáticamente a ${result.port}`);
            enableReadingControls();
        } else {
            showToast('error', `Error de auto-conexión: ${result.error}`);
        }
    } catch (error) {
        showToast('error', `Error de auto-conexión: ${error.message}`);
    } finally {
        hideLoading();
    }
}

function setupEventListeners() {
    // Connection management
    connectBtn.addEventListener('click', connectToPort);
    
    // Reading control
    startBtn.addEventListener('click', startReading);
    stopBtn.addEventListener('click', stopReading);
    
    // Calibration buttons (only in monitoring view now)
    
    // File path selection
    settingsSelectPathBtn.addEventListener('click', selectExcelFolder);
    
    // Settings save
    saveSettingsBtn.addEventListener('click', saveSettings);
    
    // Gas selection change handlers (main tab)
    if (monitorO2MainCheckbox) monitorO2MainCheckbox.addEventListener('change', handleGasSelectionChange);
    if (monitorCOMainCheckbox) monitorCOMainCheckbox.addEventListener('change', handleGasSelectionChange);
    if (monitorCH4MainCheckbox) monitorCH4MainCheckbox.addEventListener('change', handleGasSelectionChange);
    if (monitorCO2MainCheckbox) monitorCO2MainCheckbox.addEventListener('change', handleGasSelectionChange);
    
    // Reference line controls
    setupReferenceControls();
    
    // Initialize calibration phase
    initializeCalibrationPhase();
    
    // Monitoring view handlers
    if (stopMonitoringBtn) stopMonitoringBtn.addEventListener('click', stopMonitoringFromView);
    if (exitMonitoringBtn) exitMonitoringBtn.addEventListener('click', exitMonitoringView);
    
    // View graphs button
    const viewGraphsBtn = document.getElementById('viewGraphsBtn');
    if (viewGraphsBtn) {
        viewGraphsBtn.addEventListener('click', () => switchTab('graphs'));
    }
    
    // Calibration phase selector
    const calibrationPhaseSelect = document.getElementById('calibrationPhase');
    if (calibrationPhaseSelect) {
        calibrationPhaseSelect.addEventListener('change', handleCalibrationPhaseChange);
    }
    
    // Monitoring calibration buttons
    // Global calibration buttons removed - using gas-specific buttons instead
    
    // Sidebar toggle
    sidebarToggleBtn.addEventListener('click', toggleSidebar);
    
    // Gas detail modal handlers
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeGasDetailModal);
    }
    
    // Close modal when clicking outside
    if (gasDetailModal) {
        gasDetailModal.addEventListener('click', (e) => {
            if (e.target === gasDetailModal) {
                closeGasDetailModal();
            }
        });
    }
    
    // Close sidebar when clicking overlay
    sidebarOverlay.addEventListener('click', closeSidebar);
    
    // Menu navigation
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(item.dataset.tab);
            
            // Close sidebar after selecting a menu item
            closeSidebar();
        });
    });
    
    // Data update listeners
    window.electronAPI.onDataUpdate((event, data) => {
        console.log('🎯 Evento data-update recibido:', data);
        updateGasValues(data);
        updateDataCount();
        
        // Update monitoring view if active
        const monitoringTab = document.getElementById('monitoring-view-tab');
        if (monitoringTab && monitoringTab.classList.contains('active')) {
            updateMonitoringView(data);
        }
    });
    
    // Measurement started listener
    window.electronAPI.onMeasurementStarted((event, data) => {
        showMeasurementStartedNotification(data.measurementId);
    });
    
    // Measurement completed listener
    window.electronAPI.onMeasurementCompleted((event, data) => {
        showMeasurementCompletedNotification(data);
    });
    
    window.electronAPI.onDataError((event, error) => {
        showToast('error', `Error de lectura: ${error}`);
    });
}

// Removed loadSerialPorts function - not needed in new design

async function connectToPort() {
    const selectedPort = portInput.value;
    const slaveId = slaveIdInput.value;
    
    if (!selectedPort) {
        showToast('warning', 'Ingresa un puerto serie');
        return;
    }
    
    try {
        showLoading(true);
        const result = await window.electronAPI.connectSerial(selectedPort, 9600);
        
        if (result.success) {
            updateStatus('connected');
            showToast('success', 'Conectado exitosamente');
            
            // Update UI
            connectBtn.disabled = true;
            startBtn.disabled = false;
            portInput.disabled = true;
            slaveIdInput.disabled = true;
        }
    } catch (error) {
        showToast('error', 'Error de conexión');
    } finally {
        hideLoading();
    }
}

// Removed disconnectFromPort function - not needed in new design

async function startReading() {
    try {
        showLoading(true);
        const result = await window.electronAPI.startReading();
        
        if (result.success) {
            isReading = true;
            showToast('success', 'Monitoreo iniciado');
            
            // Update UI
            startBtn.disabled = true;
            stopBtn.disabled = false;
            updateGasStatus('reading');
            
            // Navigate to monitoring view
            switchToMonitoringView();
        }
    } catch (error) {
        showToast('error', 'Error al iniciar monitoreo');
    } finally {
        hideLoading();
    }
}

async function stopReading() {
    try {
        showLoading(true);
        const result = await window.electronAPI.stopReading();
        
        if (result.success) {
            isReading = false;
            showToast('info', 'Monitoreo detenido');
            
            // Update UI
            startBtn.disabled = false;
            stopBtn.disabled = true;
            updateGasStatus('waiting');
        }
    } catch (error) {
        showToast('error', 'Error al detener monitoreo');
    } finally {
        hideLoading();
    }
}

function updateStatus(status) {
    const statusDot = statusIndicator.querySelector('.status-dot');
    const sidebarStatusDot = document.getElementById('sidebarStatusIndicator').querySelector('.status-dot');
    const sidebarStatusText = document.getElementById('sidebarStatusText');
    
    if (status === 'connected') {
        if (statusDot) statusDot.classList.add('connected');
        if (statusText) statusText.textContent = 'Conectado';
        if (statusIndicator) statusIndicator.classList.add('connected');
        if (sidebarStatusDot) sidebarStatusDot.style.backgroundColor = '#00e676';
        if (sidebarStatusText) sidebarStatusText.textContent = 'Conectado';
        if (connectionStatusInfo) connectionStatusInfo.textContent = 'Conectado';
        isConnected = true;
    } else {
        if (statusDot) statusDot.classList.remove('connected');
        if (statusText) statusText.textContent = 'Desconectado';
        if (statusIndicator) statusIndicator.classList.remove('connected');
        if (sidebarStatusDot) sidebarStatusDot.style.backgroundColor = '#ff6b35';
        if (sidebarStatusText) sidebarStatusText.textContent = 'Desconectado';
        if (connectionStatusInfo) connectionStatusInfo.textContent = 'Desconectado';
        isConnected = false;
    }
}

function updateGasValues(data) {
    console.log('📊 updateGasValues llamado con datos:', data);
    console.log('📊 Estructura de datos recibida:', {
        o2: data.o2,
        co: data.co,
        ch4: data.ch4,
        co2: data.co2,
        fecha: data.fecha,
        hora: data.hora,
        eventType: data.eventType
    });
    
    // Actualizar las tarjetas de lecturas en tiempo real
    updateReadingCards(data);
    
    // Actualizar gráficos
    updateCharts(data);
}

function updateReadingCards(data) {
    console.log('🔄 updateReadingCards llamado con datos:', data);
    
    const now = new Date();
    const timeString = now.toLocaleTimeString('es-CL', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
    
    console.log('⏰ Tiempo formateado:', timeString);
    
    // Actualizar O2
    const o2ValueElement = document.getElementById('o2Value');
    const o2TimeElement = document.getElementById('o2Time');
    const o2Card = document.getElementById('o2ReadingCard');
    
    console.log('🔍 Elementos O2 encontrados:', {
        value: !!o2ValueElement,
        time: !!o2TimeElement,
        card: !!o2Card,
        dataO2: data.o2
    });
    
    if (o2ValueElement && data.o2 !== undefined) {
        o2ValueElement.textContent = data.o2.toFixed(2);
        if (o2TimeElement) o2TimeElement.textContent = timeString;
        if (o2Card) o2Card.classList.add('o2-card');
        console.log('✅ O2 actualizado:', data.o2.toFixed(2));
    } else {
        console.log('❌ O2 no actualizado - elemento:', !!o2ValueElement, 'dato:', data.o2);
    }
    
    // Actualizar CO
    const coValueElement = document.getElementById('coValue');
    const coTimeElement = document.getElementById('coTime');
    const coCard = document.getElementById('coReadingCard');
    
    console.log('🔍 Elementos CO encontrados:', {
        value: !!coValueElement,
        time: !!coTimeElement,
        card: !!coCard,
        dataCO: data.co
    });
    
    if (coValueElement && data.co !== undefined) {
        coValueElement.textContent = data.co.toFixed(2);
        if (coTimeElement) coTimeElement.textContent = timeString;
        if (coCard) coCard.classList.add('co-card');
        console.log('✅ CO actualizado:', data.co.toFixed(2));
    } else {
        console.log('❌ CO no actualizado - elemento:', !!coValueElement, 'dato:', data.co);
    }
    
    // Actualizar CH4
    const ch4ValueElement = document.getElementById('ch4Value');
    const ch4TimeElement = document.getElementById('ch4Time');
    const ch4Card = document.getElementById('ch4ReadingCard');
    
    console.log('🔍 Elementos CH4 encontrados:', {
        value: !!ch4ValueElement,
        time: !!ch4TimeElement,
        card: !!ch4Card,
        dataCH4: data.ch4
    });
    
    if (ch4ValueElement && data.ch4 !== undefined) {
        ch4ValueElement.textContent = data.ch4.toFixed(2);
        if (ch4TimeElement) ch4TimeElement.textContent = timeString;
        if (ch4Card) ch4Card.classList.add('ch4-card');
        console.log('✅ CH4 actualizado:', data.ch4.toFixed(2));
    } else {
        console.log('❌ CH4 no actualizado - elemento:', !!ch4ValueElement, 'dato:', data.ch4);
    }
    
    // Actualizar CO2
    const co2ValueElement = document.getElementById('co2Value');
    const co2TimeElement = document.getElementById('co2Time');
    const co2Card = document.getElementById('co2ReadingCard');
    
    console.log('🔍 Elementos CO2 encontrados:', {
        value: !!co2ValueElement,
        time: !!co2TimeElement,
        card: !!co2Card,
        dataCO2: data.co2
    });
    
    if (co2ValueElement && data.co2 !== undefined) {
        co2ValueElement.textContent = data.co2.toFixed(2);
        if (co2TimeElement) co2TimeElement.textContent = timeString;
        if (co2Card) co2Card.classList.add('co2-card');
        console.log('✅ CO2 actualizado:', data.co2.toFixed(2));
    } else {
        console.log('❌ CO2 no actualizado - elemento:', !!co2ValueElement, 'dato:', data.co2);
    }
}

function updateCO2Value(data, timeString) {
    const co2ValueElement = document.getElementById('co2Value');
    const co2TimeElement = document.getElementById('co2Time');
    const co2Card = document.getElementById('co2ReadingCard');
    
    console.log('🔍 Elementos CO2 encontrados:', {
        value: !!co2ValueElement,
        time: !!co2TimeElement,
        card: !!co2Card,
        dataCO2: data.co2
    });
    
    if (co2ValueElement && data.co2 !== undefined) {
        co2ValueElement.textContent = data.co2.toFixed(2);
        if (co2TimeElement) co2TimeElement.textContent = timeString;
        if (co2Card) co2Card.classList.add('co2-card');
        console.log('✅ CO2 actualizado:', data.co2.toFixed(2));
    } else {
        console.log('❌ CO2 no actualizado - elemento:', !!co2ValueElement, 'dato:', data.co2);
    }
}

function updateDataCount() {
    if (totalReadingsElement) {
        const count = parseInt(totalReadingsElement.textContent) + 1;
        totalReadingsElement.textContent = count;
    }
}

async function markCalibrationEvent(eventType) {
    try {
        // Create event with phase information
        const phaseEvent = `${currentCalibrationPhase.toUpperCase()}_${eventType}`;
        
        // Send event to main process
        await window.electronAPI.setCalibrationEvent(phaseEvent);
        
        currentCalibrationEvent = phaseEvent;
        totalEvents++;
        calibrationEventCount++;
        lastCalibrationEvent = phaseEvent.replace(/_/g, ' ');
        
        // Update UI - check if elements exist
        if (calibrationStatus) {
            calibrationStatus.textContent = phaseEvent.replace(/_/g, ' ');
        }
        if (lastEvent) {
            lastEvent.textContent = phaseEvent.replace(/_/g, ' ');
        }
        if (totalEventsElement) {
            totalEventsElement.textContent = totalEvents;
        }
        
        // Update calibration status display
        updateCalibrationStatus();
        
        // Visual feedback - check if we're in monitoring view
        const monitoringTab = document.getElementById('monitoring-view-tab');
        if (monitoringTab && monitoringTab.classList.contains('active')) {
            // Global buttons removed - feedback handled by gas-specific buttons
            console.log(`Evento de calibración registrado: ${phaseEvent}`);
        }
        
        showToast('success', `Evento marcado: ${phaseEvent.replace(/_/g, ' ')}`);
        
        // Reset to Normal after 3 seconds (solo en la UI, no en el backend)
        setTimeout(() => {
            currentCalibrationEvent = 'Normal';
            if (calibrationStatus) {
                calibrationStatus.textContent = 'Normal';
            }
            // No enviar Normal al backend para evitar sobrescribir el evento
        }, 3000);
        
    } catch (error) {
        showToast('error', `Error al marcar evento: ${error.message}`);
    }
}

function getEventColor(eventType) {
    const colors = {
        'Normal': null, // No color (default)
        'ZERO': '#FF6B35', // Orange
        'SPAN': '#4CAF50', // Green
        'INICIO_GAS_PATRON': '#2196F3', // Blue
        'FIN_INYECCION_GAS': '#9C27B0' // Purple
    };
    return colors[eventType] || null;
}

async function updateFileInfo() {
    try {
        const filePath = await window.electronAPI.getExcelFileInfo();
        if (excelFileStatus) {
            excelFileStatus.textContent = filePath;
        }
        if (settingsExcelPath) {
            settingsExcelPath.value = filePath;
        }
    } catch (error) {
        if (excelFileStatus) {
            excelFileStatus.textContent = 'Error al obtener ruta del archivo';
        }
        if (settingsExcelPath) {
            settingsExcelPath.value = 'Error al obtener ruta';
        }
    }
}

async function selectExcelFolder() {
    try {
        console.log('Solicitando selección de carpeta...');
        const result = await window.electronAPI.selectExcelFolder();
        console.log('Resultado recibido:', result);
        
        if (result.success) {
            if (settingsExcelPath) {
                settingsExcelPath.value = result.path;
            }
            if (excelFileStatus) {
                excelFileStatus.textContent = result.path;
            }
            showToast('success', `Carpeta seleccionada: ${result.path}`);
        } else {
            console.log('Error en selección:', result.message || result.error);
            // Solo mostrar advertencia si hay un error real, no si se canceló
            if (result.error) {
                showToast('error', `Error: ${result.error}`);
            } else if (result.cancelled) {
                console.log('Selección cancelada por el usuario');
                // No mostrar mensaje si se canceló
            } else {
                showToast('warning', result.message || 'No se pudo seleccionar la carpeta');
            }
        }
    } catch (error) {
        console.error('Error al seleccionar carpeta:', error);
        showToast('error', `Error al seleccionar carpeta: ${error.message}`);
    }
}

function updateGasStatus(status) {
    const statusElements = document.querySelectorAll('.gas-status span');
    statusElements.forEach(element => {
        if (status === 'reading') {
            element.textContent = 'Leyendo...';
        } else if (status === 'waiting') {
            element.textContent = 'Esperando...';
        }
    });
}

function switchTab(tabName) {
    // Remove active class from all menu items and panes
    menuItems.forEach(item => item.classList.remove('active'));
    tabPanes.forEach(pane => pane.classList.remove('active'));
    
    // Add active class to selected menu item and pane
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Update current tab
    currentTab = tabName;
    
    // Initialize mediciones manager if switching to mediciones tab
    if (tabName === 'mediciones' && !window.medicionesManager) {
        setTimeout(() => {
            if (typeof MedicionesManager !== 'undefined') {
                window.medicionesManager = new MedicionesManager();
            }
        }, 100);
    }
}

function toggleSidebar() {
    sidebar.classList.toggle('show');
    sidebarOverlay.classList.toggle('show');
}

function closeSidebar() {
    sidebar.classList.remove('show');
    sidebarOverlay.classList.remove('show');
}

function resetReadingCards() {
    // Reset O2 card
    const o2ValueElement = document.getElementById('o2Value');
    const o2TimeElement = document.getElementById('o2Time');
    const o2Card = document.getElementById('o2ReadingCard');
    
    if (o2ValueElement) o2ValueElement.textContent = '--';
    if (o2TimeElement) o2TimeElement.textContent = '--:--:--';
    if (o2Card) o2Card.classList.remove('o2-card');
    
    // Reset CO card
    const coValueElement = document.getElementById('coValue');
    const coTimeElement = document.getElementById('coTime');
    const coCard = document.getElementById('coReadingCard');
    
    if (coValueElement) coValueElement.textContent = '--';
    if (coTimeElement) coTimeElement.textContent = '--:--:--';
    if (coCard) coCard.classList.remove('co-card');
    
    // Reset CH4 card
    const ch4ValueElement = document.getElementById('ch4Value');
    const ch4TimeElement = document.getElementById('ch4Time');
    const ch4Card = document.getElementById('ch4ReadingCard');
    
    if (ch4ValueElement) ch4ValueElement.textContent = '--';
    if (ch4TimeElement) ch4TimeElement.textContent = '--:--:--';
    if (ch4Card) ch4Card.classList.remove('ch4-card');
}

function clearGasValues() {
    // Limpiar tarjetas de lecturas
    resetReadingCards();
}

// Removed unused functions for cleaner code

function showLoading(message = 'Procesando...') {
    const loadingText = loadingOverlay.querySelector('p');
    if (loadingText) {
        loadingText.textContent = message;
    }
    loadingOverlay.classList.add('show');
}

function hideLoading() {
    loadingOverlay.classList.remove('show');
}

function updatePortDisplay(port, slaveId) {
    portInput.value = port;
    slaveIdInput.value = slaveId;
}

function enableReadingControls() {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    connectBtn.disabled = true;
    portInput.disabled = true;
    slaveIdInput.disabled = true;
    
    // Calibration buttons are now only available in monitoring view
}

function showToast(type, message) {
    const toastIcon = toast.querySelector('.toast-icon');
    const toastMessage = toast.querySelector('.toast-message');
    
    // Set icon based on type
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    toastIcon.className = `toast-icon ${icons[type] || icons.info}`;
    toastMessage.textContent = message;
    
    // Show toast
    toast.className = `toast ${type} show`;
    
    // Hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showMeasurementStartedNotification(measurementId) {
    const notification = document.createElement('div');
    notification.className = 'measurement-notification started';
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-play-circle"></i>
            <div class="notification-text">
                <strong>Medición Iniciada</strong>
                <span>ID: ${measurementId}</span>
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

function showMeasurementCompletedNotification(data) {
    const notification = document.createElement('div');
    notification.className = 'measurement-notification completed';
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-check-circle"></i>
            <div class="notification-text">
                <strong>Medición Completada</strong>
                <span>ID: ${data.measurementId} | Duración: ${data.duration}s | Lecturas: ${data.totalReadings}</span>
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// Calibration Phase Functions
let calibrationEventCount = 0;
let lastCalibrationEvent = null;

function initializeCalibrationPhase() {
    // Set initial phase
    currentCalibrationPhase = 'initial';
    
    // Update UI
    updateCalibrationPhaseInfo();
    updateCalibrationButtons();
    updateCalibrationStatus();
    
    // Update gas-specific buttons
    updateGasButtonsForCurrentPhase();
}

function handleCalibrationPhaseChange(event) {
    const selectedPhase = event.target.value;
    currentCalibrationPhase = selectedPhase;
    
    // Update phase info display
    updateCalibrationPhaseInfo();
    
    // Update button labels based on phase
    updateCalibrationButtons();
    
    // Update gas-specific buttons
    updateGasButtonsForCurrentPhase();
    
    showToast('info', `Fase cambiada a: ${calibrationPhases[selectedPhase].name}`);
}

function updateCalibrationPhaseInfo() {
    const currentPhaseInfo = document.getElementById('currentPhaseInfo');
    const phaseCommandsInfo = document.getElementById('phaseCommandsInfo');
    
    if (currentPhaseInfo) {
        currentPhaseInfo.textContent = `Fase: ${calibrationPhases[currentCalibrationPhase].name}`;
    }
    
    if (phaseCommandsInfo) {
        phaseCommandsInfo.textContent = `Comandos: ${calibrationPhases[currentCalibrationPhase].commands.join(', ')}`;
    }
}

function updateCalibrationButtons() {
    // Global calibration buttons removed - using gas-specific buttons instead
    // This function is kept for compatibility but does nothing
}

function updateGasButtonsForCurrentPhase() {
    const phase = calibrationPhases[currentCalibrationPhase];
    if (!phase) return;
    
    // Mapeo de comandos a iconos y estilos
    const commandConfig = {
        'ZERO': { icon: 'fas fa-circle', class: 'zero', color: '#ff6b35' },
        'SPAN': { icon: 'fas fa-adjust', class: 'span', color: '#4caf50' },
        'MEDIO': { icon: 'fas fa-adjust', class: 'span', color: '#4caf50' },
        'INICIO_MEDICION_1': { icon: 'fas fa-play-circle', class: 'start-gas', color: '#2196f3' },
        'INICIO_MEDICION_2': { icon: 'fas fa-play-circle', class: 'start-gas', color: '#2196f3' },
        'TERMINO_1ERA_CORRIDA': { icon: 'fas fa-stop-circle', class: 'end-injection', color: '#9c27b0' },
        'TERMINO_2DA_CORRIDA': { icon: 'fas fa-stop-circle', class: 'end-injection', color: '#9c27b0' },
        'ZERO_C2_INT': { icon: 'fas fa-circle', class: 'zero', color: '#ff6b35' },
        'SPAN_C2_INT': { icon: 'fas fa-adjust', class: 'span', color: '#4caf50' },
        'MEDIO_C2_INT': { icon: 'fas fa-adjust', class: 'span', color: '#4caf50' },
        'ZERO_C2_F': { icon: 'fas fa-circle', class: 'zero', color: '#ff6b35' },
        'SPAN_C2_F': { icon: 'fas fa-adjust', class: 'span', color: '#4caf50' },
        'MEDIO_C2_F': { icon: 'fas fa-adjust', class: 'span', color: '#4caf50' }
    };
    
    // Actualizar botones para cada gas
    const gasIds = ['monitoring-o2', 'monitoring-co', 'monitoring-ch4', 'monitoring-co2'];
    
    gasIds.forEach(gasId => {
        const actionsContainer = document.getElementById(`${gasId}-actions`);
        if (!actionsContainer) return;
        
        // Limpiar botones existentes
        actionsContainer.innerHTML = '';
        
        // Crear botones según los comandos de la fase actual
        phase.commands.forEach(command => {
            const config = commandConfig[command];
            if (!config) return;
            
            const button = document.createElement('button');
            button.className = `btn btn-calibration ${config.class}`;
            button.setAttribute('data-gas', gasId);
            button.setAttribute('data-action', command);
            button.style.backgroundColor = config.color;
            button.innerHTML = `<i class="${config.icon}"></i> ${command.replace(/_/g, ' ')}`;
            
            actionsContainer.appendChild(button);
        });
    });
}

function updateCalibrationStatus() {
    const statusElement = document.getElementById('calibrationStatus');
    const lastEventElement = document.getElementById('lastEvent');
    const totalEventsElement = document.getElementById('totalEvents');
    
    if (statusElement) {
        statusElement.textContent = 'Normal';
    }
    
    if (lastEventElement) {
        lastEventElement.textContent = lastCalibrationEvent || '-';
    }
    
    if (totalEventsElement) {
        totalEventsElement.textContent = calibrationEventCount.toString();
    }
}

// Reference Line Functions
function setupReferenceControls() {
    // Load saved reference values
    loadReferenceValues();
    
    // Setup event listeners for reference controls
    const referenceControls = [
        { input: 'o2Reference', button: 'setO2Reference', gas: 'o2' },
        { input: 'coReference', button: 'setCOReference', gas: 'co' },
        { input: 'ch4Reference', button: 'setCH4Reference', gas: 'ch4' },
        { input: 'co2Reference', button: 'setCO2Reference', gas: 'co2' }
    ];
    
    referenceControls.forEach(control => {
        const input = document.getElementById(control.input);
        const button = document.getElementById(control.button);
        
        if (input && button) {
            button.addEventListener('click', () => setReferenceLine(control.gas, input.value));
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    setReferenceLine(control.gas, input.value);
                }
            });
        }
    });
}

function setReferenceLine(gas, value) {
    if (!value || isNaN(parseFloat(value))) {
        showToast('warning', 'Ingresa un valor válido para la línea de referencia');
        return;
    }
    
    const refValue = parseFloat(value);
    referenceLines[gas] = refValue;
    
    // Save to localStorage
    localStorage.setItem(`reference_${gas}`, refValue.toString());
    
    // Update chart with reference line
    updateChartWithReference(gas, refValue);
    
    showToast('success', `Línea de referencia ${gas.toUpperCase()} establecida en ${refValue}`);
}

function loadReferenceValues() {
    const gases = ['o2', 'co', 'ch4', 'co2'];
    
    gases.forEach(gas => {
        const savedValue = localStorage.getItem(`reference_${gas}`);
        if (savedValue) {
            referenceLines[gas] = parseFloat(savedValue);
            const input = document.getElementById(`${gas}Reference`);
            if (input) {
                input.value = savedValue;
            }
        }
    });
}

function updateChartWithReference(gas, refValue) {
    const chartMap = {
        'o2': o2Chart,
        'co': coChart,
        'ch4': ch4Chart,
        'co2': co2Chart
    };
    
    const chart = chartMap[gas];
    if (!chart) return;
    
    // Remove existing reference line if any
    const existingRefIndex = chart.data.datasets.findIndex(dataset => dataset.label.includes('Referencia'));
    if (existingRefIndex !== -1) {
        chart.data.datasets.splice(existingRefIndex, 1);
    }
    
    // Add reference line dataset
    const refDataset = {
        label: `Referencia ${gas.toUpperCase()}`,
        data: new Array(chart.data.labels.length).fill(refValue),
        borderColor: '#ff9800',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        tension: 0
    };
    
    chart.data.datasets.push(refDataset);
    chart.update('none');
}

// Chart Functions
function initializeCharts() {
    // Configuración común para todos los gráficos
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {
                    color: '#e0e0e0'
                }
            }
        },
        scales: {
            x: {
                ticks: {
                    color: '#888'
                },
                grid: {
                    color: '#4a4a4a'
                }
            },
            y: {
                ticks: {
                    color: '#888'
                },
                grid: {
                    color: '#4a4a4a'
                }
            }
        }
    };

    // Gráfico O₂
    const o2Ctx = document.getElementById('o2Chart').getContext('2d');
    o2Chart = new Chart(o2Ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'O₂ (%Vol)',
                data: chartData.o2,
                borderColor: '#00b0ff',
                backgroundColor: 'rgba(0, 176, 255, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    title: {
                        display: true,
                        text: '%Vol',
                        color: '#888'
                    }
                }
            }
        }
    });
    
    // Add reference line if exists
    if (referenceLines.o2 !== null) {
        updateChartWithReference('o2', referenceLines.o2);
    }

    // Gráfico CO
    const coCtx = document.getElementById('coChart').getContext('2d');
    coChart = new Chart(coCtx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'CO (ppm)',
                data: chartData.co,
                borderColor: '#ff6b35',
                backgroundColor: 'rgba(255, 107, 53, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    title: {
                        display: true,
                        text: 'ppm',
                        color: '#888'
                    }
                }
            }
        }
    });
    
    // Add reference line if exists
    if (referenceLines.co !== null) {
        updateChartWithReference('co', referenceLines.co);
    }

    // Gráfico CH₄
    const ch4Ctx = document.getElementById('ch4Chart').getContext('2d');
    ch4Chart = new Chart(ch4Ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'CH₄ (ppm)',
                data: chartData.ch4,
                borderColor: '#4caf50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    title: {
                        display: true,
                        text: 'ppm',
                        color: '#888'
                    }
                }
            }
        }
    });
    
    // Add reference line if exists
    if (referenceLines.ch4 !== null) {
        updateChartWithReference('ch4', referenceLines.ch4);
    }

    // Gráfico CO₂
    const co2Ctx = document.getElementById('co2Chart').getContext('2d');
    co2Chart = new Chart(co2Ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'CO₂ (%)',
                data: chartData.co2,
                borderColor: '#8bc34a',
                backgroundColor: 'rgba(139, 195, 74, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    title: {
                        display: true,
                        text: '%',
                        color: '#888'
                    }
                }
            }
        }
    });
    
    // Add reference line if exists
    if (referenceLines.co2 !== null) {
        updateChartWithReference('co2', referenceLines.co2);
    }

}

function updateCharts(data) {
    const now = new Date();
    const timeLabel = now.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });

    // Agregar nuevos datos solo para gases seleccionados
    chartData.labels.push(timeLabel);
    if (data.o2 !== undefined) chartData.o2.push(data.o2);
    if (data.co !== undefined) chartData.co.push(data.co);
    if (data.ch4 !== undefined) chartData.ch4.push(data.ch4);
    if (data.co2 !== undefined) chartData.co2.push(data.co2);

    // Mantener solo los últimos maxDataPoints puntos
    if (chartData.labels.length > maxDataPoints) {
        chartData.labels.shift();
        chartData.o2.shift();
        chartData.co.shift();
        chartData.ch4.shift();
        chartData.co2.shift();
    }

    // Actualizar gráficos individuales con líneas de referencia
    updateChartWithDataAndReference('o2', o2Chart, chartData.o2, data.o2);
    updateChartWithDataAndReference('co', coChart, chartData.co, data.co);
    updateChartWithDataAndReference('ch4', ch4Chart, chartData.ch4, data.ch4);
    updateChartWithDataAndReference('co2', co2Chart, chartData.co2, data.co2);
}

function updateChartWithDataAndReference(gas, chart, dataArray, newData) {
    if (!chart || newData === undefined) return;
    
    chart.data.labels = chartData.labels;
    chart.data.datasets[0].data = dataArray;
    
    // Update reference line if it exists
    const refIndex = chart.data.datasets.findIndex(dataset => dataset.label.includes('Referencia'));
    if (refIndex !== -1 && referenceLines[gas] !== null) {
        chart.data.datasets[refIndex].data = new Array(chartData.labels.length).fill(referenceLines[gas]);
    }
    
    chart.update('none');

}

// Gas Configuration Functions
async function loadGasConfiguration() {
    try {
        const gasConfig = await window.electronAPI.getSelectedGases();
        
        if (monitorO2MainCheckbox) monitorO2MainCheckbox.checked = gasConfig.o2;
        if (monitorCOMainCheckbox) monitorCOMainCheckbox.checked = gasConfig.co;
        if (monitorCH4MainCheckbox) monitorCH4MainCheckbox.checked = gasConfig.ch4;
        
        // Actualizar la interfaz para mostrar/ocultar gases
        // Gas cards visibility is now handled in monitoring view only
    } catch (error) {
        console.error('Error al cargar configuración de gases:', error);
        showToast('error', 'Error al cargar configuración de gases');
    }
}

async function saveSettings() {
    try {
        const gasConfig = {
            o2: monitorO2MainCheckbox ? monitorO2MainCheckbox.checked : true,
            co: monitorCOMainCheckbox ? monitorCOMainCheckbox.checked : true,
            ch4: monitorCH4MainCheckbox ? monitorCH4MainCheckbox.checked : true
        };
        
        const result = await window.electronAPI.updateSelectedGases(gasConfig);
        
        if (result.success) {
            showToast('success', 'Configuración guardada exitosamente');
            // Gas cards visibility is now handled in monitoring view only
        } else {
            showToast('error', result.error || 'Error al guardar configuración');
        }
    } catch (error) {
        console.error('Error al guardar configuración:', error);
        showToast('error', 'Error al guardar configuración');
    }
}

async function handleGasSelectionChange() {
    try {
        const gasConfig = {
            o2: monitorO2MainCheckbox ? monitorO2MainCheckbox.checked : true,
            co: monitorCOMainCheckbox ? monitorCOMainCheckbox.checked : true,
            ch4: monitorCH4MainCheckbox ? monitorCH4MainCheckbox.checked : true,
            co2: monitorCO2MainCheckbox ? monitorCO2MainCheckbox.checked : true
        };
        
        // Validar que al menos un gas esté seleccionado
        if (!gasConfig.o2 && !gasConfig.co && !gasConfig.ch4 && !gasConfig.co2) {
            showToast('warning', 'Debe seleccionar al menos un gas para monitorear');
            // Revertir el último cambio
            event.target.checked = true;
            return;
        }
        
        const result = await window.electronAPI.updateSelectedGases(gasConfig);
        
        if (result.success) {
            // Gas cards visibility is now handled in monitoring view only
            showToast('success', 'Configuración de gases actualizada');
        } else {
            showToast('error', result.error || 'Error al actualizar configuración');
        }
    } catch (error) {
        console.error('Error al actualizar configuración de gases:', error);
        showToast('error', 'Error al actualizar configuración de gases');
    }
}

// updateGasCardsVisibility function removed - gas cards are now only in monitoring view

// Monitoring View Functions
async function switchToMonitoringView() {
    try {
        // Get current gas configuration
        const gasConfig = await window.electronAPI.getSelectedGases();
        
        // Switch to monitoring view tab
        switchTab('monitoring-view');
        
        // Initialize monitoring view
        initializeMonitoringView(gasConfig);
        
        // Start monitoring timer
        startMonitoringTimer();
        
    } catch (error) {
        console.error('Error switching to monitoring view:', error);
        showToast('error', 'Error al cambiar a vista de monitoreo');
    }
}

function initializeMonitoringView(gasConfig) {
    // Clear existing content
    if (monitoringGasCardsContainer) {
        monitoringGasCardsContainer.innerHTML = '';
    }
    
    if (monitoringChartContainer) {
        monitoringChartContainer.innerHTML = '';
    }
    
    // Create gas cards for selected gases
    createMonitoringGasCards(gasConfig);
    
    // Reset monitoring counters
    monitoringDataCount = 0;
    monitoringStartTime = new Date();
    
    if (monitoringDataCountElement) {
        monitoringDataCountElement.textContent = '0';
    }
    
    if (monitoringLastReadingElement) {
        monitoringLastReadingElement.textContent = '-:-:-';
    }
}

function createMonitoringGasCards(gasConfig) {
    const gasCards = [];
    
    if (gasConfig.o2) {
        gasCards.push({
            id: 'monitoring-o2',
            title: 'O₂ - Oxígeno',
            unit: '%Vol',
            class: 'oxygen',
            color: '#00b0ff'
        });
    }
    
    if (gasConfig.co) {
        gasCards.push({
            id: 'monitoring-co',
            title: 'CO - Monóxido de Carbono',
            unit: 'ppm',
            class: 'carbon-monoxide',
            color: '#ff6b35'
        });
    }
    
    if (gasConfig.ch4) {
        gasCards.push({
            id: 'monitoring-ch4',
            title: 'CH₄ - Metano',
            unit: 'ppm',
            class: 'methane',
            color: '#4caf50'
        });
    }
    
    if (gasConfig.co2) {
        gasCards.push({
            id: 'monitoring-co2',
            title: 'CO₂ - Dióxido de Carbono',
            unit: '%',
            class: 'carbon-dioxide',
            color: '#8bc34a'
        });
    }
    
    gasCards.forEach(gas => {
        const gasCard = document.createElement('div');
        gasCard.className = `monitoring-gas-card ${gas.class}`;
        gasCard.innerHTML = `
            <div class="monitoring-gas-header">
                <div class="monitoring-gas-title">${gas.title}</div>
                <div class="monitoring-gas-unit">${gas.unit}</div>
            </div>
            <div class="monitoring-gas-value" id="${gas.id}-value">--</div>
            <div class="monitoring-gas-trend">
                <i class="fas fa-arrow-up"></i>
                <span>Estable</span>
            </div>
            <div class="monitoring-gas-actions" id="${gas.id}-actions">
                <!-- Los botones se generarán dinámicamente según la fase de calibración -->
            </div>
        `;
        
        // Add click handler to open gas detail modal
        gasCard.addEventListener('click', (e) => {
            // Don't open modal if clicking on buttons
            if (e.target.closest('button')) return;
            openGasDetailModal(gas.id, gas.title, gas.unit);
        });
        
        if (monitoringGasCardsContainer) {
            monitoringGasCardsContainer.appendChild(gasCard);
        }
    });

    // Delegación de eventos para botones por gas
    if (monitoringGasCardsContainer) {
        monitoringGasCardsContainer.addEventListener('click', async (e) => {
            const target = e.target.closest('button[data-gas][data-action]');
            if (!target) return;
            const gasId = target.getAttribute('data-gas');
            const action = target.getAttribute('data-action');
            const gasMap = {
                'monitoring-o2': 'o2',
                'monitoring-co': 'co',
                'monitoring-ch4': 'ch4',
                'monitoring-co2': 'co2'
            };
            const gas = gasMap[gasId];
            if (!gas) return;
            try {
                showLoading('Marcando evento...');
                await window.electronAPI.markGasEvent(gas, action);
                
                // Get current gas value for history
                const gasValueElement = document.getElementById(`${gasId}-value`);
                const currentValue = gasValueElement ? gasValueElement.textContent : '--';
                
                // Add to gas event history
                addGasEventToHistory(action, currentValue);
                
                showToast('success', `Evento ${action} (${gas.toUpperCase()}) marcado`);
            } catch (err) {
                showToast('error', `No se pudo marcar evento: ${err.message}`);
            } finally {
                hideLoading();
            }
        }, { once: true });
        // Re-adjuntar al cambiar vista
        monitoringGasCardsContainer.addEventListener('click', (e) => {
            const target = e.target.closest('button[data-gas][data-action]');
            if (!target) return;
            const gasId = target.getAttribute('data-gas');
            const action = target.getAttribute('data-action');
            const gasMap = {
                'monitoring-o2': 'o2',
                'monitoring-co': 'co',
                'monitoring-ch4': 'ch4',
                'monitoring-co2': 'co2'
            };
            const gas = gasMap[gasId];
            if (!gas) return;
            (async () => {
                try {
                    showLoading('Marcando evento...');
                    await window.electronAPI.markGasEvent(gas, action);
                    
                    // Get current gas value for history
                    const gasValueElement = document.getElementById(`${gasId}-value`);
                    const currentValue = gasValueElement ? gasValueElement.textContent : '--';
                    
                    // Add to gas event history
                    addGasEventToHistory(action, currentValue);
                    
                    showToast('success', `Evento ${action} (${gas.toUpperCase()}) marcado`);
                } catch (err) {
                    showToast('error', `No se pudo marcar evento: ${err.message}`);
                } finally {
                    hideLoading();
                }
            })();
        });
    }
    
    // Generar botones dinámicamente para cada gas
    updateGasButtonsForCurrentPhase();
}

function createMonitoringCharts(gasConfig) {
    // Create a single combined chart for monitoring view
    const chartCanvas = document.createElement('canvas');
    chartCanvas.id = 'monitoringCombinedChart';
    chartCanvas.style.width = '100%';
    chartCanvas.style.height = '100%';
    
    if (monitoringChartContainer) {
        monitoringChartContainer.appendChild(chartCanvas);
        
        const ctx = chartCanvas.getContext('2d');
        
        // Initialize combined chart
        monitoringCharts.combined = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#e0e0e0'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#888' },
                        grid: { color: '#4a4a4a' }
                    },
                    y: {
                        ticks: { color: '#888' },
                        grid: { color: '#4a4a4a' }
                    }
                }
            }
        });
        
        // Add datasets for selected gases
        if (gasConfig.o2) {
            monitoringCharts.combined.data.datasets.push({
                label: 'O₂ (%Vol)',
                data: [],
                borderColor: '#00b0ff',
                backgroundColor: 'rgba(0, 176, 255, 0.1)',
                borderWidth: 2,
                fill: false,
                tension: 0.4
            });
        }
        
        if (gasConfig.co) {
            monitoringCharts.combined.data.datasets.push({
                label: 'CO (ppm)',
                data: [],
                borderColor: '#ff6b35',
                backgroundColor: 'rgba(255, 107, 53, 0.1)',
                borderWidth: 2,
                fill: false,
                tension: 0.4
            });
        }
        
        if (gasConfig.ch4) {
            monitoringCharts.combined.data.datasets.push({
                label: 'CH₄ (ppm)',
                data: [],
                borderColor: '#4caf50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                borderWidth: 2,
                fill: false,
                tension: 0.4
            });
        }
        
        if (gasConfig.co2) {
            monitoringCharts.combined.data.datasets.push({
                label: 'CO₂ (%)',
                data: [],
                borderColor: '#8bc34a',
                backgroundColor: 'rgba(139, 195, 74, 0.1)',
                borderWidth: 2,
                fill: false,
                tension: 0.4
            });
        }
    }
}

function startMonitoringTimer() {
    if (monitoringTimer) {
        clearInterval(monitoringTimer);
    }
    
    monitoringTimer = setInterval(() => {
        if (monitoringStartTime && monitoringTimeElement) {
            const elapsed = new Date() - monitoringStartTime;
            const hours = Math.floor(elapsed / 3600000);
            const minutes = Math.floor((elapsed % 3600000) / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            monitoringTimeElement.textContent = 
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

function updateMonitoringView(data) {
    // Update gas cards
    if (data.o2 !== undefined) {
        const o2ValueElement = document.getElementById('monitoring-o2-value');
        if (o2ValueElement) o2ValueElement.textContent = data.o2.toFixed(3);
        
        // Update detail chart if modal is open for O2
        if (currentGasType === 'o2' && gasDetailModal.style.display === 'block') {
            updateGasDetailChart(data.o2, data.timestamp);
        }
    }
    
    if (data.co !== undefined) {
        const coValueElement = document.getElementById('monitoring-co-value');
        if (coValueElement) coValueElement.textContent = data.co.toFixed(3);
        
        // Update detail chart if modal is open for CO
        if (currentGasType === 'co' && gasDetailModal.style.display === 'block') {
            updateGasDetailChart(data.co, data.timestamp);
        }
    }
    
    if (data.ch4 !== undefined) {
        const ch4ValueElement = document.getElementById('monitoring-ch4-value');
        if (ch4ValueElement) ch4ValueElement.textContent = data.ch4.toFixed(3);
        
        // Update detail chart if modal is open for CH4
        if (currentGasType === 'ch4' && gasDetailModal.style.display === 'block') {
            updateGasDetailChart(data.ch4, data.timestamp);
        }
    }
    
    if (data.co2 !== undefined) {
        const co2ValueElement = document.getElementById('monitoring-co2-value');
        if (co2ValueElement) co2ValueElement.textContent = data.co2.toFixed(3);
        
        // Update detail chart if modal is open for CO2
        if (currentGasType === 'co2' && gasDetailModal.style.display === 'block') {
            updateGasDetailChart(data.co2, data.timestamp);
        }
    }
    
    // Update monitoring info
    monitoringDataCount++;
    if (monitoringDataCountElement) {
        monitoringDataCountElement.textContent = monitoringDataCount.toString();
    }
    
    if (monitoringLastReadingElement && data.hora) {
        monitoringLastReadingElement.textContent = data.hora;
    }
    
    // Update combined chart
    if (monitoringCharts.combined) {
        const now = new Date();
        const timeLabel = now.toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        
        monitoringCharts.combined.data.labels.push(timeLabel);
        
        let datasetIndex = 0;
        if (data.o2 !== undefined) {
            monitoringCharts.combined.data.datasets[datasetIndex].data.push(data.o2);
            datasetIndex++;
        }
        if (data.co !== undefined) {
            monitoringCharts.combined.data.datasets[datasetIndex].data.push(data.co);
            datasetIndex++;
        }
        if (data.ch4 !== undefined) {
            monitoringCharts.combined.data.datasets[datasetIndex].data.push(data.ch4);
            datasetIndex++;
        }
        if (data.co2 !== undefined) {
            monitoringCharts.combined.data.datasets[datasetIndex].data.push(data.co2);
        }
        
        // Keep only last 30 points
        if (monitoringCharts.combined.data.labels.length > 30) {
            monitoringCharts.combined.data.labels.shift();
            monitoringCharts.combined.data.datasets.forEach(dataset => {
                dataset.data.shift();
            });
        }
        
        monitoringCharts.combined.update('none');
    }
}

async function stopMonitoringFromView() {
    try {
        console.log('Iniciando detención de monitoreo desde vista...');
        showLoading(true);
        
        const result = await window.electronAPI.stopReading();
        console.log('Resultado de stopReading:', result);
        
        if (result.success) {
            isReading = false;
            console.log('Monitoreo detenido exitosamente');
            showToast('info', 'Monitoreo detenido');
            
            // Update UI in main view
            if (startBtn) {
                startBtn.disabled = false;
                console.log('Botón iniciar habilitado');
            }
            if (stopBtn) {
                stopBtn.disabled = true;
                console.log('Botón detener deshabilitado');
            }
            updateGasStatus('waiting');
            
            // Stop monitoring timer
            if (monitoringTimer) {
                clearInterval(monitoringTimer);
                monitoringTimer = null;
                console.log('Timer de monitoreo detenido');
            }
            
    // Clean up monitoring charts (no longer needed)
    if (monitoringCharts.combined) {
        monitoringCharts.combined.destroy();
        monitoringCharts.combined = null;
        console.log('Gráficos de monitoreo limpiados');
    }
            
            // Reset monitoring counters
            monitoringDataCount = 0;
            monitoringStartTime = null;
            
            // Switch back to main view
            console.log('Cambiando a vista principal...');
            switchTab('realtime');
            
        } else {
            console.error('Error al detener monitoreo:', result.message);
            showToast('error', result.message || 'Error al detener monitoreo');
        }
    } catch (error) {
        console.error('Error en stopMonitoringFromView:', error);
        showToast('error', 'Error al detener monitoreo');
    } finally {
        hideLoading();
    }
}

function exitMonitoringView() {
    // Stop monitoring timer
    if (monitoringTimer) {
        clearInterval(monitoringTimer);
        monitoringTimer = null;
    }
    
    // Clean up monitoring charts (no longer needed)
    if (monitoringCharts.combined) {
        monitoringCharts.combined.destroy();
        monitoringCharts.combined = null;
    }
    
    // Reset monitoring counters
    monitoringDataCount = 0;
    monitoringStartTime = null;
    
    // Switch back to realtime tab (but keep monitoring running)
    switchTab('realtime');
    
    showToast('info', 'Saliendo de vista de monitoreo (el monitoreo continúa en segundo plano)');
}

// Handle window close
window.addEventListener('beforeunload', () => {
    if (isConnected) {
        window.electronAPI.disconnectSerial();
    }
});

// Handle errors
window.addEventListener('error', (event) => {
    addLogEntry('error', `Error: ${event.error.message}`);
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    addLogEntry('error', `Error no manejado: ${event.reason}`);
});

// ==================== INDICADOR DE CONEXIÓN A INTERNET ====================

class InternetIndicator {
    constructor() {
        this.statusElement = document.getElementById('internetStatus');
        this.iconElement = document.getElementById('statusIcon');
        this.textElement = document.getElementById('statusTextInternet');
        this.latencyElement = document.getElementById('statusLatency');
        this.checkInterval = null;
        this.isChecking = false;
        
        // Verificar conexión inicial
        this.checkConnection();
        
        // Verificar cada 30 segundos
        this.startPeriodicCheck();
    }

    async checkConnection() {
        if (this.isChecking) return;
        
        this.isChecking = true;
        this.updateStatus('checking', '🔄', 'Verificando...', '');

        try {
            const result = await window.electronAPI.checkInternetForIndicator();
            
            if (result.success) {
                if (result.connected) {
                    const latency = result.latency ? `${Math.round(result.latency)}ms` : '';
                    this.updateStatus('connected', '🌐', 'Conectado', latency);
                } else {
                    this.updateStatus('disconnected', '❌', 'Sin conexión', '');
                }
            } else {
                this.updateStatus('disconnected', '❌', 'Error', '');
            }
        } catch (error) {
            console.error('Error verificando conexión:', error);
            this.updateStatus('disconnected', '❌', 'Error', '');
        } finally {
            this.isChecking = false;
        }
    }

    updateStatus(status, icon, text, latency) {
        if (!this.statusElement) return;

        // Remover clases anteriores
        this.statusElement.className = 'internet-status';
        this.iconElement.className = 'status-icon';
        
        // Agregar clase correspondiente
        this.statusElement.classList.add(status);
        if (status === 'checking') {
            this.iconElement.classList.add('checking');
        }
        
        // Actualizar contenido
        if (this.iconElement) this.iconElement.textContent = icon;
        if (this.textElement) this.textElement.textContent = text;
        if (this.latencyElement) this.latencyElement.textContent = latency;
    }

    startPeriodicCheck() {
        // Verificar cada 30 segundos
        this.checkInterval = setInterval(() => {
            this.checkConnection();
        }, 30000);
    }

    stopPeriodicCheck() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    // Método público para verificación manual
    forceCheck() {
        this.checkConnection();
    }
}

// Inicializar indicador de internet cuando se carga la página
let internetIndicator = null;

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar después de un pequeño delay para asegurar que todos los elementos estén listos
    setTimeout(() => {
        internetIndicator = new InternetIndicator();
    }, 1000);
});

// Exponer globalmente para acceso manual
window.internetIndicator = internetIndicator;

// ===== GAS DETAIL MODAL FUNCTIONS =====

function openGasDetailModal(gasId, gasTitle, gasUnit) {
    currentGasType = gasId.replace('monitoring-', '');
    
    // Update modal title and info
    modalGasTitle.textContent = gasTitle;
    modalGasUnit.textContent = gasUnit;
    
    // Get current gas value
    const gasValueElement = document.getElementById(`${gasId}-value`);
    const currentValue = gasValueElement ? gasValueElement.textContent : '--';
    modalGasValue.textContent = currentValue;
    
    // Get current status
    const gasTrendElement = gasValueElement?.parentElement?.querySelector('.monitoring-gas-trend span');
    const currentStatus = gasTrendElement ? gasTrendElement.textContent : 'Estable';
    modalGasStatus.textContent = currentStatus;
    
    // Show modal
    gasDetailModal.style.display = 'block';
    
    // Initialize chart and load history
    initializeGasDetailChart();
    loadGasEventHistory();
}

function closeGasDetailModal() {
    gasDetailModal.style.display = 'none';
    
    // Destroy chart if exists
    if (gasDetailChart) {
        gasDetailChart.destroy();
        gasDetailChart = null;
    }
    
    currentGasType = null;
    gasEventHistory = [];
}

function initializeGasDetailChart() {
    const ctx = document.getElementById('gasDetailChart');
    if (!ctx) return;
    
    // Destroy existing chart
    if (gasDetailChart) {
        gasDetailChart.destroy();
    }
    
    gasDetailChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: getGasDisplayName(currentGasType),
                data: [],
                borderColor: getGasColor(currentGasType),
                backgroundColor: getGasColor(currentGasType) + '20',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#ffffff'
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#aaa',
                        maxTicksLimit: 10,
                        font: {
                            size: 11
                        }
                    },
                    grid: {
                        color: '#333'
                    },
                    title: {
                        display: true,
                        text: 'Tiempo',
                        color: '#ccc',
                        font: {
                            size: 12
                        }
                    }
                },
                y: {
                    ticks: {
                        color: '#aaa',
                        font: {
                            size: 11
                        }
                    },
                    grid: {
                        color: '#333'
                    },
                    title: {
                        display: true,
                        text: 'Valor',
                        color: '#ccc',
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });
}

function updateGasDetailChart(value, timestamp) {
    if (!gasDetailChart || !currentGasType) return;
    
    const chart = gasDetailChart;
    const now = new Date(timestamp || Date.now());
    const timeLabel = now.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    // Add new data point
    chart.data.labels.push(timeLabel);
    chart.data.datasets[0].data.push(parseFloat(value));
    
    // Keep only last 50 data points
    if (chart.data.labels.length > 50) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }
    
    chart.update('none');
}

function loadGasEventHistory() {
    if (!currentGasType) return;
    
    // Clear existing events
    gasEventLog.innerHTML = '';
    
    // Load events from localStorage
    const events = JSON.parse(localStorage.getItem(`gasEvents_${currentGasType}`) || '[]');
    
    if (events.length === 0) {
        gasEventLog.innerHTML = '<div class="event-item">No hay eventos registrados</div>';
        return;
    }
    
    // Display events (most recent first)
    events.reverse().forEach(event => {
        const eventItem = document.createElement('div');
        eventItem.className = 'event-item';
        const eventDate = new Date(event.timestamp);
        const timeString = eventDate.toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        eventItem.innerHTML = `
            <span class="event-time">${timeString}</span>
            <span class="event-type">${event.type}</span>
            <span class="event-value">${event.value}</span>
        `;
        gasEventLog.appendChild(eventItem);
    });
}

function addGasEventToHistory(eventType, value, timestamp) {
    if (!currentGasType) return;
    
    const event = {
        type: eventType,
        value: value,
        timestamp: timestamp || Date.now()
    };
    
    // Load existing events
    const events = JSON.parse(localStorage.getItem(`gasEvents_${currentGasType}`) || '[]');
    
    // Add new event
    events.push(event);
    
    // Keep only last 100 events
    if (events.length > 100) {
        events.shift();
    }
    
    // Save back to localStorage
    localStorage.setItem(`gasEvents_${currentGasType}`, JSON.stringify(events));
    
    // Reload history if modal is open
    if (gasDetailModal.style.display === 'block') {
        loadGasEventHistory();
    }
}

function getGasDisplayName(gasType) {
    const names = {
        'o2': 'O₂ - Oxígeno',
        'co': 'CO - Monóxido de Carbono',
        'ch4': 'CH₄ - Metano',
        'co2': 'CO₂ - Dióxido de Carbono'
    };
    return names[gasType] || gasType;
}

function getGasColor(gasType) {
    const colors = {
        'o2': '#00b0ff',
        'co': '#ff6b35',
        'ch4': '#4caf50',
        'co2': '#8bc34a'
    };
    return colors[gasType] || '#666';
}