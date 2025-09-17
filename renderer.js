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

// Gas value elements
const o2Value = document.getElementById('o2Value');
const coValue = document.getElementById('coValue');
const ch4Value = document.getElementById('ch4Value');
const lastReadingValue = document.getElementById('lastReadingValue');
const dataCount = document.getElementById('dataCount');

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
const saveSettingsBtn = document.getElementById('saveSettings');

// Monitoring view elements
const stopMonitoringBtn = document.getElementById('stopMonitoringBtn');
const exitMonitoringBtn = document.getElementById('exitMonitoringBtn');
const monitoringTimeElement = document.getElementById('monitoringTime');
const monitoringDataCountElement = document.getElementById('monitoringDataCount');
const monitoringLastReadingElement = document.getElementById('monitoringLastReading');
const monitoringGasCardsContainer = document.getElementById('monitoringGasCards');
const monitoringChartContainer = document.getElementById('monitoringChartContainer');

// Verify elements exist
if (!calibrationStatus) {
    console.error('calibrationStatus element not found');
}
if (!lastEvent) {
    console.error('lastEvent element not found');
}
if (!totalReadingsElement) {
    console.error('totalReadingsElement not found');
}
if (!totalEventsElement) {
    console.error('totalEventsElement not found');
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
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebar = document.getElementById('sidebar');

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

// Chart data
const maxDataPoints = 50; // Máximo de puntos en el gráfico
let chartData = {
    labels: [],
    o2: [],
    co: [],
    ch4: []
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
    
    // Monitoring view handlers
    if (stopMonitoringBtn) stopMonitoringBtn.addEventListener('click', stopMonitoringFromView);
    if (exitMonitoringBtn) exitMonitoringBtn.addEventListener('click', exitMonitoringView);
    
    // Monitoring calibration buttons
    const zeroBtnMonitoring = document.getElementById('zeroBtnMonitoring');
    const spanBtnMonitoring = document.getElementById('spanBtnMonitoring');
    const startGasBtnMonitoring = document.getElementById('startGasBtnMonitoring');
    const endInjectionBtnMonitoring = document.getElementById('endInjectionBtnMonitoring');
    
    if (zeroBtnMonitoring) zeroBtnMonitoring.addEventListener('click', () => markCalibrationEvent('ZERO'));
    if (spanBtnMonitoring) spanBtnMonitoring.addEventListener('click', () => markCalibrationEvent('SPAN'));
    if (startGasBtnMonitoring) startGasBtnMonitoring.addEventListener('click', () => markCalibrationEvent('INICIO_GAS_PATRON'));
    if (endInjectionBtnMonitoring) endInjectionBtnMonitoring.addEventListener('click', () => markCalibrationEvent('FIN_INYECCION_GAS'));
    
    // Sidebar toggle
    sidebarToggle.addEventListener('click', toggleSidebar);
    
    // Menu navigation
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(item.dataset.tab);
        });
    });
    
    // Data update listeners
    window.electronAPI.onDataUpdate((event, data) => {
        updateGasValues(data);
        updateLastReading(data);
        updateDataCount();
        
        // Update monitoring view if active
        const monitoringTab = document.getElementById('monitoring-view-tab');
        if (monitoringTab && monitoringTab.classList.contains('active')) {
            updateMonitoringView(data);
        }
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
    if (data.o2 !== undefined) o2Value.textContent = data.o2.toFixed(3);
    if (data.co !== undefined) coValue.textContent = data.co.toFixed(3);
    if (data.ch4 !== undefined) ch4Value.textContent = data.ch4.toFixed(3);
    
    // Actualizar gráficos
    updateCharts(data);
}

function updateLastReading(data) {
    lastReadingValue.textContent = `${data.hora}`;
}

function updateDataCount() {
    const count = parseInt(dataCount.textContent) + 1;
    dataCount.textContent = count;
    if (totalReadingsElement) {
        totalReadingsElement.textContent = count;
    }
}

async function markCalibrationEvent(eventType) {
    try {
        // Send event to main process
        await window.electronAPI.setCalibrationEvent(eventType);
        
        currentCalibrationEvent = eventType;
        totalEvents++;
        
        // Update UI - check if elements exist
        if (calibrationStatus) {
            calibrationStatus.textContent = eventType.replace(/_/g, ' ');
        }
        if (lastEvent) {
            lastEvent.textContent = eventType.replace(/_/g, ' ');
        }
        if (totalEventsElement) {
            totalEventsElement.textContent = totalEvents;
        }
        
        // Visual feedback - check if we're in monitoring view
        const monitoringTab = document.getElementById('monitoring-view-tab');
        if (monitoringTab && monitoringTab.classList.contains('active')) {
            const buttonMap = {
                'ZERO': document.getElementById('zeroBtnMonitoring'),
                'SPAN': document.getElementById('spanBtnMonitoring'),
                'INICIO_GAS_PATRON': document.getElementById('startGasBtnMonitoring'),
                'FIN_INYECCION_GAS': document.getElementById('endInjectionBtnMonitoring')
            };
            
            const button = buttonMap[eventType];
            if (button) {
                button.classList.add('active');
                setTimeout(() => {
                    button.classList.remove('active');
                }, 2000);
            }
        }
        
        showToast('success', `Evento marcado: ${eventType.replace(/_/g, ' ')}`);
        
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
}

function toggleSidebar() {
    sidebar.classList.toggle('collapsed');
}

function clearGasValues() {
    o2Value.textContent = '--';
    coValue.textContent = '--';
    ch4Value.textContent = '--';
    lastReadingValue.textContent = '-:-:-';
    dataCount.textContent = '0';
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

    // Mantener solo los últimos maxDataPoints puntos
    if (chartData.labels.length > maxDataPoints) {
        chartData.labels.shift();
        chartData.o2.shift();
        chartData.co.shift();
        chartData.ch4.shift();
    }

    // Actualizar gráficos individuales
    if (o2Chart && data.o2 !== undefined) {
        o2Chart.data.labels = chartData.labels;
        o2Chart.data.datasets[0].data = chartData.o2;
        o2Chart.update('none');
    }

    if (coChart && data.co !== undefined) {
        coChart.data.labels = chartData.labels;
        coChart.data.datasets[0].data = chartData.co;
        coChart.update('none');
    }

    if (ch4Chart && data.ch4 !== undefined) {
        ch4Chart.data.labels = chartData.labels;
        ch4Chart.data.datasets[0].data = chartData.ch4;
        ch4Chart.update('none');
    }

}

// Gas Configuration Functions
async function loadGasConfiguration() {
    try {
        const gasConfig = await window.electronAPI.getSelectedGases();
        
        if (monitorO2MainCheckbox) monitorO2MainCheckbox.checked = gasConfig.o2;
        if (monitorCOMainCheckbox) monitorCOMainCheckbox.checked = gasConfig.co;
        if (monitorCH4MainCheckbox) monitorCH4MainCheckbox.checked = gasConfig.ch4;
        
        // Actualizar la interfaz para mostrar/ocultar gases
        updateGasCardsVisibility(gasConfig);
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
            updateGasCardsVisibility(gasConfig);
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
            ch4: monitorCH4MainCheckbox ? monitorCH4MainCheckbox.checked : true
        };
        
        // Validar que al menos un gas esté seleccionado
        if (!gasConfig.o2 && !gasConfig.co && !gasConfig.ch4) {
            showToast('warning', 'Debe seleccionar al menos un gas para monitorear');
            // Revertir el último cambio
            event.target.checked = true;
            return;
        }
        
        const result = await window.electronAPI.updateSelectedGases(gasConfig);
        
        if (result.success) {
            updateGasCardsVisibility(gasConfig);
            showToast('success', 'Configuración de gases actualizada');
        } else {
            showToast('error', result.error || 'Error al actualizar configuración');
        }
    } catch (error) {
        console.error('Error al actualizar configuración de gases:', error);
        showToast('error', 'Error al actualizar configuración de gases');
    }
}

function updateGasCardsVisibility(gasConfig) {
    const o2Card = document.querySelector('.gas-card.oxygen');
    const coCard = document.querySelector('.gas-card.carbon-monoxide');
    const ch4Card = document.querySelector('.gas-card.methane');
    
    if (o2Card) o2Card.style.display = gasConfig.o2 ? 'block' : 'none';
    if (coCard) coCard.style.display = gasConfig.co ? 'block' : 'none';
    if (ch4Card) ch4Card.style.display = gasConfig.ch4 ? 'block' : 'none';
}

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
    
    // Create monitoring charts
    createMonitoringCharts(gasConfig);
    
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
        `;
        
        if (monitoringGasCardsContainer) {
            monitoringGasCardsContainer.appendChild(gasCard);
        }
    });
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
    }
    
    if (data.co !== undefined) {
        const coValueElement = document.getElementById('monitoring-co-value');
        if (coValueElement) coValueElement.textContent = data.co.toFixed(3);
    }
    
    if (data.ch4 !== undefined) {
        const ch4ValueElement = document.getElementById('monitoring-ch4-value');
        if (ch4ValueElement) ch4ValueElement.textContent = data.ch4.toFixed(3);
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
            
            // Clean up monitoring charts
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
    
    // Clean up monitoring charts
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
