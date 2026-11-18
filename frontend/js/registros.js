/**
 * ============================================================================
 * WATHEO - Controlador de la Tabla de Registros (/frontend/js/registros.js)
 * ============================================================================
 * Consulta la tabla `dbo.registros` del backend, permite filtrar por nodo,
 * estado agronómico y cantidad de filas, y exportar la bitácora a CSV.
 */

(function () {
  'use strict';

  let registrosActuales = [];

  const tbodyEl = document.getElementById('records-tbody');
  const filterDeviceEl = document.getElementById('filter-device');
  const filterAlertEl = document.getElementById('filter-alert');
  const filterLimitEl = document.getElementById('filter-limit');
  const btnRefreshEl = document.getElementById('btn-refresh-records');
  const btnExportCsvEl = document.getElementById('btn-export-csv');
  const footerCountEl = document.getElementById('records-footer-count');
  const footerSourceEl = document.getElementById('records-footer-source');

  function getBadgeHtml(nivelAlerta, textoEstado) {
    if (nivelAlerta === 'CRITICO_BAJO') {
      return (
        '<span class="health-badge badge-warning">' +
        '<i class="ph-fill ph-warning"></i><span>' +
        (textoEstado || 'Humedad baja') +
        '</span></span>'
      );
    }
    if (nivelAlerta === 'CRITICO_ALTO') {
      return (
        '<span class="health-badge badge-critical">' +
        '<i class="ph-fill ph-warning-octagon"></i><span>' +
        (textoEstado || 'Humedad alta') +
        '</span></span>'
      );
    }
    return (
      '<span class="health-badge badge-optimal">' +
      '<i class="ph-fill ph-check-circle"></i><span>' +
      (textoEstado || 'Dentro del rango') +
      '</span></span>'
    );
  }

  function renderKpis(resumen, total) {
    const totalEl = document.getElementById('kpi-total-records');
    const optEl = document.getElementById('kpi-optimal-records');
    const lowEl = document.getElementById('kpi-low-records');
    const highEl = document.getElementById('kpi-high-records');

    if (totalEl) totalEl.textContent = String(total ?? 0);
    if (optEl) optEl.textContent = String(resumen?.optimos ?? 0);
    if (lowEl) lowEl.textContent = String(resumen?.criticos_bajos ?? 0);
    if (highEl) highEl.textContent = String(resumen?.criticos_altos ?? 0);
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderTableRows(rows) {
    if (!tbodyEl) return;

    if (!Array.isArray(rows) || rows.length === 0) {
      tbodyEl.innerHTML =
        '<tr><td colspan="8" class="records-empty-state">' +
        'No se encontraron registros en la base de datos para los filtros seleccionados.' +
        '</td></tr>';
      return;
    }

    const html = rows
      .map(function (r) {
        const fechaFormateada = window.WatheoUtils.formatDateTime(r.fecha_hora);
        const adcTexto = r.valor_adc != null ? String(r.valor_adc) : '—';
        return (
          '<tr>' +
          '<td class="cell-mono">#' + escapeHtml(r.id_registro) + '</td>' +
          '<td>' + escapeHtml(fechaFormateada) + '</td>' +
          '<td class="cell-mono">' + escapeHtml(r.codigo_dispositivo) + '</td>' +
          '<td><strong>' + escapeHtml(r.planta) + '</strong><br><small>' + escapeHtml(r.region) + '</small></td>' +
          '<td class="cell-metric">' + escapeHtml(r.humedad_suelo) + '% <small>(ADC: ' + escapeHtml(adcTexto) + ')</small></td>' +
          '<td class="cell-metric">' + escapeHtml(r.temperatura_aire) + ' °C</td>' +
          '<td class="cell-metric">' + escapeHtml(r.humedad_aire) + '%</td>' +
          '<td>' + getBadgeHtml(r.nivel_alerta, r.estado_humedad) + '<div class="cell-notes">' + escapeHtml(r.observaciones) + '</div></td>' +
          '</tr>'
        );
      })
      .join('');

    tbodyEl.innerHTML = html;
  }

  async function cargarRegistros() {
    try {
      const filtros = {
        codigo_dispositivo: filterDeviceEl ? filterDeviceEl.value : '',
        nivel_alerta: filterAlertEl ? filterAlertEl.value : 'TODOS',
        limite: filterLimitEl ? filterLimitEl.value : '50'
      };

      const respuesta = await window.WatheoApi.fetchRegistros(filtros);
      registrosActuales = Array.isArray(respuesta.registros) ? respuesta.registros : [];

      renderKpis(respuesta.resumen, respuesta.total);
      renderTableRows(registrosActuales);

      if (footerCountEl) {
        footerCountEl.textContent = `Mostrando ${registrosActuales.length} registro(s)`;
      }
      if (footerSourceEl) {
        footerSourceEl.textContent = `Fuente SQL Server: ${respuesta.tabla_origen || 'dbo.registros'}`;
      }
    } catch (err) {
      if (tbodyEl) {
        tbodyEl.innerHTML =
          '<tr><td colspan="8" class="records-empty-state">' +
          'No se pudo conectar con /backend/api/registros.php (' +
          escapeHtml(err.message || 'Error de conexión') +
          ').' +
          '</td></tr>';
      }
    }
  }

  function actualizarMascotaFlotante() {
    const payload = window.WatheoApi.getSensorData();
    if (!payload) return;
    const mascotState = window.WatheoUtils.getMascotVisualState(payload.data);
    const fabImgEl = document.getElementById('fab-mascot-img');
    const fabStatusEl = document.getElementById('fab-mascot-status');
    if (fabImgEl) fabImgEl.src = mascotState.imagePath;
    if (fabStatusEl) fabStatusEl.textContent = mascotState.shortStatus;
  }

  function exportarCsv() {
    if (!registrosActuales.length) {
      alert('No hay registros cargados para exportar.');
      return;
    }

    const encabezados = [
      'ID Registro',
      'Fecha y Hora',
      'Dispositivo',
      'Cultivo',
      'Region',
      'Humedad Suelo (%)',
      'Temperatura Aire (C)',
      'Humedad Aire (%)',
      'Valor ADC',
      'Estado Humedad',
      'Nivel Alerta',
      'Observaciones'
    ];

    const escaparCsv = valor => {
      const texto = String(valor ?? '').replace(/"/g, '""');
      return `"${texto}"`;
    };

    const lineas = [encabezados.map(escaparCsv).join(',')];
    registrosActuales.forEach(r => {
      lineas.push(
        [
          r.id_registro,
          r.fecha_hora,
          r.codigo_dispositivo,
          r.planta,
          r.region,
          r.humedad_suelo,
          r.temperatura_aire,
          r.humedad_aire,
          r.valor_adc ?? '',
          r.estado_humedad,
          r.nivel_alerta,
          r.observaciones
        ]
          .map(escaparCsv)
          .join(',')
      );
    });

    const blob = new Blob(['\uFEFF' + lineas.join('\r\n')], {
      type: 'text/csv;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `watheo_registros_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(url);
  }

  window.addEventListener('watheo:updated', function () {
    actualizarMascotaFlotante();
    cargarRegistros();
  });

  document.addEventListener('DOMContentLoaded', function () {
    if (filterDeviceEl) filterDeviceEl.addEventListener('change', cargarRegistros);
    if (filterAlertEl) filterAlertEl.addEventListener('change', cargarRegistros);
    if (filterLimitEl) filterLimitEl.addEventListener('change', cargarRegistros);
    if (btnRefreshEl) btnRefreshEl.addEventListener('click', cargarRegistros);
    if (btnExportCsvEl) btnExportCsvEl.addEventListener('click', exportarCsv);

    actualizarMascotaFlotante();
    cargarRegistros();
  });
})();
