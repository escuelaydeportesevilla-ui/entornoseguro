/**
 * Db.gs — Acceso genérico a hojas como tablas (fila 1 = cabeceras).
 */

function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Sistema no inicializado: ejecuta setupSistema()');
  return SpreadsheetApp.openById(id);
}

function sheet_(nombre) {
  const sh = ss_().getSheetByName(nombre);
  if (!sh) throw new Error('Hoja no encontrada: ' + nombre);
  return sh;
}

function readAll_(nombre) {
  const values = sheet_(nombre).getDataRange().getValues();
  const cab = values.shift();
  return values
    .filter(function (r) { return r.join('') !== ''; })
    .map(function (r) {
      const o = {};
      cab.forEach(function (c, i) {
        o[c] = r[i] instanceof Date ? Utilities.formatDate(r[i], 'Europe/Madrid', 'yyyy-MM-dd') : r[i];
      });
      return o;
    });
}

function uid_(prefijo) {
  return prefijo + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();
}

/** Inserta o actualiza por la columna clave. Devuelve el registro guardado. */
function upsert_(nombre, obj, clave) {
  clave = clave || 'id';
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_(nombre);
    const values = sh.getDataRange().getValues();
    const cab = values[0];
    const idx = cab.indexOf(clave);
    const ahora = new Date();
    if (cab.indexOf('actualizado') >= 0) obj.actualizado = ahora;

    let fila = -1;
    if (obj[clave]) {
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][idx]) === String(obj[clave])) { fila = i + 1; break; }
      }
    }
    if (fila === -1) {
      if (!obj[clave] && clave === 'id') obj.id = uid_(nombre.slice(0, 3).toUpperCase());
      if (cab.indexOf('creado') >= 0) obj.creado = ahora;
      sh.appendRow(cab.map(function (c) { return obj[c] !== undefined ? obj[c] : ''; }));
    } else {
      const actual = values[fila - 1];
      const nueva = cab.map(function (c, i) { return obj[c] !== undefined ? obj[c] : actual[i]; });
      sh.getRange(fila, 1, 1, cab.length).setValues([nueva]);
    }
    return obj;
  } finally {
    lock.releaseLock();
  }
}

function config_() {
  const o = {};
  readAll_('Config_Municipio').forEach(function (r) { o[r.clave] = r.valor; });
  return o;
}

function log_(email, accion, recurso, detalle) {
  sheet_('Log_Auditoria').appendRow([new Date(), email, accion, recurso, detalle ? JSON.stringify(detalle).slice(0, 500) : '']);
}
