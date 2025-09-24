// Utilidades para verificar conexión a internet
const https = require('https');
const http = require('http');

class InternetChecker {
    constructor() {
        this.timeout = 5000; // 5 segundos de timeout
        this.testUrls = [
            'https://www.google.com',
            'https://www.cloudflare.com',
            'https://httpbin.org/get'
        ];
    }

    /**
     * Verifica si hay conexión a internet
     * @param {string} customUrl - URL personalizada para probar (opcional)
     * @returns {Promise<{connected: boolean, latency: number, error?: string}>}
     */
    async checkConnection(customUrl = null) {
        const urls = customUrl ? [customUrl] : this.testUrls;
        
        for (const url of urls) {
            try {
                const result = await this.pingUrl(url);
                if (result.connected) {
                    console.log(`✅ Conexión a internet verificada en ${url} (${result.latency}ms)`);
                    return result;
                }
            } catch (error) {
                console.log(`❌ Error verificando ${url}: ${error.message}`);
                continue;
            }
        }

        console.log('❌ No se pudo establecer conexión a internet');
        return {
            connected: false,
            latency: 0,
            error: 'No se pudo conectar a ningún servidor de prueba'
        };
    }

    /**
     * Prueba la conectividad a una URL específica
     * @param {string} url - URL a probar
     * @returns {Promise<{connected: boolean, latency: number, error?: string}>}
     */
    pingUrl(url) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const isHttps = url.startsWith('https://');
            const client = isHttps ? https : http;

            const request = client.get(url, {
                timeout: this.timeout,
                headers: {
                    'User-Agent': 'ModbusAnalyzer/1.0'
                }
            }, (response) => {
                const latency = Date.now() - startTime;
                
                // Consideramos conectado si recibimos cualquier respuesta HTTP
                if (response.statusCode >= 200 && response.statusCode < 500) {
                    resolve({
                        connected: true,
                        latency: latency,
                        statusCode: response.statusCode
                    });
                } else {
                    resolve({
                        connected: false,
                        latency: latency,
                        error: `HTTP ${response.statusCode}`
                    });
                }
            });

            request.on('error', (error) => {
                const latency = Date.now() - startTime;
                resolve({
                    connected: false,
                    latency: latency,
                    error: error.message
                });
            });

            request.on('timeout', () => {
                request.destroy();
                const latency = Date.now() - startTime;
                resolve({
                    connected: false,
                    latency: latency,
                    error: 'Timeout'
                });
            });

            // Timeout manual como respaldo
            setTimeout(() => {
                if (!request.destroyed) {
                    request.destroy();
                    const latency = Date.now() - startTime;
                    resolve({
                        connected: false,
                        latency: latency,
                        error: 'Timeout manual'
                    });
                }
            }, this.timeout);
        });
    }

    /**
     * Verifica múltiples URLs y devuelve el mejor resultado
     * @returns {Promise<{connected: boolean, latency: number, bestUrl?: string, error?: string}>}
     */
    async checkMultipleUrls() {
        const results = [];
        
        console.log('🔍 Verificando conexión a internet...');
        
        for (const url of this.testUrls) {
            try {
                const result = await this.pingUrl(url);
                results.push({
                    ...result,
                    url: url
                });
                
                // Si encontramos una conexión exitosa, la devolvemos inmediatamente
                if (result.connected) {
                    return {
                        connected: true,
                        latency: result.latency,
                        bestUrl: url,
                        allResults: results
                    };
                }
            } catch (error) {
                results.push({
                    connected: false,
                    latency: 0,
                    error: error.message,
                    url: url
                });
            }
        }

        // Si no hay conexiones exitosas, devolver el resultado con menor latencia
        const bestResult = results.reduce((best, current) => {
            if (current.latency > 0 && (best.latency === 0 || current.latency < best.latency)) {
                return current;
            }
            return best;
        });

        return {
            connected: false,
            latency: bestResult.latency || 0,
            bestUrl: bestResult.url,
            error: bestResult.error || 'No se pudo conectar',
            allResults: results
        };
    }

    /**
     * Verifica la conexión de forma continua hasta que esté disponible
     * @param {number} interval - Intervalo entre verificaciones en ms (default: 5000)
     * @param {number} maxAttempts - Máximo número de intentos (default: 12 = 1 minuto)
     * @returns {Promise<{connected: boolean, attempts: number, totalTime: number}>}
     */
    async waitForConnection(interval = 5000, maxAttempts = 12) {
        console.log(`🔄 Esperando conexión a internet (máximo ${maxAttempts} intentos, intervalo: ${interval}ms)...`);
        
        const startTime = Date.now();
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            console.log(`Intento ${attempt}/${maxAttempts}...`);
            
            const result = await this.checkConnection();
            
            if (result.connected) {
                const totalTime = Date.now() - startTime;
                console.log(`✅ Conexión establecida después de ${attempt} intentos (${totalTime}ms total)`);
                return {
                    connected: true,
                    attempts: attempt,
                    totalTime: totalTime,
                    latency: result.latency
                };
            }
            
            if (attempt < maxAttempts) {
                console.log(`⏳ Esperando ${interval}ms antes del siguiente intento...`);
                await new Promise(resolve => setTimeout(resolve, interval));
            }
        }
        
        const totalTime = Date.now() - startTime;
        console.log(`❌ No se pudo establecer conexión después de ${maxAttempts} intentos (${totalTime}ms total)`);
        return {
            connected: false,
            attempts: maxAttempts,
            totalTime: totalTime
        };
    }

    /**
     * Obtiene información de la conexión de red
     * @returns {object} Información básica de la red
     */
    getNetworkInfo() {
        const os = require('os');
        const networkInterfaces = os.networkInterfaces();
        
        const info = {
            hostname: os.hostname(),
            platform: os.platform(),
            interfaces: []
        };

        for (const [name, interfaces] of Object.entries(networkInterfaces)) {
            for (const iface of interfaces) {
                if (!iface.internal && iface.family === 'IPv4') {
                    info.interfaces.push({
                        name: name,
                        address: iface.address,
                        netmask: iface.netmask,
                        mac: iface.mac
                    });
                }
            }
        }

        return info;
    }
}

module.exports = InternetChecker;
