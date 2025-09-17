# 📦 Guía de Instalación - Modbus Analyzer

## 🚀 **Instalación en Otra PC**

### **Método 1: Archivo ZIP (Recomendado)**

1. **Descargar el archivo:**
   - Usa el archivo `ModbusAnalyzer-Portable.zip` que se creó
   - O copia toda la carpeta `ModbusAnalyzer-win32-x64`

2. **En la PC destino:**
   - Extrae el archivo ZIP en cualquier carpeta (ej: `C:\Program Files\ModbusAnalyzer\`)
   - O copia la carpeta completa

3. **Ejecutar:**
   - Ve a la carpeta extraída
   - Haz doble clic en `ModbusAnalyzer.exe`

### **Método 2: Copia Directa**

1. **Copia la carpeta completa:**
   ```
   dist/ModbusAnalyzer-win32-x64/
   ```

2. **Pégala en la PC destino:**
   - Ubicación recomendada: `C:\Program Files\ModbusAnalyzer\`
   - O en el Escritorio para fácil acceso

3. **Ejecuta la aplicación:**
   - Navega a la carpeta
   - Haz doble clic en `ModbusAnalyzer.exe`

## ⚙️ **Configuración Inicial**

### **1. Conectar el Analizador:**
- Conecta el analizador al puerto serie (COM9 por defecto)
- Enciende el analizador

### **2. Configurar la Aplicación:**
- Abre `ModbusAnalyzer.exe`
- En el panel izquierdo:
  - **Puerto:** COM9 (o el puerto correcto)
  - **Slave ID:** 1
- Haz clic en "Conectar Analizador"

### **3. Iniciar Monitoreo:**
- Ajusta el intervalo de lectura (2.0 segundos por defecto)
- Haz clic en "Iniciar Monitoreo"
- Los datos aparecerán en tiempo real

## 🔧 **Solución de Problemas**

### **Error: "No se puede conectar"**
- ✅ Verifica que el analizador esté encendido
- ✅ Confirma que el puerto COM sea correcto
- ✅ Asegúrate de que no haya otra aplicación usando el puerto

### **Error: "Puerto no encontrado"**
- ✅ Verifica que el cable esté conectado
- ✅ Revisa el Administrador de Dispositivos de Windows
- ✅ Prueba con otro puerto COM

### **Error: "No se leen datos"**
- ✅ Verifica la configuración del Slave ID
- ✅ Confirma que las direcciones de registros sean correctas
- ✅ Revisa la configuración de baudrate (9600)

## 📁 **Estructura de Archivos**

```
ModbusAnalyzer-win32-x64/
├── ModbusAnalyzer.exe          # Ejecutable principal
├── resources/                  # Archivos de la aplicación
│   └── app/                   # Código fuente
├── locales/                   # Idiomas soportados
├── *.dll                      # Librerías del sistema
└── lecturas_ch4_co_o2.xlsx    # Archivo de datos (se crea automáticamente)
```

## 🎯 **Características del Ejecutable**

- ✅ **Portable:** No requiere instalación
- ✅ **Completo:** Incluye todas las dependencias
- ✅ **Independiente:** No necesita Node.js ni Python
- ✅ **Profesional:** Interfaz industrial moderna
- ✅ **Funcional:** Lectura Modbus RTU completa

## 📊 **Datos Generados**

La aplicación crea automáticamente:
- `lecturas_ch4_co_o2.xlsx` - Archivo Excel con todos los datos
- Datos en tiempo real en la interfaz
- Historial de lecturas

## 🔄 **Actualizaciones**

Para actualizar la aplicación:
1. Reemplaza la carpeta completa con la nueva versión
2. Los datos existentes se mantienen
3. No se pierde configuración

## 📞 **Soporte**

Si tienes problemas:
1. Verifica los requisitos del sistema
2. Revisa la configuración del puerto
3. Confirma que el analizador esté funcionando
4. Consulta esta guía de solución de problemas

---
**Desarrollado por Felipe Opazo**  
**Versión 1.0.0**  
**Fecha: Septiembre 2025**

