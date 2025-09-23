// Gestor de Mediciones - Frontend
console.log('📄 Cargando script mediciones-manager.js...');

class MedicionesManager {
    constructor() {
        console.log('🚀 Inicializando MedicionesManager...');
        this.mediciones = [];
        this.currentPage = 1;
        this.itemsPerPage = 50;
        this.selectedMediciones = new Set();
        this.filters = {
            startDate: null,
            endDate: null,
            eventType: null
        };
        
        // Limpiar campos de fecha en el HTML
        this.clearDateFilters();
        
        this.initializeEventListeners();
        this.loadInitialData();
        console.log('✅ MedicionesManager inicializado correctamente');
        
        // Función de test manual
        window.testRender = () => {
            console.log('🧪 Test manual de renderizado...');
            const tbody = document.getElementById('medicionesTableBody');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="8">🧪 TEST MANUAL - Tabla funcionando</td></tr>';
                console.log('✅ Test manual exitoso - Tabla actualizada');
            } else {
                console.error('❌ Test manual falló - tbody no encontrado');
            }
        };
        console.log('✅ Función testRender() disponible. Ejecuta: testRender()');
    }

    clearDateFilters() {
        const dateFrom = document.getElementById('medicionDateFrom');
        const dateTo = document.getElementById('medicionDateTo');
        if (dateFrom) dateFrom.value = '';
        if (dateTo) dateTo.value = '';
        console.log('🧹 Filtros de fecha limpiados');
        
        // Verificar elementos HTML importantes
        const tbody = document.getElementById('medicionesTableBody');
        const table = document.getElementById('medicionesTable');
        console.log('🔍 Verificando elementos HTML:');
        console.log('- medicionesTableBody:', !!tbody);
        console.log('- medicionesTable:', !!table);
        console.log('- medicionDateFrom:', !!dateFrom);
        console.log('- medicionDateTo:', !!dateTo);
    }

    initializeEventListeners() {
        console.log('🔗 Configurando event listeners...');
        // Filtros y búsqueda
        const loadBtn = document.getElementById('loadMediciones');
        if (loadBtn) {
            console.log('✅ Botón loadMediciones encontrado, agregando listener');
            loadBtn.addEventListener('click', () => {
                console.log('🖱️ Click en botón Buscar Mediciones');
                this.loadMediciones();
            });
        } else {
            console.error('❌ Botón loadMediciones NO encontrado');
        }
        document.getElementById('medicionDateFrom')?.addEventListener('change', (e) => {
            this.filters.startDate = e.target.value;
        });
        document.getElementById('medicionDateTo')?.addEventListener('change', (e) => {
            this.filters.endDate = e.target.value;
        });
        document.getElementById('medicionEventFilter')?.addEventListener('change', (e) => {
            this.filters.eventType = e.target.value || null;
        });

        // Acciones
        document.getElementById('exportMedicionesExcel')?.addEventListener('click', () => this.exportToExcel());
        document.getElementById('exportMedicionesCSV')?.addEventListener('click', () => this.exportToCSV());
        document.getElementById('sendMedicionesEmail')?.addEventListener('click', () => this.openEmailModal());
        document.getElementById('deleteMediciones')?.addEventListener('click', () => this.deleteSelectedMediciones());

        // Paginación
        document.getElementById('prevPageBtn')?.addEventListener('click', () => this.previousPage());
        document.getElementById('nextPageBtn')?.addEventListener('click', () => this.nextPage());

        // Selección
        document.getElementById('selectAllMediciones')?.addEventListener('change', (e) => {
            this.selectAllMediciones(e.target.checked);
        });

        // Modales
        document.getElementById('closeMedicionDetail')?.addEventListener('click', () => this.closeModal('medicionDetailModal'));
        document.getElementById('closeMedicionDetailBtn')?.addEventListener('click', () => this.closeModal('medicionDetailModal'));
        document.getElementById('closeEmailModal')?.addEventListener('click', () => this.closeModal('emailModal'));
        document.getElementById('closeEmailModalBtn')?.addEventListener('click', () => this.closeModal('emailModal'));
        document.getElementById('sendEmailBtn')?.addEventListener('click', () => this.sendEmail());

        // Cerrar modales al hacer click fuera
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });
    }

    async loadInitialData() {
        console.log('ℹ️ loadInitialData() - Cargando mediciones automáticamente...');
        await this.loadMediciones();
    }

    async loadMediciones() {
        try {
            this.showLoading(true);
            console.log('🔍 Cargando mediciones...');
            console.log('Filtros:', this.filters);
            
            let result;
            // Solo usar filtro si ambas fechas están seleccionadas
            if (this.filters.startDate && this.filters.endDate && this.filters.startDate.trim() && this.filters.endDate.trim()) {
                console.log('📅 Usando filtro de fechas:', this.filters.startDate, 'a', this.filters.endDate);
                result = await window.electronAPI.getReadingsByDateRange(
                    this.filters.startDate,
                    this.filters.endDate
                );
            } else {
                console.log('📋 Cargando todas las mediciones (sin filtro de fechas)');
                result = await window.electronAPI.getAllReadings();
            }
            
            console.log('📊 Resultado de la consulta:', result);

            if (result.success) {
                // Asegurar que result.data sea un array
                this.mediciones = Array.isArray(result.data) ? result.data : [];
                console.log('✅ Mediciones cargadas:', this.mediciones.length);
                console.log('🔍 this.mediciones después de cargar:', this.mediciones);
                
                // Filtrar por evento si está seleccionado
                if (this.filters.eventType) {
                    console.log('🔍 Filtrando por evento:', this.filters.eventType);
                    const beforeFilter = this.mediciones.length;
                    this.mediciones = this.mediciones.filter(m => m.evento === this.filters.eventType);
                    console.log('📊 Después del filtro:', this.mediciones.length, 'de', beforeFilter);
                }

                console.log('🎨 Renderizando mediciones...');
                console.log('🔍 this.mediciones antes de renderizar:', this.mediciones.length);
                this.renderMediciones();
                this.updatePagination();
                this.updateStats();
                console.log('✅ Carga completada');
                console.log('📊 Tabla renderizada. Filas en tbody:', document.querySelectorAll('#medicionesTableBody tr').length);
            } else {
                console.error('❌ Error en la consulta:', result.error);
                this.mediciones = []; // Asegurar que sea array vacío en caso de error
                this.showError('Error cargando mediciones: ' + result.error);
                this.renderMediciones(); // Renderizar tabla vacía
            }
        } catch (error) {
            this.mediciones = []; // Asegurar que sea array vacío en caso de excepción
            this.showError('Error: ' + error.message);
            this.renderMediciones(); // Renderizar tabla vacía
        } finally {
            this.showLoading(false);
        }
    }

    renderMediciones() {
        console.log('🎨 renderMediciones() llamado desde:', new Error().stack);
        const tbody = document.getElementById('medicionesTableBody');
        console.log('🎨 renderMediciones() - tbody encontrado:', !!tbody);
        if (!tbody) {
            console.error('❌ Elemento #medicionesTableBody NO encontrado');
            return;
        }

        // Asegurar que this.mediciones sea siempre un array
        if (!Array.isArray(this.mediciones)) {
            console.log('⚠️ this.mediciones no es array, convirtiendo a array vacío');
            this.mediciones = [];
        }

        console.log('📊 Renderizando', this.mediciones.length, 'mediciones');

            if (this.mediciones.length === 0) {
                console.log('📭 No hay mediciones, mostrando mensaje vacío');
                tbody.innerHTML = '<tr><td colspan="6" class="no-data">No hay mediciones disponibles</td></tr>';
                return;
            }

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageMediciones = this.mediciones.slice(startIndex, endIndex);

        const htmlContent = pageMediciones.map(medicion => {
            // Crear badges para gases que tienen datos (estructura de base de datos)
            const gasBadges = [];
            // Las mediciones de la base de datos no tienen detalles de gases individuales
            // Solo mostramos el total de lecturas
            if (medicion.total_lecturas > 0) {
                gasBadges.push(`<span class="gas-badge total">Lecturas: ${medicion.total_lecturas}</span>`);
            }

            // Formatear fechas de inicio y fin
            const inicioFormateado = medicion.tiempo_inicio ? 
                this.formatDateTime(medicion.tiempo_inicio) : 'No iniciado';
            const finFormateado = medicion.tiempo_fin ? 
                this.formatDateTime(medicion.tiempo_fin) : 'En progreso';

            return `
                <tr class="${this.selectedMediciones.has(medicion.medicion_id) ? 'selected' : ''}">
                    <td>
                        <input type="checkbox" 
                               class="medicion-checkbox" 
                               value="${medicion.medicion_id}"
                               ${this.selectedMediciones.has(medicion.medicion_id) ? 'checked' : ''}>
                    </td>
                    <td>${medicion.medicion_id}</td>
                    <td title="Inicio: ${medicion.tiempo_inicio || 'No disponible'}">${inicioFormateado}</td>
                    <td title="Fin: ${medicion.tiempo_fin || 'No disponible'}">${finFormateado}</td>
                    <td>
                        <span class="gas-badge total">${medicion.total_lecturas || 0}</span>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn view" 
                                    onclick="medicionesManager.viewMedicionDetail(${medicion.medicion_id})"
                                    title="Ver detalle (incluye observaciones)">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        console.log('🔨 HTML generado para', pageMediciones.length, 'mediciones');
        console.log('📝 Primeras 200 caracteres del HTML:', htmlContent.substring(0, 200));
        
        tbody.innerHTML = htmlContent;
        
        console.log('✅ innerHTML asignado. Filas en tbody:', tbody.children.length);

        // Agregar event listeners a los checkboxes
        tbody.querySelectorAll('.medicion-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const medicionId = parseInt(e.target.value);
                if (e.target.checked) {
                    this.selectedMediciones.add(medicionId);
                } else {
                    this.selectedMediciones.delete(medicionId);
                }
                this.updateRowSelection();
            });
        });
    }

    getEventClass(evento) {
        const classes = {
            'Normal': 'normal',
            'ZERO': 'alarma',
            'SPAN': 'mantenimiento',
            'INICIO_GAS_PATRON': 'mantenimiento',
            'FIN_INYECCION_GAS': 'mantenimiento'
        };
        return classes[evento] || 'normal';
    }

    formatDateTime(dateTimeString) {
        if (!dateTimeString) return 'No disponible';
        
        try {
            // Intentar parsear la fecha
            let date;
            
            // Si es formato ISO (con Z al final)
            if (dateTimeString.includes('T') && dateTimeString.includes('Z')) {
                date = new Date(dateTimeString);
            }
            // Si es formato local (YYYY-MM-DD HH:mm:ss)
            else if (dateTimeString.includes(' ') && dateTimeString.length === 19) {
                date = new Date(dateTimeString);
            }
            // Otros formatos
            else {
                date = new Date(dateTimeString);
            }
            
            // Verificar si la fecha es válida
            if (isNaN(date.getTime())) {
                return dateTimeString; // Retornar original si no se puede parsear
            }
            
            // Formatear a DD/MM/YYYY HH:mm:ss
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            const seconds = date.getSeconds().toString().padStart(2, '0');
            
            return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
        } catch (error) {
            console.error('Error formateando fecha:', error, dateTimeString);
            return dateTimeString;
        }
    }

    async viewMedicionDetail(medicionId) {
        try {
            this.showLoading(true);
            
            const medicion = this.mediciones.find(m => m.medicion_id === medicionId);
            if (!medicion) {
                this.showError('Medición no encontrada');
                return;
            }

            // Obtener lecturas detalladas
            const detailedResponse = await window.electronAPI.getDetailedReadings(medicionId);
            console.log('🔍 Respuesta de lecturas detalladas:', detailedResponse);
            
            if (detailedResponse.success) {
                // Asegurar que sea un array
                medicion.lecturasDetalladas = Array.isArray(detailedResponse.data) ? detailedResponse.data : [];
                console.log('✅ Lecturas detalladas cargadas:', medicion.lecturasDetalladas.length);
            } else {
                console.warn('No se pudieron obtener lecturas detalladas:', detailedResponse.error);
                medicion.lecturasDetalladas = [];
            }

            const modalContent = document.getElementById('medicionDetailContent');
            modalContent.innerHTML = this.createMedicionDetailHTML(medicion);
            
            this.showModal('medicionDetailModal');
            
            // Agregar event listener al botón de exportar
            document.getElementById('exportMedicionDetail')?.addEventListener('click', () => {
                this.exportSingleMedicion(medicion);
            });
        } catch (error) {
            this.showError('Error mostrando detalle: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    createMedicionDetailHTML(medicion) {
        return `
            <div class="medicion-detail">
                <div class="detail-section">
                    <h4>Información General</h4>
                    <div class="detail-info">
                        <div class="detail-item">
                            <span class="detail-label">ID:</span>
                            <span class="detail-value">${medicion.medicion_id}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Fecha:</span>
                            <span class="detail-value">${medicion.fecha}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Hora:</span>
                            <span class="detail-value">${medicion.hora}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Evento:</span>
                            <span class="detail-value">${medicion.evento}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Observaciones:</span>
                            <span class="detail-value">${medicion.observaciones || 'Sin observaciones'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Creado:</span>
                            <span class="detail-value">${new Date(medicion.created_at).toLocaleString()}</span>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Lecturas Detalladas</h4>
                    <div class="readings-table-container">
                        ${this.createDetailedReadingsTable(medicion.lecturasDetalladas || [])}
                    </div>
                </div>
            </div>
        `;
    }

    createDetailedReadingsTable(lecturas) {
        console.log('🔍 createDetailedReadingsTable recibido:', lecturas);
        
        // Asegurar que sea un array
        if (!Array.isArray(lecturas)) {
            console.warn('⚠️ lecturas no es un array:', lecturas);
            lecturas = [];
        }
        
        if (lecturas.length === 0) {
            return `
                <div class="no-readings">
                    <i class="fas fa-info-circle"></i>
                    <span>No hay lecturas detalladas disponibles para esta medición</span>
                </div>
            `;
        }

        console.log('✅ Renderizando', lecturas.length, 'lecturas detalladas');
        const readingsHTML = lecturas.map((lectura, index) => {
            const fecha = new Date(lectura.created_at).toLocaleDateString('es-ES');
            const hora = new Date(lectura.created_at).toLocaleTimeString('es-ES');
            
            // Formatear timestamp para mostrar fecha y hora de forma legible
            const timestampFormateado = lectura.tiempo_relativo ? 
                new Date(lectura.tiempo_relativo).toLocaleString('es-ES') : 'N/A';
            
            return `
                <tr class="reading-row">
                    <td class="col-index">${index + 1}</td>
                    <td class="col-fecha">${fecha}</td>
                    <td class="col-hora">${hora}</td>
                    <td class="col-o2">${lectura.o2 !== null ? lectura.o2.toFixed(2) : 'NULL'}</td>
                    <td class="col-co">${lectura.co !== null ? lectura.co.toFixed(2) : 'NULL'}</td>
                    <td class="col-ch4">${lectura.ch4 !== null ? lectura.ch4.toFixed(2) : 'NULL'}</td>
                    <td class="col-tiempo">${timestampFormateado}</td>
                    <td class="col-evento">${lectura.evento || 'Normal'}</td>
                </tr>
            `;
        }).join('');

        return `
            <div class="readings-table">
                <table class="detailed-readings-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Fecha</th>
                            <th>Hora</th>
                            <th>O₂ (%Vol)</th>
                            <th>CO (ppm)</th>
                            <th>CH₄ (ppm)</th>
                            <th>Timestamp Lectura</th>
                            <th>Evento</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${readingsHTML}
                    </tbody>
                </table>
                <div class="readings-summary">
                    <span class="total-readings">Total de lecturas: ${lecturas.length}</span>
                </div>
            </div>
        `;
    }

    selectAllMediciones(checked) {
        const checkboxes = document.querySelectorAll('.medicion-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
            const medicionId = parseInt(checkbox.value);
            if (checked) {
                this.selectedMediciones.add(medicionId);
            } else {
                this.selectedMediciones.delete(medicionId);
            }
        });
        this.updateRowSelection();
    }

    updateRowSelection() {
        const rows = document.querySelectorAll('#medicionesTableBody tr');
        rows.forEach(row => {
            const checkbox = row.querySelector('.medicion-checkbox');
            if (checkbox && this.selectedMediciones.has(parseInt(checkbox.value))) {
                row.classList.add('selected');
            } else {
                row.classList.remove('selected');
            }
        });
    }

    updatePagination() {
        const totalPages = Math.ceil(this.mediciones.length / this.itemsPerPage);
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        const paginationInfo = document.getElementById('paginationInfo');

        if (prevBtn && nextBtn && paginationInfo) {
            prevBtn.disabled = this.currentPage <= 1;
            nextBtn.disabled = this.currentPage >= totalPages;
            paginationInfo.textContent = `Página ${this.currentPage} de ${totalPages}`;
        }
    }

    updateStats() {
        const countElement = document.getElementById('medicionesCount');
        if (countElement) {
            countElement.textContent = `Total: ${this.mediciones.length}`;
        }
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderMediciones();
            this.updatePagination();
        }
    }

    nextPage() {
        const totalPages = Math.ceil(this.mediciones.length / this.itemsPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.renderMediciones();
            this.updatePagination();
        }
    }

    async exportToExcel() {
        try {
            this.showLoading(true);
            
            const result = await window.electronAPI.exportMedicionesExcel(
                this.filters.startDate,
                this.filters.endDate
            );

            if (result.success) {
                this.showSuccess(`Archivo Excel exportado: ${result.fileName}`);
                console.log('Archivo guardado en:', result.filePath);
            } else {
                this.showError('Error exportando: ' + result.error);
            }
        } catch (error) {
            this.showError('Error: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async exportToCSV() {
        try {
            this.showLoading(true);
            
            const result = await window.electronAPI.exportDataToCSV(
                this.filters.startDate,
                this.filters.endDate
            );

            if (result.success) {
                // Crear libro de Excel
                const workbook = XLSX.utils.book_new();
                
                // Crear hoja con datos de las mediciones
                const lines = result.data.split('\n');
                const worksheetData = [];
                
                lines.forEach((line, index) => {
                    if (line.trim()) {
                        const values = line.split(',');
                        // Limpiar comillas de los valores
                        const cleanValues = values.map(val => val.replace(/"/g, ''));
                        worksheetData.push(cleanValues);
                    }
                });
                
                const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
                
                // Agregar hoja al libro
                XLSX.utils.book_append_sheet(workbook, worksheet, 'Mediciones');
                
                // Generar archivo Excel
                const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
                const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                
                // Descargar archivo
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `mediciones_${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                this.showSuccess('Archivo Excel descargado exitosamente');
            } else {
                this.showError('Error exportando Excel: ' + result.error);
            }
        } catch (error) {
            this.showError('Error: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    openEmailModal() {
        // Configurar fecha por defecto
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('emailSubject').value = `Reporte de Mediciones de Gases - ${today}`;
        
        this.showModal('emailModal');
    }

    async sendEmail() {
        try {
            const emailData = {
                to: document.getElementById('emailTo').value,
                subject: document.getElementById('emailSubject').value,
                body: document.getElementById('emailBody').value,
                format: document.getElementById('emailFormat').value
            };

            if (!emailData.to) {
                this.showError('Por favor ingresa un destinatario');
                return;
            }

            this.showLoading(true);
            
            const result = await window.electronAPI.sendMedicionesEmail(
                emailData,
                this.filters.startDate,
                this.filters.endDate
            );

            if (result.success) {
                this.showSuccess('Email enviado exitosamente');
                this.closeModal('emailModal');
            } else {
                this.showError('Error enviando email: ' + result.error);
            }
        } catch (error) {
            this.showError('Error: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async exportSingleMedicion(medicion) {
        try {
            // Obtener lecturas detalladas
            const detailedResponse = await window.electronAPI.getDetailedReadings(medicion.medicion_id);
            let lecturasDetalladas = [];
            
            if (detailedResponse.success) {
                lecturasDetalladas = Array.isArray(detailedResponse.data) ? detailedResponse.data : [];
            }

            // Crear libro de Excel
            const workbook = XLSX.utils.book_new();
            
            // Hoja 1: Resumen de la medición (estructura de base de datos)
            const resumenData = [
                ['ID Medición', 'Fecha', 'Hora', 'Evento', 'Observaciones', 'Tiempo Inicio', 'Tiempo Fin', 'Total Lecturas'],
                [
                    medicion.medicion_id,
                    medicion.fecha,
                    medicion.hora,
                    medicion.evento,
                    medicion.observaciones || '',
                    medicion.tiempo_inicio || '',
                    medicion.tiempo_fin || '',
                    medicion.total_lecturas || 0
                ]
            ];
            
            const resumenWorksheet = XLSX.utils.aoa_to_sheet(resumenData);
            XLSX.utils.book_append_sheet(workbook, resumenWorksheet, 'Resumen');
            
            // Hoja 2: Lecturas detalladas (si existen)
            console.log('🔍 Verificando lecturas detalladas para exportar:');
            console.log('- Cantidad:', lecturasDetalladas.length);
            console.log('- Tipo:', typeof lecturasDetalladas);
            console.log('- Es array:', Array.isArray(lecturasDetalladas));
            
            if (lecturasDetalladas.length > 0) {
                const lecturasData = [
                    ['#', 'Fecha', 'Hora', 'O2 (%Vol)', 'CO (ppm)', 'CH4 (ppm)', 'Timestamp Lectura', 'Evento']
                ];
                
                console.log('📊 Exportando', lecturasDetalladas.length, 'lecturas detalladas');
                
                lecturasDetalladas.forEach((lectura, index) => {
                    const fecha = new Date(lectura.created_at).toLocaleDateString('es-ES');
                    const hora = new Date(lectura.created_at).toLocaleTimeString('es-ES');
                    const timestampFormateado = lectura.tiempo_relativo ? 
                        new Date(lectura.tiempo_relativo).toLocaleString('es-ES') : 'N/A';
                    
                    // Log para verificar los valores de los gases
                    if (index < 3) { // Solo las primeras 3 lecturas
                        console.log(`Lectura ${index + 1}:`, {
                            o2: lectura.o2,
                            co: lectura.co,
                            ch4: lectura.ch4,
                            evento: lectura.evento
                        });
                    }
                    
                    lecturasData.push([
                        index + 1,
                        fecha,
                        hora,
                        lectura.o2 !== null && lectura.o2 !== undefined ? lectura.o2.toFixed(2) : 'NULL',
                        lectura.co !== null && lectura.co !== undefined ? lectura.co.toFixed(2) : 'NULL',
                        lectura.ch4 !== null && lectura.ch4 !== undefined ? lectura.ch4.toFixed(2) : 'NULL',
                        timestampFormateado,
                        lectura.evento || 'Normal'
                    ]);
                });
                
                const lecturasWorksheet = XLSX.utils.aoa_to_sheet(lecturasData);
                XLSX.utils.book_append_sheet(workbook, lecturasWorksheet, 'Lecturas Detalladas');
                console.log('✅ Hoja "Lecturas Detalladas" agregada al Excel');
            } else {
                console.log('⚠️ No hay lecturas detalladas para exportar');
            }
            
            // Generar archivo Excel
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            
            // Descargar archivo
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `medicion_${medicion.medicion_id}_${medicion.fecha}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.showSuccess('Medición exportada exitosamente');
        } catch (error) {
            this.showError('Error exportando medición: ' + error.message);
        }
    }

    async deleteSelectedMediciones() {
        if (this.selectedMediciones.size === 0) {
            this.showError('No hay mediciones seleccionadas');
            return;
        }

        const confirmed = confirm(`¿Estás seguro de eliminar ${this.selectedMediciones.size} medición(es) seleccionada(s)?`);
        if (!confirmed) return;

        try {
            this.showLoading(true);
            
            const medicionesToDelete = Array.from(this.selectedMediciones);
            let successCount = 0;
            let errorCount = 0;
            
            // Eliminar cada medición seleccionada
            for (const medicionId of medicionesToDelete) {
                try {
                    const result = await window.electronAPI.deleteMedicion(medicionId);
                    if (result.success) {
                        successCount++;
                        // Remover de la lista local
                        this.mediciones = this.mediciones.filter(m => m.medicion_id !== medicionId);
                    } else {
                        errorCount++;
                        console.error(`Error eliminando medición ${medicionId}:`, result.error);
                    }
                } catch (error) {
                    errorCount++;
                    console.error(`Error eliminando medición ${medicionId}:`, error.message);
                }
            }
            
            // Mostrar resultado
            if (successCount > 0 && errorCount === 0) {
                this.showSuccess(`${successCount} medición(es) eliminada(s) exitosamente`);
            } else if (successCount > 0 && errorCount > 0) {
                this.showError(`${successCount} medición(es) eliminada(s), ${errorCount} error(es) encontrado(s)`);
            } else {
                this.showError(`No se pudo eliminar ninguna medición`);
            }
            
            // Limpiar selección y actualizar vista
            this.selectedMediciones.clear();
            document.getElementById('selectAllMediciones').checked = false;
            this.renderMediciones();
            
        } catch (error) {
            this.showError('Error eliminando mediciones: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
        }
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showToast(message, type) {
        const toast = document.getElementById('toast');
        if (toast) {
            const icon = type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle';
            toast.innerHTML = `
                <div class="toast-content">
                    <i class="toast-icon ${icon}"></i>
                    <span class="toast-message">${message}</span>
                </div>
            `;
            toast.classList.add('show');
            
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 Script mediciones-manager.js cargado completamente');
    // Comentado para evitar conflictos con la inicialización en renderer.js
    // if (document.getElementById('mediciones-tab')) {
    //     window.medicionesManager = new MedicionesManager();
    // }
});
