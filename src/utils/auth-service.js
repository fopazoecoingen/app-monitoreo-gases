const axios = require('axios');
const path = require('path');

/**
 * Servicio de autenticación automática para la plataforma Ecoingen
 */
class AuthService {
    constructor() {
        this.token = null;
        this.tokenExpiry = null;
        this.baseUrl = 'https://localhost:5001';
        this.loginEndpoint = '/api/SSO/Login';
        this.isAuthenticating = false;
        this.refreshInterval = null;
        
        // Configuración de credenciales (en un entorno real, esto debería estar en variables de entorno)
        this.credentials = {
            accessToken: "string", // Este campo parece ser requerido pero no se usa realmente
            usuario: "laboratorio@ecoingen.com",
            password: "1234",
            rol: "laboratorio",
            nombre: "Laboratorio Ecoingen",
            listaEmpresas: [
                {
                    "id": 2,
                    "descripcion": "DS138"
                },
                {
                    "id": 3,
                    "descripcion": "SINADER MENSUAL"
                },
                {
                    "id": 4,
                    "descripcion": "SINADER ANUAL"
                },
                {
                    "id": 5,
                    "descripcion": "SISAT MANTENCIONES"
                },
                {
                    "id": 10,
                    "descripcion": "RESPONSABILIDAD DEL PRODUCTOR (LEY REP)"
                },
                {
                    "id": 11,
                    "descripcion": "REPORTE TRIMESTRAL"
                },
                {
                    "id": 12,
                    "descripcion": "HUELLA CARBONO - PLAN 1"
                },
                {
                    "id": 15,
                    "descripcion": "BALANCE NACIONAL ENERGIA"
                },
                {
                    "id": 18,
                    "descripcion": "AUDITORIA"
                }
            ],
            idTransportista: 0,
            idEmpresaMantencion: 0,
            version: 0
        };
    }

    /**
     * Realiza el login y obtiene un token válido
     */
    async login() {
        if (this.isAuthenticating) {
            console.log('🔄 Login ya en progreso, esperando...');
            // Esperar hasta que termine el login actual
            while (this.isAuthenticating) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return this.token;
        }

        this.isAuthenticating = true;
        
        try {
            console.log('🔐 Iniciando autenticación automática...');
            
            const response = await axios.post(
                `${this.baseUrl}${this.loginEndpoint}`,
                this.credentials,
                {
                    headers: {
                        'accept': 'text/plain',
                        'Content-Type': 'application/json'
                    },
                    httpsAgent: new (require('https')).Agent({
                        rejectUnauthorized: false // Para certificados autofirmados
                    }),
                    timeout: 10000 // 10 segundos de timeout
                }
            );

            console.log('📊 Respuesta completa del servidor:', JSON.stringify(response.data, null, 2));
            
            // Buscar el token en diferentes formatos de respuesta
            let token = null;
            let expires = null;
            
            if (response.data) {
                // Formato 1: { token: "..." }
                if (response.data.token) {
                    token = response.data.token;
                    expires = response.data.expires || response.data.expiry;
                }
                // Formato 2: { accessToken: "..." }
                else if (response.data.accessToken) {
                    token = response.data.accessToken;
                    expires = response.data.expires || response.data.expiry;
                }
                // Formato 3: { access_token: "..." }
                else if (response.data.access_token) {
                    token = response.data.access_token;
                    expires = response.data.expires_in;
                }
                // Formato 4: { data: { token: "..." } }
                else if (response.data.data && response.data.data.token) {
                    token = response.data.data.token;
                    expires = response.data.data.expires;
                }
                // Formato 5: String directo (JWT token)
                else if (typeof response.data === 'string' && response.data.includes('.')) {
                    token = response.data;
                }
            }

            if (token) {
                this.token = token;
                // Calcular expiración basada en el JWT si no se proporciona
                if (!expires && token.includes('.')) {
                    try {
                        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
                        if (payload.exp) {
                            expires = payload.exp * 1000; // Convertir de segundos a milisegundos
                        }
                    } catch (e) {
                        console.log('⚠️ No se pudo decodificar el JWT para obtener expiración');
                    }
                }
                
                this.tokenExpiry = new Date(expires || Date.now() + (24 * 60 * 60 * 1000)); // 24 horas por defecto
                
                console.log('✅ Autenticación exitosa');
                console.log(`🔑 Token obtenido: ${this.token.substring(0, 50)}...`);
                console.log(`⏰ Expira: ${this.tokenExpiry.toLocaleString()}`);
                
                return this.token;
            } else {
                throw new Error(`Respuesta de login no contiene token. Formato de respuesta: ${JSON.stringify(response.data)}`);
            }

        } catch (error) {
            console.error('❌ Error en autenticación:', error.message);
            if (error.response) {
                console.error('📊 Respuesta del servidor:', error.response.status, error.response.data);
            }
            throw error;
        } finally {
            this.isAuthenticating = false;
        }
    }

    /**
     * Obtiene un token válido (renueva automáticamente si es necesario)
     */
    async getValidToken() {
        // Si no hay token o está próximo a expirar (menos de 5 minutos), renovar
        const fiveMinutesFromNow = new Date(Date.now() + (5 * 60 * 1000));
        
        if (!this.token || !this.tokenExpiry || this.tokenExpiry <= fiveMinutesFromNow) {
            console.log('🔄 Token expirado o próximo a expirar, renovando...');
            await this.login();
        }
        
        return this.token;
    }

    /**
     * Verifica si el token está válido
     */
    isTokenValid() {
        if (!this.token || !this.tokenExpiry) {
            return false;
        }
        
        const now = new Date();
        const bufferTime = 5 * 60 * 1000; // 5 minutos de buffer
        
        return this.tokenExpiry > new Date(now.getTime() + bufferTime);
    }

    /**
     * Obtiene los headers de autorización
     */
    async getAuthHeaders() {
        const token = await this.getValidToken();
        return {
            'accept': '*/*',
            'Authorization': `Bearer ${token}`
        };
    }

    /**
     * Inicializa la autenticación automática
     */
    async initialize() {
        try {
            console.log('🚀 Inicializando servicio de autenticación...');
            await this.login();
            
            // Iniciar renovación automática cada 20 minutos
            this.startAutoRefresh();
            
            console.log('✅ Servicio de autenticación inicializado correctamente');
            return true;
        } catch (error) {
            console.error('❌ Error al inicializar autenticación:', error.message);
            return false;
        }
    }

    /**
     * Inicia la renovación automática del token
     */
    startAutoRefresh() {
        // Limpiar intervalo anterior si existe
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        // Renovar cada 20 minutos (1200000 ms)
        this.refreshInterval = setInterval(async () => {
            try {
                console.log('🔄 Renovación automática de token...');
                await this.refreshToken();
                console.log('✅ Token renovado automáticamente');
            } catch (error) {
                console.error('❌ Error en renovación automática:', error.message);
            }
        }, 20 * 60 * 1000); // 20 minutos

        console.log('⏰ Renovación automática de token configurada (cada 20 minutos)');
    }

    /**
     * Detiene la renovación automática
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
            console.log('⏹️ Renovación automática detenida');
        }
    }

    /**
     * Fuerza la renovación del token
     */
    async refreshToken() {
        console.log('🔄 Forzando renovación de token...');
        this.token = null;
        this.tokenExpiry = null;
        return await this.login();
    }

    /**
     * Obtiene información del token actual
     */
    getTokenInfo() {
        return {
            hasToken: !!this.token,
            tokenPreview: this.token ? `${this.token.substring(0, 50)}...` : null,
            expiry: this.tokenExpiry,
            isValid: this.isTokenValid(),
            isExpired: this.tokenExpiry ? this.tokenExpiry <= new Date() : true
        };
    }

    /**
     * Limpia recursos y detiene renovación automática
     */
    cleanup() {
        this.stopAutoRefresh();
        this.token = null;
        this.tokenExpiry = null;
        console.log('🧹 Recursos de autenticación limpiados');
    }
}

module.exports = AuthService;
