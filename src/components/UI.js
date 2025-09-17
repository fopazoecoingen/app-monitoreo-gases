// Utilidades para la interfaz de usuario
class UIManager {
    constructor() {
        this.toast = null;
        this.loadingOverlay = null;
        this.initializeElements();
    }

    initializeElements() {
        this.toast = document.getElementById('toast');
        this.loadingOverlay = document.getElementById('loadingOverlay');
    }

    // Mostrar toast de notificación
    showToast(type, message) {
        if (!this.toast) return;

        const toastIcon = this.toast.querySelector('.toast-icon');
        const toastMessage = this.toast.querySelector('.toast-message');
        
        // Set icon based on type
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        
        if (toastIcon) {
            toastIcon.className = `toast-icon ${icons[type] || icons.info}`;
        }
        if (toastMessage) {
            toastMessage.textContent = message;
        }
        
        // Show toast
        this.toast.className = `toast ${type} show`;
        
        // Hide after 3 seconds
        setTimeout(() => {
            this.toast.classList.remove('show');
        }, 3000);
    }

    // Mostrar loading
    showLoading(message = 'Procesando...') {
        if (!this.loadingOverlay) return;

        const loadingText = this.loadingOverlay.querySelector('p');
        if (loadingText) {
            loadingText.textContent = message;
        }
        this.loadingOverlay.classList.add('show');
    }

    // Ocultar loading
    hideLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.classList.remove('show');
        }
    }

    // Actualizar estado de conexión
    updateConnectionStatus(status) {
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        const sidebarStatusDot = document.getElementById('sidebarStatusIndicator')?.querySelector('.status-dot');
        const sidebarStatusText = document.getElementById('sidebarStatusText');
        const connectionStatusInfo = document.getElementById('connectionStatusInfo');
        
        if (status === 'connected') {
            if (statusIndicator?.querySelector('.status-dot')) {
                statusIndicator.querySelector('.status-dot').classList.add('connected');
            }
            if (statusText) statusText.textContent = 'Conectado';
            if (statusIndicator) statusIndicator.classList.add('connected');
            if (sidebarStatusDot) sidebarStatusDot.style.backgroundColor = '#00e676';
            if (sidebarStatusText) sidebarStatusText.textContent = 'Conectado';
            if (connectionStatusInfo) connectionStatusInfo.textContent = 'Conectado';
        } else {
            if (statusIndicator?.querySelector('.status-dot')) {
                statusIndicator.querySelector('.status-dot').classList.remove('connected');
            }
            if (statusText) statusText.textContent = 'Desconectado';
            if (statusIndicator) statusIndicator.classList.remove('connected');
            if (sidebarStatusDot) sidebarStatusDot.style.backgroundColor = '#ff6b35';
            if (sidebarStatusText) sidebarStatusText.textContent = 'Desconectado';
            if (connectionStatusInfo) connectionStatusInfo.textContent = 'Desconectado';
        }
    }

    // Actualizar valores de gases
    updateGasValues(data) {
        const o2Value = document.getElementById('o2Value');
        const coValue = document.getElementById('coValue');
        const ch4Value = document.getElementById('ch4Value');
        
        if (o2Value) o2Value.textContent = data.o2.toFixed(3);
        if (coValue) coValue.textContent = data.co.toFixed(3);
        if (ch4Value) ch4Value.textContent = data.ch4.toFixed(3);
    }

    // Actualizar última lectura
    updateLastReading(data) {
        const lastReadingValue = document.getElementById('lastReadingValue');
        if (lastReadingValue) {
            lastReadingValue.textContent = `${data.hora}`;
        }
    }

    // Actualizar contador de datos
    updateDataCount() {
        const dataCount = document.getElementById('dataCount');
        const totalReadingsElement = document.getElementById('totalReadings');
        
        if (dataCount) {
            const count = parseInt(dataCount.textContent) + 1;
            dataCount.textContent = count;
            if (totalReadingsElement) {
                totalReadingsElement.textContent = count;
            }
        }
    }

    // Actualizar estado de calibración
    updateCalibrationStatus(eventType) {
        const calibrationStatus = document.getElementById('calibrationStatus');
        const lastEvent = document.getElementById('lastEvent');
        
        if (calibrationStatus) {
            calibrationStatus.textContent = eventType.replace(/_/g, ' ');
        }
        if (lastEvent) {
            lastEvent.textContent = eventType.replace(/_/g, ' ');
        }
    }

    // Actualizar estado de botones
    updateButtonStates(connected, reading) {
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const zeroBtn = document.getElementById('zeroBtn');
        const spanBtn = document.getElementById('spanBtn');
        const startGasBtn = document.getElementById('startGasBtn');
        const endInjectionBtn = document.getElementById('endInjectionBtn');
        
        if (startBtn) startBtn.disabled = !connected || reading;
        if (stopBtn) stopBtn.disabled = !connected || !reading;
        
        if (zeroBtn) zeroBtn.disabled = !connected || !reading;
        if (spanBtn) spanBtn.disabled = !connected || !reading;
        if (startGasBtn) startGasBtn.disabled = !connected || !reading;
        if (endInjectionBtn) endInjectionBtn.disabled = !connected || !reading;
    }

    // Cambiar pestaña
    switchTab(tabName) {
        const menuItems = document.querySelectorAll('.menu-item');
        const tabPanes = document.querySelectorAll('.tab-pane');
        
        // Remove active class from all menu items and panes
        menuItems.forEach(item => item.classList.remove('active'));
        tabPanes.forEach(pane => pane.classList.remove('active'));
        
        // Add active class to selected menu item and pane
        const selectedMenuItem = document.querySelector(`[data-tab="${tabName}"]`);
        const selectedPane = document.getElementById(`${tabName}-tab`);
        
        if (selectedMenuItem) selectedMenuItem.classList.add('active');
        if (selectedPane) selectedPane.classList.add('active');
    }

    // Alternar sidebar
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('collapsed');
        }
    }
}

module.exports = UIManager;
