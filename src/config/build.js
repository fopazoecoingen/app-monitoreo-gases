// Configuración de build para electron-builder
const path = require('path');

module.exports = {
    appId: 'com.ecoingen.modbus-analyzer',
    productName: 'Monitor Analizador de Gases',
    directories: {
        output: 'dist',
        buildResources: 'build'
    },
    files: [
        'src/**/*',
        'index.html',
        'preload.js',
        'node_modules/**/*',
        '!node_modules/**/*.d.ts',
        '!node_modules/**/test/**',
        '!node_modules/**/tests/**',
        '!node_modules/**/*.map'
    ],
    win: {
        target: 'portable',
        icon: path.join(__dirname, '../assets/icon.ico')
    },
    nsis: {
        oneClick: false,
        allowToChangeInstallationDirectory: true,
        installerIcon: path.join(__dirname, '../assets/icon.ico'),
        uninstallerIcon: path.join(__dirname, '../assets/icon.ico'),
        installerHeaderIcon: path.join(__dirname, '../assets/icon.ico'),
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        shortcutName: 'Monitor Analizador de Gases'
    },
    portable: {
        artifactName: 'MonitorAnalizadorGases-${version}-portable.exe'
    },
    extraResources: [
        {
            from: 'src/assets/',
            to: 'assets/',
            filter: ['**/*']
        }
    ]
};

