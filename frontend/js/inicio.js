/**
 * ============================================================================
 * WATHEO - Controlador de la Vista Principal (/frontend/js/inicio.js)
 * ============================================================================
 */

(function () {
  'use strict';

  function applyCardHealth(cardEl, badgeEl, evaluation) {
    if (!cardEl || !badgeEl) {
      return;
    }
    cardEl.classList.remove('card-health-optimal', 'card-health-warning', 'card-health-critical');
    cardEl.classList.add(evaluation.cardClass);

    badgeEl.classList.remove('badge-optimal', 'badge-warning', 'badge-critical');
    badgeEl.classList.add(evaluation.badgeClass);
    badgeEl.innerHTML =
      '<i class="ph-fill ' + evaluation.iconClass + '"></i><span>' + evaluation.label + '</span>';
  }

  function renderHomeSummary() {
    const response = window.WatheoApi.getSensorData();
    if (!response) return;
    const data = response.data;
    const thresholds = response.thresholds;

    const plotNameEl = document.getElementById('home-plot-name');
    const lastReadingEl = document.getElementById('home-last-reading');
    const relayStatusEl = document.getElementById('home-relay-status');
    const deviceIdEl = document.getElementById('home-device-id');

    if (plotNameEl) {
      plotNameEl.textContent = data.plotName + ' • ' + data.cropType;
    }
    if (lastReadingEl) {
      lastReadingEl.textContent = window.WatheoUtils.formatDateTime(data.lastReadingISO);
    }
    if (relayStatusEl) {
      relayStatusEl.textContent = 'No disponible (sin telemetría)';
    }
    if (deviceIdEl) {
      deviceIdEl.textContent = data.deviceId;
    }

    const mascotState = window.WatheoUtils.getMascotVisualState(data);
    const mascotImgEl = document.getElementById('home-mascot-img');
    const mascotBadgeEl = document.getElementById('home-mascot-badge');
    const mascotMoodTitleEl = document.getElementById('home-mascot-mood-title');
    const mascotSpeechEl = document.getElementById('home-mascot-speech');

    if (mascotImgEl) {
      mascotImgEl.src = mascotState.imagePath;
    }
    if (mascotBadgeEl) {
      mascotBadgeEl.classList.remove('badge-optimal', 'badge-warning', 'badge-critical');
      mascotBadgeEl.classList.add(mascotState.moodBadgeClass);
    }
    if (mascotMoodTitleEl) {
      mascotMoodTitleEl.textContent = mascotState.moodTitle;
    }
    if (mascotSpeechEl) {
      mascotSpeechEl.textContent = mascotState.speechText;
    }

    const fabImgEl = document.getElementById('fab-mascot-img');
    const fabStatusEl = document.getElementById('fab-mascot-status');
    if (fabImgEl) {
      fabImgEl.src = mascotState.imagePath;
    }
    if (fabStatusEl) {
      fabStatusEl.textContent = mascotState.shortStatus;
    }

    const soilEval = window.WatheoUtils.evaluateHealthStatus(
      data.sensors.soilMoisture,
      thresholds.soilMoisture
    );
    applyCardHealth(
      document.getElementById('home-card-soil'),
      document.getElementById('home-badge-soil'),
      soilEval
    );
    document.getElementById('home-val-soil').textContent = data.sensors.soilMoisture + '%';
    document.getElementById('home-target-soil').textContent =
      'Rango óptimo: ' + thresholds.soilMoisture.optimalLabel;

    const tempEval = window.WatheoUtils.evaluateHealthStatus(
      data.sensors.ambientTemperature,
      thresholds.ambientTemp
    );
    applyCardHealth(
      document.getElementById('home-card-temp'),
      document.getElementById('home-badge-temp'),
      tempEval
    );
    document.getElementById('home-val-temp').textContent = data.sensors.ambientTemperature + '°C';
    document.getElementById('home-target-temp').textContent =
      'Rango óptimo: ' + thresholds.ambientTemp.optimalLabel;

    const airEval = window.WatheoUtils.evaluateHealthStatus(
      data.sensors.airHumidity,
      thresholds.airHumidity
    );
    applyCardHealth(
      document.getElementById('home-card-air'),
      document.getElementById('home-badge-air'),
      airEval
    );
    document.getElementById('home-val-air').textContent = data.sensors.airHumidity + '%';
    document.getElementById('home-target-air').textContent =
      'Rango óptimo: ' + thresholds.airHumidity.optimalLabel;

    const weatherIconEl = document.getElementById('home-weather-icon');
    const weatherValEl = document.getElementById('home-val-weather');
    const weatherSubEl = document.getElementById('home-sub-weather');

    if (weatherIconEl) {
      const iconName = window.WatheoUtils.getWeatherIconClass(data.weather.conditionCode);
      weatherIconEl.className = 'ph-fill ' + iconName;
    }
    if (weatherValEl) {
      weatherValEl.textContent = data.weather.description;
    }
    if (weatherSubEl) {
      weatherSubEl.textContent = 'Pronóstico no conectado';
    }
  }

  window.addEventListener('watheo:updated', renderHomeSummary);
  document.addEventListener('DOMContentLoaded', renderHomeSummary);
})();
