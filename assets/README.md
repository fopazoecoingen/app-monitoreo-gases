# Recursos Locales - Modo Offline

Este directorio contiene todos los recursos externos necesarios para que la aplicación funcione sin conexión a internet.

## Estructura

```
assets/
├── css/
│   ├── fonts.css          # Definiciones de fuentes Roboto locales
│   ├── icons.css          # Iconos Font Awesome esenciales
│   └── fontawesome.min.css # CSS completo de Font Awesome (backup)
├── fonts/
│   ├── roboto-300.woff2   # Roboto Light
│   ├── roboto-400.woff2   # Roboto Regular
│   ├── roboto-500.woff2   # Roboto Medium
│   ├── roboto-600.woff2   # Roboto Semi-Bold
│   └── roboto-700.woff2   # Roboto Bold
└── js/
    └── chart.js           # Chart.js para gráficos
```

## Beneficios

- ✅ **Funcionamiento offline**: La aplicación funciona sin internet
- ✅ **Rendimiento mejorado**: Carga más rápida sin dependencias externas
- ✅ **Confiabilidad**: No depende de servicios externos
- ✅ **Privacidad**: No se envían datos a servicios de terceros

## Actualización

Para actualizar estos recursos:

1. **Fuentes Roboto**: Descargar desde [Google Fonts](https://fonts.google.com/specimen/Roboto)
2. **Chart.js**: Descargar desde [Chart.js CDN](https://cdn.jsdelivr.net/npm/chart.js/)
3. **Font Awesome**: Descargar desde [Font Awesome](https://fontawesome.com/)

## Notas

- Los archivos `.woff2` son la versión más optimizada de las fuentes
- `icons.css` contiene solo los iconos esenciales para reducir el tamaño
- `fontawesome.min.css` se mantiene como respaldo completo
