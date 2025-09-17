# Monitor Analizador de Gases

Aplicación Electron para monitoreo en tiempo real de analizador de gases mediante comunicación Modbus RTU.

## 🏗️ Estructura del Proyecto

```
backend-node/
├── src/                          # Código fuente principal
│   ├── components/               # Componentes de UI
│   │   └── UI.js                # Gestor de interfaz de usuario
│   ├── config/                   # Configuración
│   │   └── constants.js         # Constantes y configuración
│   ├── styles/                   # Estilos CSS
│   │   └── styles.css           # Estilos principales
│   ├── utils/                    # Utilidades
│   │   ├── modbus.js            # Cliente Modbus RTU
│   │   └── excel.js             # Gestor de archivos Excel
│   ├── assets/                   # Recursos estáticos
│   │   └── logo.svg             # Logo de la empresa
│   ├── main.js                   # Proceso principal de Electron
│   └── renderer.js               # Proceso de renderizado
├── index.html                    # Interfaz principal
├── preload.js                    # Script de precarga
├── package.json                  # Configuración del proyecto
└── README.md                     # Documentación
```

## 🚀 Características

### 📊 Monitoreo en Tiempo Real
- Lectura continua de O₂, CO y CH₄
- Gráficos individuales para cada gas
- Actualización automática de datos

### 🎛️ Control de Calibración
- Botones para eventos: ZERO, SPAN, INICIO GAS PATRÓN, FIN INYECCIÓN GAS
- Marcado automático en Excel con colores
- Reset automático a estado Normal

### 📁 Gestión de Archivos
- Selección de carpeta de guardado
- Archivos Excel con formato profesional
- Coloreo de filas según eventos

### 🎨 Interfaz Industrial
- Diseño oscuro con acentos neón
- Logo corporativo integrado
- Menú lateral organizado

## 🛠️ Instalación

### Requisitos
- Node.js 16+
- Windows 10/11
- Puerto COM disponible

### Instalación de Dependencias
```bash
npm install
```

### Ejecutar en Desarrollo
```bash
npm start
```

### Crear Ejecutable
```bash
npm run build-portable
```

## ⚙️ Configuración

### Modbus RTU
- **Puerto:** COM9 (configurable)
- **Baud Rate:** 9600
- **Slave ID:** 1
- **Registros:**
  - O₂: 40005 (ADDR_O2 = 4)
  - CO: 40008 (ADDR_CO = 7)
  - CH₄: 40012 (ADDR_CH4 = 11)

### Archivos Excel
- **Ubicación por defecto:** `Documents/ModbusAnalyzer/`
- **Nombre:** `lecturas_ch4_co_o2.xlsx`
- **Formato:** Fecha, Hora, O₂ (%Vol), CO (ppm), CH₄ (ppm), Evento

## 📋 Uso

### 1. Iniciar Aplicación
- La aplicación se conecta automáticamente al puerto COM9
- Los datos comienzan a leerse cada 5 segundos

### 2. Control de Monitoreo
- **Iniciar Monitoreo:** Comienza la lectura continua
- **Detener Monitoreo:** Pausa la lectura

### 3. Eventos de Calibración
- **ZERO:** Marca evento de calibración cero (naranja)
- **SPAN:** Marca evento de calibración span (verde)
- **INICIO GAS PATRÓN:** Marca inicio de gas patrón (azul)
- **FIN INYECCIÓN GAS:** Marca fin de inyección (morado)

### 4. Configuración
- **Seleccionar Carpeta:** Elegir ubicación de guardado
- **Configuración:** Ajustar parámetros del sistema

## 🔧 Desarrollo

### Estructura Modular
- **UI.js:** Gestión de interfaz de usuario
- **modbus.js:** Comunicación Modbus RTU
- **excel.js:** Manejo de archivos Excel
- **constants.js:** Configuración centralizada

### Agregar Nuevas Funcionalidades
1. Crear módulo en `src/utils/` o `src/components/`
2. Importar en `main.js` o `renderer.js`
3. Actualizar configuración en `constants.js`

### Personalización
- **Colores:** Modificar `EVENT_COLORS` en `constants.js`
- **Intervalos:** Ajustar `UI_CONFIG` en `constants.js`
- **Estilos:** Editar `src/styles/styles.css`

## 📦 Distribución

### Ejecutable Portable
```bash
npm run build-portable
```
- Se crea en la carpeta `dist/`
- No requiere instalación
- Ejecutable independiente

### Instalador
```bash
npm run build
```
- Crea instalador de Windows
- Requiere configuración adicional

## 🐛 Solución de Problemas

### Error de Conexión
- Verificar que el puerto COM esté disponible
- Comprobar configuración del analizador
- Revisar permisos del puerto

### Error de Excel
- Verificar permisos de escritura en la carpeta
- Comprobar que Excel no esté abierto
- Revisar espacio en disco

### Problemas de Rendimiento
- Ajustar intervalo de lectura en `UI_CONFIG`
- Reducir puntos de datos en gráficos
- Verificar recursos del sistema

## 📞 Soporte

**Desarrollado por:** Ecoingen  
**Autor:** Felipe Opazo  
**Versión:** 1.0.0  
**Año:** 2025

---

*Monitor Analizador de Gases - Solución profesional para monitoreo industrial*
