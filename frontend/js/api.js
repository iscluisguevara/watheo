/**
 * ============================================================================
 * WATHEO - Cliente API en Tiempo Real (/frontend/js/api.js)
 * ============================================================================
 * Gestiona la comunicación con el backend desacoplado (`/backend/api/*`),
 * sincronización periódica de telemetría, historial y consulta de la tabla
 * de registros (`dbo.registros`).
 */

(function (window) {
  'use strict';

  const cfg = window.WatheoConfig || {
    POLL_INTERVAL_MS: 10000,
    DEFAULT_DEVICE_CODE: 'WATHEO-001',
    endpoints: {
      monitoreo: '../backend/api/monitoreo.php',
      historial: '../backend/api/historial.php',
      registros: '../backend/api/registros.php'
    }
  };

  const POLL_MS = cfg.POLL_INTERVAL_MS;
  const DEVICE_PREFERRED = cfg.DEFAULT_DEVICE_CODE;

  let payload = null;
  let allDevices = [];
  let lastError = null;
  let lastFetchSuccess = null;
  let historyBucket = [];
  let historySource = 'local';
  let lastAgeSeconds = null;
  const timestampsSeen = new Set();

  function number(value) {
    if (value === null || value === undefined || value === '') return null;
    const v = Number(value);
    return Number.isFinite(v) ? v : null;
  }

  function fmt(value) {
    return value == null ? '--' : Math.round(value * 10) / 10;
  }

  function dateString(value) {
    return value ? String(value).replace(' ', 'T') : null;
  }

  function buildThresholds(row) {
    const min = number(row.humedad_suelo_minima) ?? 35;
    const max = number(row.humedad_suelo_maxima) ?? 75;
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    return {
      soilMoisture: {
        unit: '%',
        criticalLow: low - 0.01,
        optimalMin: low,
        optimalMax: high,
        criticalHigh: high + 0.01,
        optimalLabel: `${low}% - ${high}%`
      },
      ambientTemp: {
        unit: '°C',
        criticalLow: 12,
        optimalMin: 18,
        optimalMax: 28,
        criticalHigh: 32,
        optimalLabel: '18°C - 28°C (referencia)'
      },
      airHumidity: {
        unit: '%',
        criticalLow: 35,
        optimalMin: 50,
        optimalMax: 75,
        criticalHigh: 88,
        optimalLabel: '50% - 75% (referencia)'
      }
    };
  }

  function addLocalHistory(stamp, soil, temp, air) {
    const key = String(stamp ?? 'no-date');
    if (timestampsSeen.has(key)) return;
    timestampsSeen.add(key);
    historyBucket.push({ label: key.slice(11, 16), soil, temp, air });
    if (historyBucket.length > 48) historyBucket.shift();
  }

  function createHistory(rows) {
    return {
      labels: rows.map(x => x.label),
      soilMoistureSeries: rows.map(x => x.soil),
      ambientTempSeries: rows.map(x => x.temp),
      airHumiditySeries: rows.map(x => x.air)
    };
  }

  function makePayload(row) {
    const soil = number(row.humedad_actual);
    const temp = number(row.temperatura_aire);
    const air = number(row.humedad_aire);
    if (
      soil === null ||
      temp === null ||
      air === null ||
      soil < 0 ||
      soil > 100 ||
      air < 0 ||
      air > 100
    ) {
      throw new Error('El dispositivo no tiene mediciones válidas todavía.');
    }
    const stamp = row.ultima_lectura;
    addLocalHistory(stamp, soil, temp, air);
    return {
      scenarioKey: 'real',
      thresholds: buildThresholds(row),
      data: {
        deviceId: row.codigo_dispositivo || 'Dispositivo',
        plotName: row.region || 'Parcela',
        cropType: row.planta || 'Planta',
        lastReadingISO: dateString(stamp),
        sensors: {
          soilMoisture: soil,
          ambientTemperature: temp,
          airHumidity: air
        },
        weather: {
          conditionCode: 'unknown',
          description: 'Sin datos meteorológicos externos',
          rainProbability: null,
          windSpeedKmh: null,
          uvIndexLabel: 'No disponible'
        },
        irrigationRelay: {
          isOn: null,
          mode: 'Sin telemetría de relé',
          flowRateLpm: null,
          lastWateringSummary: 'Estado del riego no disponible en el backend'
        },
        history24h: createHistory(historyBucket)
      }
    };
  }

  function updateStatus() {
    let bar = document.getElementById('watheo-live-indicator');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'watheo-live-indicator';
      bar.setAttribute('role', 'status');
      bar.setAttribute('aria-live', 'polite');
      document.body.prepend(bar);
    }
    const failed = Boolean(lastError);
    let message = failed
      ? `Sin conexión con SQL Server / API: ${lastError}`
      : 'Consultando mediciones reales...';

    if (!failed && payload) {
      const t = payload.data.lastReadingISO;
      if (lastAgeSeconds !== null && lastAgeSeconds > 120) {
        message = `⚠ Sin lecturas nuevas desde hace ${Math.round(lastAgeSeconds / 60)} min · Dispositivo ${payload.data.deviceId}`;
      } else {
        message = `● Datos de SQL Server · ${payload.data.deviceId} · Última lectura: ${t ? t.replace('T', ' ') : 'Sin fecha'}`;
      }
    }
    if (failed && payload) {
      message += ' · Se muestra última lectura recibida';
    }
    bar.className =
      'watheo-live-indicator ' +
      (failed ? 'watheo-connection-error' : 'watheo-connection-ok');
    bar.textContent = message;
  }

  async function loadJson(url) {
    const resp = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} en ${url}`);
    return await resp.json();
  }

  async function refresh() {
    try {
      const raw = await loadJson(cfg.endpoints.monitoreo);
      const rows = Array.isArray(raw)
        ? raw
        : Array.isArray(raw.dispositivos)
        ? raw.dispositivos
        : [];

      if (!rows.length) throw new Error('No hay dispositivos registrados');
      allDevices = rows;

      const current =
        rows.find(r => r.codigo_dispositivo === DEVICE_PREFERRED) || rows[0];
      const fresh = makePayload(current);
      payload = fresh;
      lastError = null;
      lastAgeSeconds = null;
      lastFetchSuccess = new Date();

      try {
        const histUrl =
          cfg.endpoints.historial +
          '?codigo_dispositivo=' +
          encodeURIComponent(fresh.data.deviceId) +
          '&periodo=24h';
        const hist = await loadJson(histUrl);

        if (Array.isArray(hist.lecturas)) {
          const minimum = number(hist.humedad_suelo_minima);
          const maximum = number(hist.humedad_suelo_maxima);
          if (minimum !== null && maximum !== null && minimum <= maximum) {
            fresh.thresholds = buildThresholds({
              humedad_suelo_minima: minimum,
              humedad_suelo_maxima: maximum
            });
          }

          const points = hist.lecturas.map(r => ({
            label: String(r.fecha_hora || '').slice(11, 16),
            soil: number(r.humedad_suelo),
            temp: number(r.temperatura_aire),
            air: number(r.humedad_aire)
          }));

          if (points.length) {
            historySource = 'sql';
            payload.data.history24h = createHistory(points);
          } else {
            historySource = 'local';
          }
          lastAgeSeconds = number(hist.segundos_sin_datos);
        }
      } catch (e) {
        historySource = 'local';
        lastAgeSeconds = null;
      }

      updateStatus();
      window.dispatchEvent(
        new CustomEvent('watheo:updated', { detail: { source: historySource } })
      );
    } catch (e) {
      lastError = e.message || 'Error desconocido';
      updateStatus();
      window.dispatchEvent(new Event('watheo:error'));
    }
  }

  /**
   * Consulta la tabla de registros (`dbo.registros`) en el backend.
   */
  async function fetchRegistros(filtros = {}) {
    const params = new URLSearchParams();
    if (filtros.codigo_dispositivo) {
      params.set('codigo_dispositivo', filtros.codigo_dispositivo);
    }
    if (filtros.nivel_alerta) {
      params.set('nivel_alerta', filtros.nivel_alerta);
    }
    if (filtros.limite) {
      params.set('limite', String(filtros.limite));
    }
    const query = params.toString();
    const url = cfg.endpoints.registros + (query ? '?' + query : '');
    return await loadJson(url);
  }

  function getSensorData() {
    return payload;
  }

  function getAllDevices() {
    return allDevices;
  }

  function noPhysicalControl() {
    return payload;
  }

  function assistantAnswer(question) {
    if (!payload) {
      return 'Todavía no tengo datos reales del ESP32. Revisa la conexión con el backend.';
    }
    const d = payload.data;
    const s = d.sensors;
    const v = String(question).toLowerCase();
    const low = payload.thresholds.soilMoisture.optimalMin;
    const high = payload.thresholds.soilMoisture.optimalMax;

    if (v.includes('clima') || v.includes('lluvia') || v === 'q_weather_forecast') {
      return `Puedo confirmar temperatura de ${fmt(s.ambientTemperature)} °C y humedad ambiental de ${fmt(s.airHumidity)} %, pero no hay pronóstico meteorológico integrado.`;
    }
    if (v.includes('relé') || v.includes('rele') || v.includes('bomba') || v === 'q_relay_info') {
      return 'El backend no reporta el estado físico del relé ni permite encender la bomba desde la web.';
    }
    if (v.includes('temperatura') || v.includes('calor') || v === 'q_temp_impact') {
      return `La temperatura medida es ${fmt(s.ambientTemperature)} °C y la humedad del aire ${fmt(s.airHumidity)} %. Para evaluar sus efectos es necesario considerar el cultivo.`;
    }
    if (v.includes('riego') || v.includes('regar') || v === 'q_should_water') {
      return s.soilMoisture < low
        ? `La humedad del suelo es ${fmt(s.soilMoisture)} %, menor que el mínimo configurado (${low} %). Conviene revisar el riego; esta página no puede encender la bomba.`
        : s.soilMoisture > high
        ? `La humedad del suelo es ${fmt(s.soilMoisture)} %, superior al máximo configurado (${high} %). Evita regar hasta verificar la condición.`
        : `La humedad del suelo es ${fmt(s.soilMoisture)} %, dentro del rango configurado (${low} a ${high} %).`;
    }
    if (v.includes('humedad') || v.includes('suelo') || v === 'q_status') {
      return `La última lectura del suelo es ${fmt(s.soilMoisture)} %. Rango configurado: ${low} a ${high} %. Lectura del dispositivo ${d.deviceId}.`;
    }
    return `Lecturas reales de ${d.deviceId}: suelo ${fmt(s.soilMoisture)} %, aire ${fmt(s.airHumidity)} % y temperatura ${fmt(s.ambientTemperature)} °C. Puedo explicar la humedad, temperatura y recomendaciones de riego.`;
  }

  const apiPublica = {
    getSensorData,
    getAllDevices,
    fetchRegistros,
    getActiveScenarioKey: () => 'real',
    setActiveScenarioKey: noPhysicalControl,
    setManualRelayOverride: noPhysicalControl,
    getPresetQuestions: () => [
      { id: 'q_status', question: '¿Cómo está la humedad del suelo?', icon: 'ph-drop-half-bottom' },
      { id: 'q_should_water', question: '¿Debo regar ahora?', icon: 'ph-shower' },
      { id: 'q_temp_impact', question: '¿Cómo está la temperatura?', icon: 'ph-thermometer-hot' },
      { id: 'q_weather_forecast', question: '¿Hay pronóstico de lluvia?', icon: 'ph-cloud-sun' },
      { id: 'q_relay_info', question: '¿Está encendida la bomba?', icon: 'ph-power' }
    ],
    generateAssistantReply: assistantAnswer
  };

  window.WatheoApi = apiPublica;
  window.WatheoMockApi = apiPublica;

  window.WatheoLiveStatus = {
    get connected() {
      return !lastError && !!payload;
    },
    get error() {
      return lastError;
    },
    get lastFetch() {
      return lastFetchSuccess;
    },
    get historySource() {
      return historySource;
    },
    refresh
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      updateStatus();
      refresh();
    });
  } else {
    updateStatus();
    refresh();
  }

  window.setInterval(refresh, POLL_MS);
})(window);
