/**
 * ============================================================================
 * WATHEO - Utilidades Compartidas (/frontend/js/utils.js)
 * ============================================================================
 * Funciones puras y reutilizables para:
 * - Formateo legible de fechas y horas para el agricultor
 * - Evaluación de umbrales de salud de sensores (Verde / Amarillo / Rojo)
 * - Determinación del estado visual y mensaje de la mascota Watheo
 */

(function (window) {
  'use strict';

  function formatDateTime(isoString) {
    if (!isoString) {
      return 'Sin registro reciente';
    }
    const normalized = String(isoString).replace(' ', 'T');
    const dateObj = new Date(normalized);
    if (Number.isNaN(dateObj.getTime())) {
      return String(isoString);
    }

    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(dateObj);
  }

  function evaluateHealthStatus(value, rule) {
    if (!rule) {
      return {
        level: 'optimal',
        label: 'Óptimo',
        cardClass: 'card-health-optimal',
        badgeClass: 'badge-optimal',
        iconClass: 'ph-check-circle'
      };
    }

    if (value <= rule.criticalLow || value >= rule.criticalHigh) {
      return {
        level: 'critical',
        label: value <= rule.criticalLow ? 'Crítico (Bajo)' : 'Crítico (Alto)',
        cardClass: 'card-health-critical',
        badgeClass: 'badge-critical',
        iconClass: 'ph-warning-octagon'
      };
    }

    if (value < rule.optimalMin || value > rule.optimalMax) {
      return {
        level: 'warning',
        label: 'Precaución',
        cardClass: 'card-health-warning',
        badgeClass: 'badge-warning',
        iconClass: 'ph-warning'
      };
    }

    return {
      level: 'optimal',
      label: 'Óptimo',
      cardClass: 'card-health-optimal',
      badgeClass: 'badge-optimal',
      iconClass: 'ph-check-circle'
    };
  }

  function getMascotVisualState(adaptedData, basePathPrefix) {
    const defaultPrefix =
      (window.WatheoConfig && window.WatheoConfig.frontendPrefix) || '.';
    const prefix = basePathPrefix || defaultPrefix;
    const soil = adaptedData.sensors.soilMoisture;
    const temp = adaptedData.sensors.ambientTemperature;
    const limits =
      window.WatheoApi?.getSensorData()?.thresholds.soilMoisture || {};
    const low = limits.optimalMin ?? 35;
    const high = limits.optimalMax ?? 75;

    if (soil < low) {
      return {
        moodKey: 'thirsty',
        moodTitle: 'Suelo con humedad baja',
        moodBadgeClass: 'badge-critical',
        imagePath: prefix + '/assets/images/mascot-thirsty.svg',
        shortStatus: `Humedad baja (${soil}%)`,
        speechText: `La humedad actual es ${soil}%, menor que el mínimo configurado (${low}%). Revisa el riego. Temperatura: ${temp} °C.`
      };
    }
    if (soil > high) {
      return {
        moodKey: 'wet',
        moodTitle: 'Exceso de humedad',
        moodBadgeClass: 'badge-critical',
        imagePath: prefix + '/assets/images/mascot-thirsty.svg',
        shortStatus: `Humedad alta (${soil}%)`,
        speechText: `El suelo registra ${soil}%, por encima del máximo (${high}%). Conviene esperar antes de regar.`
      };
    }
    return {
      moodKey: 'happy',
      moodTitle: 'Humedad en rango',
      moodBadgeClass: 'badge-optimal',
      imagePath: prefix + '/assets/images/mascot-happy.svg',
      shortStatus: `Humedad adecuada (${soil}%)`,
      speechText: `La humedad real del suelo es ${soil}%, dentro del rango configurado (${low} a ${high}%). Temperatura: ${temp} °C.`
    };
  }

  function getWeatherIconClass(conditionCode) {
    const code = String(conditionCode || '').toLowerCase();
    if (code.includes('sunny') || code.includes('hot')) {
      return 'ph-sun';
    }
    if (code.includes('rain')) {
      return 'ph-cloud-rain';
    }
    if (code.includes('breeze') || code.includes('wind')) {
      return 'ph-wind';
    }
    return 'ph-cloud-sun';
  }

  window.WatheoUtils = {
    formatDateTime,
    evaluateHealthStatus,
    getMascotVisualState,
    getWeatherIconClass
  };
})(window);
