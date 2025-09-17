const { contextBridge, ipcRenderer } = require('electron');

// Exponer APIs seguras al renderer
contextBridge.exposeInMainWorld('electronAPI', {
    // Serial port operations
    getSerialPorts: () => ipcRenderer.invoke('get-serial-ports'),
    connectSerial: (portPath, baudRate) => ipcRenderer.invoke('connect-serial', portPath, baudRate),
    disconnectSerial: () => ipcRenderer.invoke('disconnect-serial'),
    
    // Reading operations
    startReading: () => ipcRenderer.invoke('start-reading'),
    stopReading: () => ipcRenderer.invoke('stop-reading'),
    
    // Auto-connect
    autoConnect: () => ipcRenderer.invoke('auto-connect'),
    
    // Calibration events
    setCalibrationEvent: (eventType) => ipcRenderer.invoke('set-calibration-event', eventType),
    
    // File operations
    getExcelFilePath: () => ipcRenderer.invoke('get-excel-file-path'),
    getExcelFileInfo: () => ipcRenderer.invoke('get-excel-file-path'),
    selectExcelFolder: () => ipcRenderer.invoke('select-excel-folder'),
    
    // Gas configuration
    getSelectedGases: () => ipcRenderer.invoke('get-selected-gases'),
    updateSelectedGases: (gasConfig) => ipcRenderer.invoke('update-selected-gases', gasConfig),
    
    // Event listeners
    onDataUpdate: (callback) => ipcRenderer.on('data-update', callback),
    onDataError: (callback) => ipcRenderer.on('data-error', callback),
    
    // Remove listeners
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
