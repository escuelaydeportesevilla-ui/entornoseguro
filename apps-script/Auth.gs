/**
 * Auth.gs — Verifica el ID token de Google Identity Services y resuelve el rol.
 * Script Properties requeridas: GOOGLE_CLIENT_ID
 */

const ROLES = {
  admin:    ['leer', 'escribir', 'admin', 'ia'],
  delegado: ['leer', 'escribir', 'ia'],
  tecnico:  ['leer', 'escribir'],
  entidad:  ['leer_propia', 'escribir_propia'],
  lectura:  ['leer']
};

function autenticar_(idToken) {
  if (!idToken) throw new Error('No autenticado');

  const cache = CacheService.getScriptCache();
  const key = 'tok_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken)).slice(0, 40);
  const cached = cache.get(key);
  let email;

  if (cached) {
    email = cached;
  } else {
    const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
      { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error('Token no válido');
    const info = JSON.parse(res.getContentText());
    const clientId = PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID');
    if (info.aud !== clientId) throw new Error('Token emitido para otra aplicación');
    if (info.email_verified !== 'true' && info.email_verified !== true) throw new Error('Email no verificado');
    email = String(info.email).toLowerCase();
    cache.put(key, email, 600);
  }

  const dominio = (config_().dominio_permitido || '').trim();
  if (dominio && !email.endsWith('@' + dominio)) {
    const u0 = buscarUsuario_(email);
    if (!u0) throw new Error('Acceso restringido');
  }

  const u = buscarUsuario_(email);
  if (!u) {
    log_(email, 'ACCESO_DENEGADO', 'auth', null);
    throw new Error('Usuario no autorizado. Solicita alta al administrador.');
  }
  return { email: email, nombre: u.nombre, rol: u.rol, entidad_id: u.entidad_id, permisos: ROLES[u.rol] || [] };
}

function buscarUsuario_(email) {
  return readAll_('Usuarios_Roles').find(function (u) {
    return String(u.email).toLowerCase() === email && String(u.activo).toUpperCase() === 'SI';
  });
}

function exigir_(user, permiso) {
  if (user.permisos.indexOf(permiso) === -1) throw new Error('Permiso insuficiente: ' + permiso);
}

/** Filtra registros por entidad si el rol es 'entidad'. */
function filtrarPorRol_(user, rows) {
  if (user.rol !== 'entidad') return rows;
  return rows.filter(function (r) { return String(r.entidad_id || r.id) === String(user.entidad_id); });
}
