// EntornoSeguro · Frontend
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const state = { me: null, entidades: [] };

const ESTADOS = {
  cumple: ['✓', 'ok', 'Cumple'], parcial: ['⚠', 'warn', 'Parcial'], no_cumple: ['✗', 'bad', 'No cumple'],
  pendiente: ['·', 'muted', 'Pendiente'], no_aplica: ['—', 'muted', 'No aplica']
};
const COLECTIVOS = ['delegado', 'entrenador', 'monitor', 'directivo', 'arbitro', 'voluntario', 'personal_municipal'];

function toast(msg, bad) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : '');
  setTimeout(() => t.className = 'toast', 3500);
}
async function run(fn) {
  document.body.classList.add('busy');
  try { return await fn(); } catch (e) { toast(e.message, true); throw e; }
  finally { document.body.classList.remove('busy'); }
}
const can = p => state.me && state.me.permisos.includes(p);

// ---------- LOGIN ----------
window.addEventListener('load', () => {
  const saved = sessionStorageGet('es_token');
  google.accounts.id.initialize({ client_id: ES_CONFIG.GOOGLE_CLIENT_ID, callback: r => entrar(r.credential), auto_select: true });
  google.accounts.id.renderButton($('#gsi-btn'), { theme: 'outline', size: 'large', text: 'signin_with', locale: 'es' });
  if (saved) entrar(saved, true);
});
function sessionStorageGet(k) { try { return sessionStorage.getItem(k); } catch { return null; } }
function sessionStorageSet(k, v) { try { v ? sessionStorage.setItem(k, v) : sessionStorage.removeItem(k); } catch {} }

async function entrar(token, silencioso) {
  API.token = token;
  try {
    state.me = await API.call('me');
    sessionStorageSet('es_token', token);
    $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
    $('#user-name').textContent = state.me.nombre || state.me.email;
    $('#user-rol').textContent = state.me.rol;
    $('#org').textContent = state.me.config.organismo || '';
    $$('[data-perm]').forEach(el => { if (!can(el.dataset.perm)) el.remove(); });
    show('panel');
  } catch (e) {
    sessionStorageSet('es_token', null);
    if (!silencioso) $('#login-error').textContent = e.message;
  }
}
$('#logout').onclick = () => { sessionStorageSet('es_token', null); google.accounts.id.disableAutoSelect(); location.reload(); };

// ---------- NAVEGACIÓN ----------
$$('nav button').forEach(b => b.onclick = () => show(b.dataset.view));
function show(v) {
  $$('nav button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  $$('.view').forEach(s => s.classList.toggle('hidden', s.id !== 'view-' + v));
  ({ panel: loadPanel, entidades: loadEntidades, matriz: loadMatriz, formacion: loadFormacion, alertas: loadAlertas }[v] || (() => {}))();
}

// ---------- PANEL ----------
async function loadPanel() {
  const d = await run(() => API.call('dashboard'));
  const k = d.kpi;
  const tiles = [
    ['Entidades', k.entidades], ['Con menores', k.con_menores],
    ['Con Delegado/a', `${k.con_delegado}/${k.con_menores}`], ['Aceptan Protocolo', `${k.aceptan_protocolo}/${k.con_menores}`],
    ['Cumplimiento medio', k.cumplimiento_medio + '%'], ['Personas formadas', k.personas_formadas],
    ['Alertas abiertas', k.alertas_abiertas]
  ];
  $('#kpis').innerHTML = tiles.map(([l, v]) => `<div class="kpi"><span>${esc(l)}</span><strong>${esc(v)}</strong></div>`).join('');
  $('#badge-alertas').textContent = k.alertas_abiertas || '';
  $('#panel-entidades').innerHTML = d.entidades.length ? d.entidades.map(e => `
    <div class="bar-row" data-id="${esc(e.id)}"><span>${esc(e.nombre)}</span>
      <div class="bar"><i style="width:${e.pct}%" class="${e.pct < 40 ? 'bad' : e.pct < 80 ? 'warn' : 'ok'}"></i></div><b>${e.pct}%</b></div>`).join('')
    : '<p class="empty">Sin entidades con menores registradas.</p>';
  $$('#panel-entidades .bar-row').forEach(r => r.onclick = () => { show('matriz'); setTimeout(() => { $('#matriz-entidad').value = r.dataset.id; loadMatriz(); }, 50); });
  $('#panel-alertas').innerHTML = alertList(d.alertas);
}
function alertList(a) {
  return a.length ? '<ul class="alerts">' + a.map(x => `<li class="p-${esc(x.prioridad)}"><span>${esc(x.mensaje)}</span>${x.fecha_limite ? `<small>${esc(x.fecha_limite)}</small>` : ''}</li>`).join('') + '</ul>'
    : '<p class="empty">Sin alertas abiertas.</p>';
}

// ---------- ENTIDADES ----------
async function loadEntidades() {
  state.entidades = await run(() => API.call('listarEntidades'));
  $('#tabla-entidades').innerHTML = `<thead><tr><th>Entidad</th><th>Modalidad</th><th>Menores</th><th>Delegado/a</th><th>Protocolo Marco</th><th></th></tr></thead><tbody>` +
    state.entidades.map(e => `<tr><td><b>${esc(e.nombre)}</b><br><small>${esc(e.cif)}</small></td><td>${esc(e.modalidad)}</td>
      <td>${e.trabaja_menores === 'SI' ? esc(e.n_menores || 'Sí') : 'No'}</td><td>${esc(e.delegado_nombre) || '<span class="bad-t">Sin designar</span>'}</td>
      <td>${e.acepta_protocolo_marco === 'SI' ? '✓ ' + esc(e.fecha_aceptacion) : '<span class="bad-t">Pendiente</span>'}</td>
      <td>${can('escribir') ? `<button class="link" data-edit="${esc(e.id)}">Editar</button>` : ''}</td></tr>`).join('') + '</tbody>';
  $$('[data-edit]').forEach(b => b.onclick = () => formEntidad(state.entidades.find(e => e.id === b.dataset.edit)));
}
$('#nueva-entidad') && ($('#nueva-entidad').onclick = () => formEntidad({}));

function formEntidad(e) {
  modal('Entidad deportiva', [
    ['nombre', 'Nombre', 'text', true], ['cif', 'CIF'], ['tipo', 'Tipo', ['Club', 'Asociación', 'Escuela deportiva', 'Empresa de servicios', 'Otro']],
    ['modalidad', 'Modalidad deportiva'], ['trabaja_menores', '¿Trabaja con menores?', ['SI', 'NO']], ['n_menores', 'Nº aprox. de menores', 'number'],
    ['delegado_nombre', 'Delegado/a de Protección'], ['delegado_email', 'Email delegado/a', 'email'], ['delegado_telefono', 'Teléfono delegado/a'],
    ['fecha_designacion', 'Fecha designación', 'date'], ['acepta_protocolo_marco', 'Acepta Protocolo Marco', ['NO', 'SI']],
    ['fecha_aceptacion', 'Fecha aceptación', 'date'], ['observaciones', 'Observaciones', 'textarea'], ['activo', 'Activa', ['SI', 'NO']]
  ], e, async d => { d.id = e.id; await run(() => API.call('guardarEntidad', d)); toast('Entidad guardada'); loadEntidades(); });
}

// ---------- MATRIZ ----------
async function loadMatriz() {
  const sel = $('#matriz-entidad');
  if (!sel.options.length) {
    if (!state.entidades.length) state.entidades = await run(() => API.call('listarEntidades'));
    sel.innerHTML = state.entidades.filter(e => e.trabaja_menores === 'SI').map(e => `<option value="${esc(e.id)}">${esc(e.nombre)}</option>`).join('');
    sel.onchange = loadMatriz;
  }
  if (!sel.value) { $('#tabla-matriz').innerHTML = '<tr><td class="empty">Registra primero una entidad que trabaje con menores.</td></tr>'; return; }
  const rows = await run(() => API.call('matriz', { entidad_id: sel.value }));
  let bloque = '';
  $('#tabla-matriz').innerHTML = `<thead><tr><th>Requisito</th><th>Estado</th><th>Evidencia</th><th>Revisión</th><th>Próxima</th><th>Acción pendiente</th><th></th></tr></thead><tbody>` +
    rows.map(r => {
      const [ico, cls, txt] = ESTADOS[r.estado] || ESTADOS.pendiente;
      const head = r.bloque !== bloque ? `<tr class="group"><td colspan="7">${esc(bloque = r.bloque)}</td></tr>` : '';
      const venc = r.proxima_revision && new Date(r.proxima_revision) < new Date();
      return head + `<tr><td><b>${esc(r.codigo)}</b> ${esc(r.requisito)}<br><small>${esc(r.referencia)}</small></td>
        <td><span class="st ${cls}" title="${txt}">${ico} ${txt}</span></td>
        <td>${r.evidencias.map(v => v.url_drive ? `<a href="${esc(v.url_drive)}" target="_blank" rel="noopener">${esc(v.titulo)}</a>` : esc(v.titulo)).join('<br>') || '—'}</td>
        <td>${esc(r.fecha_revision) || '—'}</td><td class="${venc ? 'bad-t' : ''}">${esc(r.proxima_revision) || '—'}</td>
        <td>${esc(r.accion_pendiente) || '—'}</td>
        <td>${can('escribir') ? `<button class="link" data-req="${esc(r.codigo)}">Actualizar</button>` : ''}</td></tr>`;
    }).join('') + '</tbody>';
  $$('[data-req]').forEach(b => b.onclick = () => formCumplimiento(sel.value, rows.find(r => r.codigo === b.dataset.req)));
}
function formCumplimiento(entidad_id, r) {
  modal(`${r.codigo} · ${r.requisito}`, [
    ['estado', 'Estado', Object.entries(ESTADOS).map(([k, v]) => [k, v[2]])], ['fecha_revision', 'Fecha de revisión', 'date'],
    ['proxima_revision', 'Próxima revisión (vacío = automática)', 'date'], ['responsable', 'Responsable'],
    ['accion_pendiente', 'Acción pendiente', 'textarea'],
    ['ev_titulo', 'Nueva evidencia · título'], ['ev_url', 'Nueva evidencia · enlace Drive', 'url'], ['ev_caducidad', 'Caducidad evidencia', 'date']
  ], r, async d => {
    await run(() => API.call('guardarCumplimiento', { id: r.cumplimiento_id, entidad_id, requisito_codigo: r.codigo,
      estado: d.estado, fecha_revision: d.fecha_revision, proxima_revision: d.proxima_revision, responsable: d.responsable, accion_pendiente: d.accion_pendiente }));
    if (d.ev_titulo) await run(() => API.call('guardarEvidencia', { entidad_id, requisito_codigo: r.codigo, titulo: d.ev_titulo, url_drive: d.ev_url, fecha_caducidad: d.ev_caducidad, fecha_documento: d.fecha_revision }));
    toast('Cumplimiento actualizado'); loadMatriz();
  });
}

// ---------- FORMACIÓN ----------
async function loadFormacion() {
  const [rows, ents] = await run(() => Promise.all([API.call('listarFormacion'), state.entidades.length ? state.entidades : API.call('listarEntidades')]));
  state.entidades = ents;
  const nom = id => (ents.find(e => e.id === id) || {}).nombre || id;
  $('#tabla-formacion').innerHTML = `<thead><tr><th>Persona</th><th>Colectivo</th><th>Entidad</th><th>Curso</th><th>Horas</th><th>Fecha</th><th>Caduca</th></tr></thead><tbody>` +
    (rows.map(f => `<tr><td>${esc(f.persona_nombre)}</td><td>${esc(f.colectivo)}</td><td>${esc(nom(f.entidad_id))}</td><td>${f.certificado_url ? `<a href="${esc(f.certificado_url)}" target="_blank" rel="noopener">${esc(f.curso)}</a>` : esc(f.curso)}</td>
      <td>${esc(f.horas)}</td><td>${esc(f.fecha)}</td><td class="${f.fecha_caducidad && new Date(f.fecha_caducidad) < new Date() ? 'bad-t' : ''}">${esc(f.fecha_caducidad) || '—'}</td></tr>`).join('')
      || '<tr><td colspan="7" class="empty">Sin formación registrada.</td></tr>') + '</tbody>';
}
$('#nueva-formacion') && ($('#nueva-formacion').onclick = async () => {
  if (!state.entidades.length) state.entidades = await run(() => API.call('listarEntidades'));
  modal('Registrar formación', [
    ['entidad_id', 'Entidad', state.entidades.map(e => [e.id, e.nombre])], ['persona_nombre', 'Persona (agente deportivo adulto)', 'text', true],
    ['colectivo', 'Colectivo', COLECTIVOS], ['curso', 'Curso', 'text', true], ['entidad_formadora', 'Entidad formadora'],
    ['horas', 'Horas', 'number'], ['fecha', 'Fecha', 'date', true], ['fecha_caducidad', 'Caducidad / reciclaje', 'date'], ['certificado_url', 'Enlace certificado', 'url']
  ], {}, async d => { await run(() => API.call('guardarFormacion', d)); toast('Formación registrada'); loadFormacion(); });
});

// ---------- ALERTAS ----------
async function loadAlertas() {
  const a = await run(() => API.call('listarAlertas'));
  $('#badge-alertas').textContent = a.length || '';
  const orden = { alta: 0, media: 1, baja: 2 };
  a.sort((x, y) => orden[x.prioridad] - orden[y.prioridad]);
  $('#tabla-alertas').innerHTML = `<thead><tr><th>Prioridad</th><th>Tipo</th><th>Alerta</th><th>Fecha límite</th><th></th></tr></thead><tbody>` +
    (a.map(x => `<tr><td><span class="st ${x.prioridad === 'alta' ? 'bad' : x.prioridad === 'media' ? 'warn' : 'muted'}">${esc(x.prioridad)}</span></td>
      <td>${esc(x.tipo)}</td><td>${esc(x.mensaje)}</td><td>${esc(x.fecha_limite) || '—'}</td>
      <td>${can('escribir') ? `<button class="link" data-close="${esc(x.id)}">Cerrar</button>` : ''}</td></tr>`).join('')
      || '<tr><td colspan="5" class="empty">Sin alertas abiertas.</td></tr>') + '</tbody>';
  $$('[data-close]').forEach(b => b.onclick = async () => { await run(() => API.call('cerrarAlerta', { id: b.dataset.close })); loadAlertas(); });
}
$('#regenerar') && ($('#regenerar').onclick = async () => { const r = await run(() => API.call('regenerarAlertas')); toast(r.abiertas + ' alertas abiertas'); loadAlertas(); });

// ---------- IA ----------
$('#form-contenido').onsubmit = async ev => {
  ev.preventDefault();
  $('#out-contenido').textContent = 'Generando…';
  const r = await run(() => API.call('generarContenido', Object.fromEntries(new FormData(ev.target))));
  $('#out-contenido').textContent = r.texto;
};
$('#copiar').onclick = () => navigator.clipboard.writeText($('#out-contenido').textContent).then(() => toast('Copiado'));
$('#form-asistente').onsubmit = async ev => {
  ev.preventDefault();
  $('#out-asistente').textContent = 'Consultando…';
  const r = await run(() => API.call('asistente', Object.fromEntries(new FormData(ev.target))));
  $('#out-asistente').textContent = r.texto;
};

// ---------- MODAL GENÉRICO ----------
function modal(titulo, campos, datos, onSave) {
  const f = $('#modal-form');
  f.innerHTML = `<h3>${esc(titulo)}</h3><div class="fields">` + campos.map(([n, l, t = 'text', req]) => {
    const v = esc(datos[n] ?? '');
    const r = req ? 'required' : '';
    if (Array.isArray(t)) return `<label>${esc(l)}<select name="${n}">${t.map(o => { const [val, txt] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(val)}" ${String(datos[n]) === String(val) ? 'selected' : ''}>${esc(txt)}</option>`; }).join('')}</select></label>`;
    if (t === 'textarea') return `<label class="full">${esc(l)}<textarea name="${n}" rows="3">${v}</textarea></label>`;
    return `<label>${esc(l)}<input type="${t}" name="${n}" value="${v}" ${r}></label>`;
  }).join('') + `</div><div class="actions"><button value="cancel" class="btn ghost" formnovalidate>Cancelar</button><button value="ok" class="btn">Guardar</button></div>`;
  const dlg = $('#modal');
  dlg.onclose = async () => { if (dlg.returnValue === 'ok') await onSave(Object.fromEntries(new FormData(f))); };
  dlg.showModal();
}
