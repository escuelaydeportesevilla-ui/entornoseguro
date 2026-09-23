/**
 * Setup.gs — Crea la hoja de cálculo base del sistema.
 * Ejecutar UNA VEZ desde el editor de Apps Script: setupSistema()
 */

const ESQUEMA = {
  Config_Municipio: ['clave', 'valor', 'descripcion'],
  Usuarios_Roles: ['email', 'nombre', 'rol', 'entidad_id', 'activo', 'creado'],
  Entidades: ['id', 'nombre', 'cif', 'tipo', 'modalidad', 'trabaja_menores', 'n_menores',
    'delegado_nombre', 'delegado_email', 'delegado_telefono', 'fecha_designacion',
    'acepta_protocolo_marco', 'fecha_aceptacion', 'observaciones', 'activo', 'creado', 'actualizado'],
  Requisitos_Protocolo: ['codigo', 'bloque', 'requisito', 'descripcion', 'periodicidad_meses',
    'evidencia_tipo', 'obligatorio', 'referencia'],
  Cumplimiento: ['id', 'entidad_id', 'requisito_codigo', 'estado', 'evidencia_id', 'fecha_revision',
    'proxima_revision', 'accion_pendiente', 'responsable', 'actualizado_por', 'actualizado'],
  Evidencias: ['id', 'entidad_id', 'requisito_codigo', 'titulo', 'tipo', 'url_drive',
    'fecha_documento', 'fecha_caducidad', 'subido_por', 'creado'],
  Formacion: ['id', 'entidad_id', 'persona_nombre', 'colectivo', 'curso', 'entidad_formadora',
    'horas', 'fecha', 'fecha_caducidad', 'certificado_url', 'creado'],
  Alertas: ['id', 'tipo', 'prioridad', 'entidad_id', 'referencia', 'mensaje', 'fecha_limite', 'estado', 'creado'],
  Log_Auditoria: ['timestamp', 'email', 'accion', 'recurso', 'detalle']
};

// Bloques A–K del Protocolo Marco (Orden 18/11/2024). Periodicidades orientativas: validar.
const REQUISITOS_BASE = [
  ['A1', 'A. Compromiso institucional', 'Declaración institucional', 'Declaración aprobada por el órgano de gobierno', 0, 'Documento', 'SI', 'Protocolo Marco'],
  ['A2', 'A. Compromiso institucional', 'Aceptación del Protocolo Marco', 'Adhesión formal de la entidad', 0, 'Documento', 'SI', 'Orden 18/11/2024'],
  ['B1', 'B. Responsable de protección', 'Designación Delegado/a de Protección', 'Designación vigente con datos de contacto', 24, 'Designación', 'SI', 'LOPIVI art. 48 / Protocolo Marco'],
  ['B2', 'B. Responsable de protección', 'Formación del Delegado/a', 'Formación específica acreditada', 24, 'Certificado', 'SI', 'Protocolo Marco'],
  ['C1', 'C. Análisis de riesgos', 'Análisis de riesgos', 'Identificación y valoración de riesgos por actividad', 12, 'Documento', 'SI', 'Protocolo Marco'],
  ['C2', 'C. Análisis de riesgos', 'Medidas preventivas', 'Medidas, responsable y fecha de implantación', 12, 'Documento', 'SI', 'Protocolo Marco'],
  ['D1', 'D. Código de conducta', 'Código de conducta aprobado', 'Código aprobado por la entidad', 24, 'Documento', 'SI', 'Protocolo Marco'],
  ['D2', 'D. Código de conducta', 'Difusión y aceptación', 'Aceptación firmada por agentes deportivos', 12, 'Registro', 'SI', 'Protocolo Marco'],
  ['E1', 'E. Datos e imágenes', 'Autorizaciones de imagen', 'Autorizaciones familiares vigentes', 12, 'Registro', 'SI', 'RGPD / LO 1/1982'],
  ['E2', 'E. Datos e imágenes', 'Procedimiento redes sociales', 'Criterios de publicación y uso de imágenes', 24, 'Procedimiento', 'SI', 'Protocolo Marco'],
  ['F1', 'F. Desplazamientos', 'Autorizaciones de desplazamiento', 'Autorizaciones familiares por viaje', 12, 'Registro', 'SI', 'Protocolo Marco'],
  ['F2', 'F. Desplazamientos', 'Medidas en viajes y pernoctas', 'Responsables, ratios y alojamiento', 24, 'Procedimiento', 'SI', 'Protocolo Marco'],
  ['G1', 'G. Protocolo propio', 'Protocolo de protección de la entidad', 'Protocolo propio aprobado', 24, 'Documento', 'SI', 'LOPIVI art. 48'],
  ['G2', 'G. Protocolo propio', 'Difusión del protocolo', 'Accesible para agentes, familias y menores', 12, 'Evidencia', 'SI', 'Protocolo Marco'],
  ['H1', 'H. Comunicación de incidentes', 'Procedimiento de comunicación', 'Personas responsables y pasos', 24, 'Procedimiento', 'SI', 'LOPIVI arts. 15-16'],
  ['H2', 'H. Comunicación de incidentes', 'Flujograma de actuación', 'Flujograma difundido', 24, 'Documento', 'SI', 'Protocolo Marco'],
  ['I1', 'I. Canal de comunicación', 'Canal de comunicación operativo', 'Canal seguro y confidencial', 12, 'Procedimiento', 'SI', 'LOPIVI art. 49'],
  ['I2', 'I. Canal de comunicación', 'Información a menores y familias', 'Información adaptada a la edad', 12, 'Evidencia', 'SI', 'LOPIVI art. 49'],
  ['J1', 'J. Formación', 'Plan de formación de agentes', 'Formación de entrenadores, monitores y voluntariado', 12, 'Registro', 'SI', 'LOPIVI art. 5'],
  ['K1', 'K. Agentes deportivos', 'Registro de agentes deportivos', 'Listado de personas en contacto habitual con menores', 12, 'Registro', 'SI', 'Protocolo Marco'],
  ['K2', 'K. Agentes deportivos', 'Certificados negativos de delitos sexuales', 'Certificado del Registro Central de Delincuentes Sexuales de todo el personal', 12, 'Registro', 'SI', 'LOPIVI art. 57 / LO 1/1996 art. 13.5']
];

const CONFIG_BASE = [
  ['municipio', 'Camas', 'Nombre del municipio'],
  ['organismo', 'Ayuntamiento de Camas · Área de Deportes', 'Organismo titular'],
  ['delegado_municipal', '', 'Nombre del Delegado de Protección municipal'],
  ['email_alertas', '', 'Correo para el resumen diario de alertas'],
  ['dias_aviso', '30', 'Días de antelación para avisar de vencimientos'],
  ['dominio_permitido', '', 'Opcional: restringe acceso a un dominio (ej. escuelaydeporte.com)']
];

function setupSistema() {
  const props = PropertiesService.getScriptProperties();
  let ss;
  const existingId = props.getProperty('SPREADSHEET_ID');
  if (existingId) {
    ss = SpreadsheetApp.openById(existingId);
  } else {
    ss = SpreadsheetApp.create('EntornoSeguro · Base de datos');
    props.setProperty('SPREADSHEET_ID', ss.getId());
  }

  Object.keys(ESQUEMA).forEach(function (nombre) {
    let sh = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
    const cab = ESQUEMA[nombre];
    sh.getRange(1, 1, 1, cab.length).setValues([cab])
      .setFontWeight('bold').setBackground('#1f4e5f').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  });

  const def = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);

  seed_(ss.getSheetByName('Requisitos_Protocolo'), REQUISITOS_BASE);
  seed_(ss.getSheetByName('Config_Municipio'), CONFIG_BASE);

  const users = ss.getSheetByName('Usuarios_Roles');
  if (users.getLastRow() < 2) {
    users.appendRow([Session.getActiveUser().getEmail(), 'Administrador', 'admin', '', 'SI', new Date()]);
  }

  instalarTriggers_();
  Logger.log('Hoja creada: ' + ss.getUrl());
  return ss.getUrl();
}

function seed_(sh, rows) {
  if (sh.getLastRow() > 1) return;
  sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

function instalarTriggers_() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'generarAlertas'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('generarAlertas').timeBased().everyDays(1).atHour(7).create();
}
