/**
 * Code.gs — API JSON del sistema EntornoSeguro.
 * Publicar como Web App: Ejecutar como "Yo" · Acceso "Cualquier usuario".
 * El frontend envía POST text/plain {action, token, data} para evitar preflight CORS.
 */

function doGet() {
  return json_({ ok: true, servicio: 'EntornoSeguro API', version: '0.1.0' });
}

function doPost(e) {
  let req = {};
  try {
    req = JSON.parse(e.postData.contents || '{}');
    const user = autenticar_(req.token);
    const handler = ACCIONES[req.action];
    if (!handler) throw new Error('Acción desconocida: ' + req.action);
    const data = handler(user, req.data || {});
    return json_({ ok: true, data: data });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

const ACCIONES = {

  me: function (user) {
    return { email: user.email, nombre: user.nombre, rol: user.rol, permisos: user.permisos, config: config_() };
  },

  dashboard: function (user) {
    exigir_(user, user.rol === 'entidad' ? 'leer_propia' : 'leer');
    const ent = filtrarPorRol_(user, readAll_('Entidades')).filter(function (e) { return e.activo !== 'NO'; });
    const cum = filtrarPorRol_(user, readAll_('Cumplimiento'));
    const req = readAll_('Requisitos_Protocolo');
    const form = filtrarPorRol_(user, readAll_('Formacion'));
    const alertas = filtrarPorRol_(user, readAll_('Alertas')).filter(function (a) { return a.estado === 'abierta'; });

    const conMenores = ent.filter(function (e) { return e.trabaja_menores === 'SI'; });
    const porEntidad = conMenores.map(function (e) {
      const filas = cum.filter(function (c) { return c.entidad_id === e.id; });
      const cumple = filas.filter(function (c) { return c.estado === 'cumple' || c.estado === 'no_aplica'; }).length;
      return { id: e.id, nombre: e.nombre, pct: req.length ? Math.round(cumple * 100 / req.length) : 0,
               delegado: !!e.delegado_nombre, protocolo: e.acepta_protocolo_marco === 'SI' };
    });

    return {
      kpi: {
        entidades: ent.length,
        con_menores: conMenores.length,
        con_delegado: conMenores.filter(function (e) { return e.delegado_nombre; }).length,
        aceptan_protocolo: conMenores.filter(function (e) { return e.acepta_protocolo_marco === 'SI'; }).length,
        personas_formadas: form.length,
        alertas_abiertas: alertas.length,
        cumplimiento_medio: porEntidad.length
          ? Math.round(porEntidad.reduce(function (s, x) { return s + x.pct; }, 0) / porEntidad.length) : 0
      },
      entidades: porEntidad.sort(function (a, b) { return a.pct - b.pct; }),
      alertas: alertas.sort(function (a, b) { return String(a.fecha_limite).localeCompare(String(b.fecha_limite)); }).slice(0, 10)
    };
  },

  listarEntidades: function (user) {
    exigir_(user, user.rol === 'entidad' ? 'leer_propia' : 'leer');
    return filtrarPorRol_(user, readAll_('Entidades'));
  },

  guardarEntidad: function (user, d) {
    if (user.rol === 'entidad') { exigir_(user, 'escribir_propia'); d.id = user.entidad_id; }
    else exigir_(user, 'escribir');
    if (!d.nombre) throw new Error('Nombre obligatorio');
    const r = upsert_('Entidades', d);
    log_(user.email, d.id ? 'ACTUALIZAR' : 'CREAR', 'Entidades', { id: r.id, nombre: r.nombre });
    return r;
  },

  requisitos: function (user) {
    return readAll_('Requisitos_Protocolo');
  },

  matriz: function (user, d) {
    if (user.rol === 'entidad') d.entidad_id = user.entidad_id; else exigir_(user, 'leer');
    const req = readAll_('Requisitos_Protocolo');
    const cum = readAll_('Cumplimiento').filter(function (c) { return c.entidad_id === d.entidad_id; });
    const ev = readAll_('Evidencias').filter(function (x) { return x.entidad_id === d.entidad_id; });
    return req.map(function (r) {
      const c = cum.find(function (x) { return x.requisito_codigo === r.codigo; }) || {};
      return {
        codigo: r.codigo, bloque: r.bloque, requisito: r.requisito, referencia: r.referencia,
        periodicidad_meses: r.periodicidad_meses,
        cumplimiento_id: c.id || '', estado: c.estado || 'pendiente',
        fecha_revision: c.fecha_revision || '', proxima_revision: c.proxima_revision || '',
        accion_pendiente: c.accion_pendiente || '', responsable: c.responsable || '',
        evidencias: ev.filter(function (x) { return x.requisito_codigo === r.codigo; })
      };
    });
  },

  guardarCumplimiento: function (user, d) {
    if (user.rol === 'entidad') { exigir_(user, 'escribir_propia'); d.entidad_id = user.entidad_id; }
    else exigir_(user, 'escribir');
    if (!d.entidad_id || !d.requisito_codigo) throw new Error('Faltan entidad o requisito');
    if (d.fecha_revision && !d.proxima_revision) {
      const r = readAll_('Requisitos_Protocolo').find(function (x) { return x.codigo === d.requisito_codigo; });
      const meses = Number(r && r.periodicidad_meses) || 0;
      if (meses) {
        const f = new Date(d.fecha_revision); f.setMonth(f.getMonth() + meses);
        d.proxima_revision = Utilities.formatDate(f, 'Europe/Madrid', 'yyyy-MM-dd');
      }
    }
    d.actualizado_por = user.email;
    const r = upsert_('Cumplimiento', d);
    log_(user.email, 'CUMPLIMIENTO', d.entidad_id + '/' + d.requisito_codigo, { estado: d.estado });
    return r;
  },

  guardarEvidencia: function (user, d) {
    if (user.rol === 'entidad') d.entidad_id = user.entidad_id; else exigir_(user, 'escribir');
    d.subido_por = user.email;
    const r = upsert_('Evidencias', d);
    log_(user.email, 'EVIDENCIA', d.entidad_id + '/' + d.requisito_codigo, { titulo: d.titulo });
    return r;
  },

  listarFormacion: function (user) {
    exigir_(user, user.rol === 'entidad' ? 'leer_propia' : 'leer');
    return filtrarPorRol_(user, readAll_('Formacion'));
  },

  guardarFormacion: function (user, d) {
    if (user.rol === 'entidad') d.entidad_id = user.entidad_id; else exigir_(user, 'escribir');
    const r = upsert_('Formacion', d);
    log_(user.email, 'FORMACION', d.entidad_id, { curso: d.curso });
    return r;
  },

  listarAlertas: function (user) {
    return filtrarPorRol_(user, readAll_('Alertas')).filter(function (a) { return a.estado === 'abierta'; });
  },

  cerrarAlerta: function (user, d) {
    exigir_(user, 'escribir');
    upsert_('Alertas', { id: d.id, estado: 'cerrada' });
    log_(user.email, 'CERRAR_ALERTA', d.id, null);
    return true;
  },

  regenerarAlertas: function (user) {
    exigir_(user, 'escribir');
    return generarAlertas();
  },

  generarContenido: function (user, d) {
    exigir_(user, 'ia');
    log_(user.email, 'IA_CONTENIDO', d.formato, { tema: d.tema });
    return generarContenidoIA_(d);
  },

  asistente: function (user, d) {
    exigir_(user, 'ia');
    log_(user.email, 'IA_ASISTENTE', 'consulta', null);
    return asistenteIA_(d.pregunta);
  }
};
