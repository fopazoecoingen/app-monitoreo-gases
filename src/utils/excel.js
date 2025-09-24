// Utilidades para manejo de archivos Excel
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

class ExcelManager {
    constructor(filePath) {
        this.filePath = filePath;
        this.workbook = new ExcelJS.Workbook();
        this.worksheet = null;
    }

    // Inicializar archivo Excel
    async initialize() {
        try {
            if (fs.existsSync(this.filePath)) {
                await this.workbook.xlsx.readFile(this.filePath);
                this.worksheet = this.workbook.getWorksheet('Gases');
            } else {
                this.worksheet = this.workbook.addWorksheet('Gases');
                this.setupHeaders();
            }
            return true;
        } catch (error) {
            throw new Error(`Error al inicializar Excel: ${error.message}`);
        }
    }

    // Configurar encabezados
    setupHeaders() {
        this.worksheet.addRow(['Fecha', 'Hora', 'O₂ (%Vol)', 'CO (ppm)', 'CH₄ (ppm)', 'CO₂ (%)', 'Evento']);
        
        // Formatear encabezados
        const headerRow = this.worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF2C2C2C' }
        };
        headerRow.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    }

    // Obtener color del evento
    getEventColor(eventType) {
        const colors = {
            'Normal': null,
            'ZERO': '#FF6B35',
            'SPAN': '#4CAF50', 
            'INICIO_GAS_PATRON': '#2196F3',
            'FIN_INYECCION_GAS': '#9C27B0'
        };
        return colors[eventType] || null;
    }

    // Aplicar color a fila
    applyRowColor(row, eventType) {
        if (eventType !== 'Normal') {
            const eventColor = this.getEventColor(eventType);
            if (eventColor) {
                const argbColor = eventColor.replace('#', 'FF');
                row.eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: argbColor }
                    };
                });
            }
        }
    }

    // Guardar datos en Excel
    async saveData(o2, co, ch4, co2, eventType = 'Normal') {
        try {
            const now = new Date();
            const fecha = now.toISOString().split('T')[0];
            const hora = now.toTimeString().split(' ')[0];

            // Agregar nueva fila
            const newRow = this.worksheet.addRow([
                fecha, 
                hora, 
                Math.round(o2 * 1000) / 1000, 
                Math.round(co * 1000) / 1000, 
                Math.round(ch4 * 1000) / 1000,
                Math.round(co2 * 1000) / 1000,
                eventType
            ]);

            // Aplicar color si no es Normal
            this.applyRowColor(newRow, eventType);

            // Ajustar ancho de columnas
            this.worksheet.columns = [
                { width: 12 }, // Fecha
                { width: 10 }, // Hora
                { width: 12 }, // O₂
                { width: 12 }, // CO
                { width: 12 }, // CH₄
                { width: 15 }  // Evento
            ];

            await this.workbook.xlsx.writeFile(this.filePath);
            
            return { 
                success: true, 
                fecha, 
                hora, 
                o2, 
                co, 
                ch4, 
                eventType 
            };
        } catch (error) {
            throw new Error(`Error al guardar en Excel: ${error.message}`);
        }
    }

    // Crear directorio si no existe
    ensureDirectoryExists() {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}

module.exports = ExcelManager;
