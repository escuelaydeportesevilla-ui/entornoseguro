/**
 * Alertas.gs — Regenera alertas preventivas. Trigger diario 07:00 (instalado por setupSistema).
 */

function generarAlertas() {
  const cfg = config_();
  const dias = Number(cfg.dias_aviso) || 30;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const limite = new Date(hoy.getTime() + dias * 86400000);

  const ent = readAll_('Entidades').filter(function (e) { return e.activo !== 'NO' && e.trabaja_menores === 'SI'; });
  const req = readAll_('Requisitos_Protocolo').filter(function (r) { return r.obligatorio === 'SI'; });
  const cum = readAll_('Cumplimiento');
  const form = readAll_('Formacion');
  const ev = readAll_('Evidencias');
  const nuevas = [];

  function add(tipo, prioridad, entidad, ref, msg, fecha) {
    nuevas.push({ tipo: tipo, prioridad: prioridad, entidad_id: entidad.id, referencia: ref,
                  mensaje: entidad.nombre + ': ' + msg, fecha_limite: fecha || '' });
  }

  ent.forEach(function (e) {
    if (!e.delegado_nombre) add('delegado', 'alta', e, 'B1', 'sin Delegado/a de Protección designado');
    if (e.acepta_protocolo_marco !== 'SI') add('protocolo', 'alta', e, 'A2', 'sin aceptación del Protocolo Marco');

    const formDelegado = form.some(function (f) { return f.entidad_id === e.id && f.colectivo === 'delegado'; });
    if (e.delegado_nombre && !formDelegado) add('formacion', 'media', e, 'B2', 'Delegado/a sin formación registrada');

    req.forEach(function (r) {
      const c = cum.find(function (x) { return x.entidad_id === e.id && x.requisito_codigo === r.codigo; });
      if (!c || c.estado === 'pendiente' || c.estado === 'no_cumple') {
        add('requisito', r.codigo === 'K2' ? 'alta' : 'baja', e, r.codigo, 'pendiente · ' + r.requisito);
      } else if (c.proxima_revision) {
        const f = new Date(c.proxima_revision);
        if (f < hoy) add('revision', 'alta', e, r.codigo, 'revisión vencida · ' + r.requisito, c.proxima_revision);
        else if (f <= limite) add('revision', 'media', e, r.codigo, 'revisión próxima · ' + r.requisito, c.proxima_revision);
      }
    });
  });

  ev.concat(form).forEach(function (x) {
    if (!x.fecha_caducidad) return;
    const e = ent.find(function (y) { return y.id === x.entidad_id; });
    if (!e) return;
    const f = new Date(x.fecha_caducidad);
    const txt = x.titulo || (x.curso + ' · ' + x.persona_nombre);
    if (f < hoy) add('caducidad', 'alta', e, x.id, 'caducado · ' + txt, x.fecha_caducidad);
    else if (f <= limite) add('caducidad', 'media', e, x.id, 'caduca pronto · ' + txt, x.fecha_caducidad);
  });

  // Reescribe la hoja conservando alertas cerradas manualmente (no se reabren el mismo día).
  const sh = sheet_('Alertas');
  const cerradas = readAll_('Alertas').filter(function (a) { return a.estado === 'cerrada'; });
  const claveCerrada = {};
  cerradas.forEach(function (a) { claveCerrada[a.entidad_id + '|' + a.referencia + '|' + a.tipo] = true; });

  const cab = ESQUEMA.Alertas;
  const ahora = new Date();
  const filas = nuevas
    .filter(function (a) { return !claveCerrada[a.entidad_id + '|' + a.referencia + '|' + a.tipo]; })
    .map(function (a) {
      a.id = uid_('ALR'); a.estado = 'abierta'; a.creado = ahora;
      return cab.map(function (c) { return a[c] !== undefined ? a[c] : ''; });
    })
    .concat(cerradas.map(function (a) { return cab.map(function (c) { return a[c]; }); }));

  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, cab.length).clearContent();
    if (filas.length) sh.getRange(2, 1, filas.length, cab.length).setValues(filas);
  } finally { lock.releaseLock(); }

  const abiertas = filas.length - cerradas.length;
  if (cfg.email_alertas && abiertas) {
    const altas = nuevas.filter(function (a) { return a.prioridad === 'alta'; });
    MailApp.sendEmail(cfg.email_alertas, 'EntornoSeguro · ' + abiertas + ' alertas abiertas (' + altas.length + ' altas)',
      altas.slice(0, 30).map(function (a) { return '• ' + a.mensaje; }).join('\n') +
      '\n\nDetalle: https://entornoseguro.escuelaydeporte.com');
  }
  return { abiertas: abiertas };
}
