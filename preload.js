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
   // Nuevo: marcar evento por gas
    markGasEvent: (gas, action) => ipcRenderer.invoke('mark-gas-event', gas, action),
    
    // File operations
    getExcelFilePath: () => ipcRenderer.invoke('get-excel-file-path'),
    getExcelFileInfo: () => ipcRenderer.invoke('get-excel-file-path'),
    selectExcelFolder: () => ipcRenderer.invoke('select-excel-folder'),
    
    // Gas configuration
    getSelectedGases: () => ipcRenderer.invoke('get-selected-gases'),
    updateSelectedGases: (gasConfig) => ipcRenderer.invoke('update-selected-gases', gasConfig),
    
    // Database operations
    getAllReadings: (limit, offset) => ipcRenderer.invoke('get-all-readings', limit, offset),
    getReadingsByDateRange: (startDate, endDate) => ipcRenderer.invoke('get-readings-by-date-range', startDate, endDate),
    getReadingsByEvent: (eventType) => ipcRenderer.invoke('get-readings-by-event', eventType),
    getGasStatistics: (startDate, endDate) => ipcRenderer.invoke('get-gas-statistics', startDate, endDate),
    exportDataToCSV: (startDate, endDate) => ipcRenderer.invoke('export-data-to-csv', startDate, endDate),
    deleteReadingsByDateRange: (startDate, endDate) => ipcRenderer.invoke('delete-readings-by-date-range', startDate, endDate),
    getDatabaseInfo: () => ipcRenderer.invoke('get-database-info'),
    getLastMeasurementId: () => ipcRenderer.invoke('get-last-measurement-id'),
    getDetailedReadings: (medicionId) => ipcRenderer.invoke('get-detailed-readings', medicionId),
    deleteMedicion: (medicionId) => ipcRenderer.invoke('delete-medicion', medicionId),
    updateMedicionTiempoFin: (medicionId, tiempoFin) => ipcRenderer.invoke('update-medicion-tiempo-fin', medicionId, tiempoFin),
    saveManualReading: (data, eventType) => ipcRenderer.invoke('save-manual-reading', data, eventType),
    
    // Export and email operations removidas
    
    // Blob operations
    sendMedicionToPlatformUI: (medicionId, format) => ipcRenderer.invoke('send-medicion-to-platform-ui', medicionId, format),
    
    // Internet connection
    checkInternetForIndicator: () => ipcRenderer.invoke('check-internet-for-indicator'),
    
    // Event listeners
    onDataUpdate: (callback) => ipcRenderer.on('data-update', callback),
    onDataError: (callback) => ipcRenderer.on('data-error', callback),
    onMeasurementStarted: (callback) => ipcRenderer.on('measurement-started', callback),
    onMeasurementCompleted: (callback) => ipcRenderer.on('measurement-completed', callback),
    
    // Remove listeners
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
