/**
 * ============================================================================
 * WATHEO - Configuración del Cliente Frontend (/frontend/js/config.js)
 * ============================================================================
 * Centraliza las rutas hacia el Backend API y los recursos estáticos para que
 * el frontend funcione tanto en el mismo servidor como desplegado en dominios
 * separados en internet (ej. Netlify/Vercel + VPS/Cloud).
 */

(function (window) {
  'use strict';

  const enSubcarpetaPages = window.location.pathname.includes('/pages/');
  const prefijoFrontend = enSubcarpetaPages ? '..' : '.';
  const prefijoRaizProyecto = enSubcarpetaPages ? '../..' : '..';

  // Si se despliega el backend en otro dominio en producción, cambiar API_BASE_URL
  // por la URL pública del backend (ej. "https://api.tudominio.com/backend/api")
  const API_BASE_URL = window.WATHEO_API_BASE || (prefijoRaizProyecto + '/backend/api');

  window.WatheoConfig = {
    POLL_INTERVAL_MS: 10000,
    DEFAULT_DEVICE_CODE: 'WATHEO-001',
    frontendPrefix: prefijoFrontend,
    rootPrefix: prefijoRaizProyecto,
    endpoints: {
      monitoreo: API_BASE_URL + '/monitoreo.php',
      historial: API_BASE_URL + '/historial.php',
      registros: API_BASE_URL + '/registros.php',
      recepcionSensor: prefijoRaizProyecto + '/backend/sensores/recibir.php'
    }
  };
})(window);
