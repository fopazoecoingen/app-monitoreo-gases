# 🔬 Modbus Analyzer - Analizador de Gases

<div align="center">

![Modbus Analyzer](src/assets/logo.svg)

**Sistema de monitoreo y análisis de gases en tiempo real con envío automático a plataforma web**

[![Electron](https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://electronjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

</div>

## 📋 Tabla de Contenidos

- [🎯 Características Principales](#-características-principales)
- [🛠️ Tecnologías Utilizadas](#️-tecnologías-utilizadas)
- [📦 Dependencias](#-dependencias)
- [🚀 Instalación](#-instalación)
- [⚙️ Configuración](#️-configuración)
- [🎮 Uso](#-uso)
- [🏗️ Arquitectura](#️-arquitectura)
- [📊 Funcionalidades](#-funcionalidades)
- [🔧 Desarrollo](#-desarrollo)
- [📝 Licencia](#-licencia)

## 🎯 Características Principales

- **📡 Monitoreo en Tiempo Real**: Lectura continua de sensores Modbus RTU
- **💾 Almacenamiento Local**: Base de datos SQLite para persistencia de datos
- **📊 Exportación Excel**: Generación automática de reportes en Excel
- **🌐 Envío Automático**: Integración con plataforma web Ecoingen
- **🔐 Autenticación Automática**: Login automático con renovación de tokens
- **📶 Indicador de Internet**: Verificación visual del estado de conexión
- **🎨 Interfaz Moderna**: UI intuitiva y responsive
- **⚡ Tiempo Real**: Actualización instantánea de datos

## 🛠️ Tecnologías Utilizadas

### Frontend
- **Electron** - Framework para aplicaciones desktop multiplataforma
- **HTML5/CSS3** - Estructura y estilos modernos
- **JavaScript ES6+** - Lógica del frontend
- **Chart.js** - Visualización de gráficos en tiempo real

### Backend
- **Node.js** - Runtime de JavaScript
- **SQLite3** - Base de datos embebida
- **SerialPort** - Comunicación con dispositivos Modbus
- **ExcelJS** - Generación de archivos Excel
- **Axios** - Cliente HTTP para APIs
- **Form-Data** - Manejo de formularios multipart

### Comunicación
- **Modbus RTU** - Protocolo de comunicación industrial
- **IPC (Inter-Process Communication)** - Comunicación entre procesos Electron
- **HTTPS/REST** - Integración con servicios web

## 📦 Dependencias

### Principales
```json
{
  "electron": "^28.0.0",
  "serialport": "^12.0.0",
  "sqlite3": "^5.1.6",
  "exceljs": "^4.4.0",
  "axios": "^1.6.0",
  "form-data": "^4.0.0"
}
```

### Desarrollo
```json
{
  "electron-builder": "^24.0.0",
  "electron-rebuild": "^3.2.9"
}
```

## 🚀 Instalación

### Prerrequisitos
- **Node.js** >= 16.0.0
- **npm** >= 8.0.0
- **Puerto Serial** disponible (USB/COM)

### Pasos de Instalación

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd modbus-analyzer
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Reconstruir módulos nativos**
```bash
npm run rebuild
```

4. **Ejecutar en modo desarrollo**
```bash
npm start
```

5. **Construir para producción**
```bash
npm run build
```

## ⚙️ Configuración

### Configuración de Puertos Seriales
El sistema detecta automáticamente los puertos disponibles. Para configurar manualmente:

```javascript
// Configuración en main.js
const SERIAL_CONFIG = {
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none'
};
```

### Configuración de Sensores
```javascript
// Direcciones Modbus configuradas
const SENSOR_ADDRESSES = {
  O2: 4,   // Oxígeno - Dirección 40005
  CO: 7,   // Monóxido de Carbono
  CH4: 11  // Metano
};
```

## 🎮 Uso

### 1. Inicio de la Aplicación
- La aplicación se conecta automáticamente a la plataforma Ecoingen
- Se realiza autenticación automática al iniciar
- El indicador de internet muestra el estado de conexión

### 2. Configuración de Medición
- Seleccionar puerto serial del dispositivo Modbus
- Elegir gases a monitorear (O₂, CO, CH₄)
- Configurar tipo de evento (Normal, Mantenimiento, etc.)

### 3. Inicio de Medición
- Presionar "Iniciar Medición"
- Los datos se muestran en tiempo real
- Se almacenan automáticamente en la base de datos

### 4. Envío a Plataforma
- Presionar el botón ⬆️ en cualquier medición
- El sistema genera un archivo Excel automáticamente
- Se envía a la plataforma web con autenticación automática

## 🏗️ Arquitectura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (Renderer)    │◄──►│   (Main)        │◄──►│   (SQLite)      │
│                 │    │                 │    │                 │
│ • UI Components │    │ • IPC Handlers  │    │ • Mediciones    │
│ • Charts        │    │ • Serial Com    │    │ • Lecturas      │
│ • Indicators    │    │ • Auth Service  │    │ • Config        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Platform  │    │   Modbus RTU    │    │   File System   │
│   (Ecoingen)    │    │   (Sensors)     │    │   (Excel)       │
│                 │    │                 │    │                 │
│ • JWT Auth      │    │ • Gas Sensors   │    │ • Reports       │
│ • Blob Storage  │    │ • Serial Port   │    │ • Attachments   │
│ • Auto Upload   │    │ • Real-time     │    │ • Templates     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📊 Funcionalidades

### 🔬 Monitoreo de Gases
- **Oxígeno (O₂)**: Medición en porcentaje
- **Monóxido de Carbono (CO)**: Medición en ppm
- **Metano (CH₄)**: Medición en porcentaje
- **Tiempo Real**: Actualización cada segundo
- **Gráficos**: Visualización histórica con Chart.js

### 💾 Gestión de Datos
- **Almacenamiento Local**: Base de datos SQLite embebida
- **Historial Completo**: Todas las mediciones guardadas
- **Búsqueda y Filtros**: Por fecha, tipo de evento, gas
- **Exportación**: Archivos Excel con formato profesional

### 🌐 Integración Web
- **Autenticación Automática**: Login automático al iniciar
- **Token Dinámico**: Renovación automática cada 20 minutos
- **Envío Inteligente**: Solo mediciones no enviadas
- **Estado Visual**: Indicador de conexión en tiempo real

### 📱 Interfaz de Usuario
- **Diseño Moderno**: UI limpia y profesional
- **Responsive**: Adaptable a diferentes tamaños
- **Indicadores Visuales**: Estados claros de conexión
- **Navegación Intuitiva**: Fácil de usar

## 🔧 Desarrollo

### Estructura del Proyecto
```
modbus-analyzer/
├── src/
│   ├── utils/           # Utilidades del backend
│   │   ├── auth-service.js      # Autenticación automática
│   │   ├── blob-service.js      # Servicio de envío web
│   │   ├── blob-sender.js       # Envío de archivos
│   │   ├── database.js          # Gestión de base de datos
│   │   ├── excel.js             # Generación de Excel
│   │   ├── internet.js          # Verificación de conexión
│   │   └── modbus.js            # Comunicación Modbus
│   ├── js/
│   │   └── mediciones-manager.js # Gestión del frontend
│   ├── assets/          # Recursos estáticos
│   └── components/      # Componentes UI
├── main.js              # Proceso principal Electron
├── renderer.js          # Proceso de renderizado
├── preload.js           # Script de precarga
├── index.html           # Estructura HTML principal
└── styles.css           # Estilos CSS
```

### Scripts Disponibles
```bash
npm start          # Ejecutar en modo desarrollo
npm run build      # Construir para producción
npm run rebuild    # Reconstruir módulos nativos
npm run dist       # Crear distributables
npm run pack       # Empaquetar aplicación
```

### Variables de Entorno
```bash
# Configuración de desarrollo
NODE_ENV=development
ELECTRON_IS_DEV=true

# Configuración de producción
NODE_ENV=production
ELECTRON_IS_DEV=false
```

## 🔒 Seguridad

- **Autenticación JWT**: Tokens seguros con expiración
- **HTTPS**: Comunicación encriptada con servidor
- **Certificados SSL**: Manejo de certificados auto-firmados
- **Validación de Datos**: Sanitización de entradas
- **Almacenamiento Local**: Datos sensibles en SQLite local

## 📈 Rendimiento

- **Lectura Asíncrona**: No bloquea la interfaz
- **Cache Inteligente**: Datos frecuentemente accedidos
- **Limpieza Automática**: Gestión de memoria optimizada
- **Timeouts Configurables**: Evita bloqueos indefinidos

## 🐛 Solución de Problemas

### Problemas Comunes

1. **Puerto Serial No Disponible**
   - Verificar que el dispositivo esté conectado
   - Comprobar permisos de puerto serial
   - Reiniciar la aplicación

2. **Error de Autenticación**
   - Verificar conexión a internet
   - Comprobar credenciales en auth-service.js
   - Revisar logs de consola

3. **Archivos Excel No Se Generan**
   - Verificar permisos de escritura
   - Comprobar espacio en disco
   - Revisar dependencias ExcelJS

### Logs y Debugging
```bash
# Ejecutar con logs detallados
npm start -- --debug

# Ver logs en tiempo real
tail -f logs/app.log
```

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

## 👥 Contribuidores

- **Felipe Opazo** - Desarrollo principal
- **Ecoingen** - Requerimientos y testing

## 📞 Soporte

Para soporte técnico o consultas:
- **Email**: soporte@ecoingen.com
- **Teléfono**: +56 9 XXXX XXXX
- **Web**: https://www.ecoingen.com

---

<div align="center">

**🔬 Modbus Analyzer - Monitoreo Inteligente de Gases**

*Desarrollado con ❤️ para Ecoingen*

</div>
