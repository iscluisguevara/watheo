/**
 * ============================================================================
 * WATHEO - Controlador del Dashboard y Gráficas (/frontend/js/dashboard.js)
 * ============================================================================
 */

(function () {
  'use strict';

  let moistureChartInstance = null;
  let temperatureChartInstance = null;

  function updateCardHealthStyles(cardId, badgeId, evaluation) {
    const cardEl = document.getElementById(cardId);
    const badgeEl = document.getElementById(badgeId);
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

  function fallbackCanvasChart(canvas, labels, series, minimum, maximum) {
    if (!canvas) return;
    const width = Math.max(320, canvas.clientWidth || 500);
    const height = Math.max(200, canvas.clientHeight || 280);
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const L = 48, R = 14, T = 28, B = 38;
    ctx.font = '12px sans-serif';
    ctx.strokeStyle = '#e0eae0';
    ctx.fillStyle = '#7a8c7a';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = T + ((height - T - B) * i) / 4;
      ctx.beginPath();
      ctx.moveTo(L, y);
      ctx.lineTo(width - R, y);
      ctx.stroke();
      ctx.fillText(String(Math.round(maximum - ((maximum - minimum) * i) / 4)), 5, y + 4);
    }
    if (labels.length === 0) {
      ctx.fillText('Aún no hay registros para la gráfica', L + 14, T + 60);
      return;
    }
    const plotW = width - L - R;
    const plotH = height - T - B;
    series.forEach((item, index) => {
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < labels.length; i++) {
        const v = item.values[i];
        if (v == null || !Number.isFinite(v)) {
          started = false;
          continue;
        }
        const x = L + (labels.length === 1 ? plotW / 2 : (i * plotW) / (labels.length - 1));
        const y = T + (1 - (v - minimum) / (maximum - minimum)) * plotH;
        if (started) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
        started = true;
      }
      ctx.stroke();
      ctx.fillStyle = item.color;
      ctx.fillRect(L + index * 115, 8, 10, 4);
      ctx.fillText(item.name, L + 14 + index * 115, 14);
    });
    ctx.fillStyle = '#7a8c7a';
    ctx.fillText(labels[0], L, height - 12);
    if (labels.length > 1) ctx.fillText(labels[labels.length - 1], width - 65, height - 12);
  }

  function renderCharts(history24h) {
    if (typeof window.Chart === 'undefined') {
      fallbackCanvasChart(
        document.getElementById('moistureHistoryChart'),
        history24h.labels,
        [
          { name: 'Suelo', values: history24h.soilMoistureSeries, color: '#2D6A4F' },
          { name: 'Aire', values: history24h.airHumiditySeries, color: '#0077B6' }
        ],
        0,
        100
      );
      const vals = history24h.ambientTempSeries.filter(v => v !== null && Number.isFinite(v));
      const lo = vals.length ? Math.floor(Math.min(...vals) - 3) : 0;
      const hi = vals.length ? Math.ceil(Math.max(...vals) + 3) : 45;
      fallbackCanvasChart(
        document.getElementById('temperatureHistoryChart'),
        history24h.labels,
        [{ name: 'Temperatura', values: history24h.ambientTempSeries, color: '#bb7b3e' }],
        lo,
        hi > lo ? hi : lo + 1
      );
      return;
    }

    const moistureCtx = document.getElementById('moistureHistoryChart');
    const tempCtx = document.getElementById('temperatureHistoryChart');

    if (moistureChartInstance) {
      moistureChartInstance.data.labels = history24h.labels;
      moistureChartInstance.data.datasets[0].data = history24h.soilMoistureSeries;
      moistureChartInstance.data.datasets[1].data = history24h.airHumiditySeries;
      moistureChartInstance.update();
    } else if (moistureCtx) {
      moistureChartInstance = new window.Chart(moistureCtx, {
        type: 'line',
        data: {
          labels: history24h.labels,
          datasets: [
            {
              label: 'Humedad del Suelo (%)',
              data: history24h.soilMoistureSeries,
              borderColor: '#2D6A4F',
              backgroundColor: 'rgba(82, 183, 136, 0.22)',
              borderWidth: 3,
              pointBackgroundColor: '#1B4332',
              pointRadius: 4,
              fill: true,
              tension: 0.35
            },
            {
              label: 'Humedad del Aire (%)',
              data: history24h.airHumiditySeries,
              borderColor: '#0077B6',
              backgroundColor: 'rgba(0, 180, 216, 0.1)',
              borderWidth: 2.5,
              borderDash: [5, 5],
              pointBackgroundColor: '#0077B6',
              pointRadius: 3.5,
              fill: false,
              tension: 0.35
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: {
                font: {
                  family: "'Plus Jakarta Sans', sans-serif",
                  weight: '600'
                }
              }
            }
          },
          scales: {
            y: {
              min: 0,
              max: 100,
              ticks: {
                callback: function (value) {
                  return value + '%';
                }
              }
            }
          }
        }
      });
    }

    if (temperatureChartInstance) {
      temperatureChartInstance.data.labels = history24h.labels;
      temperatureChartInstance.data.datasets[0].data = history24h.ambientTempSeries;
      temperatureChartInstance.update();
    } else if (tempCtx) {
      temperatureChartInstance = new window.Chart(tempCtx, {
        type: 'bar',
        data: {
          labels: history24h.labels,
          datasets: [
            {
              label: 'Temperatura Ambiente (°C)',
              data: history24h.ambientTempSeries,
              backgroundColor: 'rgba(221, 161, 94, 0.78)',
              borderColor: '#7F4F24',
              borderWidth: 2,
              borderRadius: 8
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: {
                font: {
                  family: "'Plus Jakarta Sans', sans-serif",
                  weight: '600'
                }
              }
            }
          },
          scales: {
            y: {
              suggestedMin: 10,
              suggestedMax: 40,
              ticks: {
                callback: function (value) {
                  return value + '°C';
                }
              }
            }
          }
        }
      });
    }
  }

  function renderDashboard() {
    const payload = window.WatheoApi.getSensorData();
    if (!payload) return;
    const data = payload.data;
    const thresholds = payload.thresholds;

    document.getElementById('dash-last-reading').textContent =
      window.WatheoUtils.formatDateTime(data.lastReadingISO);
    document.getElementById('dash-plot-info').textContent =
      data.plotName + ' (' + data.deviceId + ')';

    const relayIconBox = document.getElementById('dash-relay-icon-box');
    const relayPill = document.getElementById('dash-relay-pill');
    const relayStateText = document.getElementById('dash-relay-state-text');
    const relayDetail = document.getElementById('dash-relay-detail');
    const overrideBtn = document.getElementById('btn-manual-override');
    const overrideBtnText = document.getElementById('btn-manual-override-text');

    if (relayIconBox) relayIconBox.className = 'featured-icon-lg featured-icon-relay-off';
    if (relayPill) relayPill.className = 'relay-status-pill relay-pill-off';
    if (relayStateText) relayStateText.textContent = 'NO DISPONIBLE';
    if (relayDetail) relayDetail.textContent = 'El backend actual no informa el estado físico de la bomba.';
    if (overrideBtn) overrideBtn.disabled = true;
    if (overrideBtnText) overrideBtnText.textContent = 'Control no disponible';

    const soilEval = window.WatheoUtils.evaluateHealthStatus(
      data.sensors.soilMoisture,
      thresholds.soilMoisture
    );
    updateCardHealthStyles('dash-card-soil', 'dash-badge-soil', soilEval);
    document.getElementById('dash-val-soil').textContent = data.sensors.soilMoisture + '%';
    document.getElementById('dash-soil-range').textContent = thresholds.soilMoisture.optimalLabel;

    const tempEval = window.WatheoUtils.evaluateHealthStatus(
      data.sensors.ambientTemperature,
      thresholds.ambientTemp
    );
    updateCardHealthStyles('dash-card-temp', 'dash-badge-temp', tempEval);
    document.getElementById('dash-val-temp').textContent = data.sensors.ambientTemperature + '°C';

    const airEval = window.WatheoUtils.evaluateHealthStatus(
      data.sensors.airHumidity,
      thresholds.airHumidity
    );
    updateCardHealthStyles('dash-card-air', 'dash-badge-air', airEval);
    document.getElementById('dash-val-air').textContent = data.sensors.airHumidity + '%';

    const weatherIconEl = document.getElementById('dash-weather-icon');
    if (weatherIconEl) {
      weatherIconEl.className =
        'ph-fill ' + window.WatheoUtils.getWeatherIconClass(data.weather.conditionCode);
    }
    document.getElementById('dash-val-weather').textContent = data.weather.description;
    document.getElementById('dash-weather-rain').textContent = 'Pronóstico no conectado';
    document.getElementById('dash-weather-uv').textContent = 'UV: No disponible';

    const mascotState = window.WatheoUtils.getMascotVisualState(data);
    const mascotBadgeEl = document.getElementById('dash-mascot-badge');
    if (mascotBadgeEl) {
      mascotBadgeEl.className = 'health-badge ' + mascotState.moodBadgeClass;
      mascotBadgeEl.textContent = mascotState.moodTitle;
    }

    const mascotImgEl = document.getElementById('dash-mascot-img');
    if (mascotImgEl) mascotImgEl.src = mascotState.imagePath;

    const mascotTitleEl = document.getElementById('dash-mascot-title');
    if (mascotTitleEl) mascotTitleEl.textContent = mascotState.moodTitle;

    const mascotSpeechEl = document.getElementById('dash-mascot-speech');
    if (mascotSpeechEl) mascotSpeechEl.textContent = mascotState.speechText;

    const fabImgEl = document.getElementById('fab-mascot-img');
    if (fabImgEl) fabImgEl.src = mascotState.imagePath;

    const fabStatusEl = document.getElementById('fab-mascot-status');
    if (fabStatusEl) fabStatusEl.textContent = mascotState.shortStatus;

    renderCharts(data.history24h);
  }

  function setupEventListeners() {
    const btn = document.getElementById('btn-manual-override');
    if (btn) {
      btn.disabled = true;
      btn.title = 'Se requiere un endpoint seguro de control físico';
    }
  }

  window.addEventListener('watheo:updated', renderDashboard);
  document.addEventListener('DOMContentLoaded', function () {
    setupEventListeners();
    renderDashboard();
  });
})();
