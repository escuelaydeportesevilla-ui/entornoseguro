/**
 * IA.gs — Integración con la API de Claude.
 * Script Properties: CLAUDE_API_KEY (obligatoria), CLAUDE_MODEL (opcional).
 * Regla: nunca se envían datos identificativos de menores ni de casos.
 */

const SISTEMA_IA = [
  'Eres el asistente técnico del Delegado de Protección de Menores en el Deporte de un ayuntamiento andaluz.',
  'Marco de referencia: LO 8/2021 (LOPIVI, especialmente Capítulo IX deporte y ocio), Ley 4/2021 de Infancia',
  'y Adolescencia de Andalucía, Ley 5/2016 del Deporte de Andalucía, Decreto 41/2022 y el Protocolo Marco',
  'aprobado por Orden de 18 de noviembre de 2024.',
  'Normas: no emites conclusiones jurídicas categóricas; no atribuyes responsabilidad ni calificas hechos como violencia;',
  'indicas la norma o apartado que fundamenta cada afirmación cuando sea posible y señalas cuándo debe validarlo una persona responsable.',
  'Si recibes datos que identifiquen a un menor, no los repitas y recuerda que no deben introducirse.',
  'Estilo: español de España, técnico, conciso, sin relleno.'
].join(' ');

function llamarClaude_(system, prompt, maxTokens) {
  const props = PropertiesService.getScriptProperties();
  const key = props.getProperty('CLAUDE_API_KEY');
  if (!key) throw new Error('Falta CLAUDE_API_KEY en Propiedades del script');
  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      model: props.getProperty('CLAUDE_MODEL') || 'claude-sonnet-5',
      max_tokens: maxTokens || 1500,
      system: system,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const body = JSON.parse(res.getContentText());
  if (res.getResponseCode() !== 200) throw new Error('IA: ' + (body.error && body.error.message || res.getResponseCode()));
  return body.content.map(function (b) { return b.text || ''; }).join('');
}

/** Filtro básico: bloquea DNI/NIE, teléfonos y emails en el texto enviado. */
function sanear_(txt) {
  return String(txt || '')
    .replace(/\b\d{8}[A-Za-z]\b/g, '[DNI]')
    .replace(/\b[XYZxyz]\d{7}[A-Za-z]\b/g, '[NIE]')
    .replace(/\b[6789]\d{8}\b/g, '[TEL]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[EMAIL]')
    .slice(0, 4000);
}

const FORMATOS = {
  carrusel: 'Carrusel de Instagram de 6-8 diapositivas. Para cada una: título (máx. 8 palabras) y texto (máx. 25 palabras). Después, pie de publicación y 8 hashtags.',
  story: 'Secuencia de 3-4 stories. Texto breve por pantalla y una llamada a la acción (encuesta, pregunta o enlace).',
  reel: 'Guion de reel de 30-45 s: gancho inicial (3 s), escenas con texto en pantalla y locución, cierre y pie de publicación.',
  infografia: 'Contenido para infografía: título, 5-7 bloques con icono sugerido y frase, y fuente normativa.',
  familias: 'Mensaje para familias (WhatsApp/email), tono cercano, máx. 150 palabras.',
  entrenadores: 'Mensaje para entrenadores y monitores, operativo, con 3-5 pautas concretas.'
};

function generarContenidoIA_(d) {
  const formato = FORMATOS[d.formato] || FORMATOS.carrusel;
  const cfg = config_();
  const prompt = [
    'Organismo: ' + (cfg.organismo || 'Ayuntamiento'),
    'Tema: ' + sanear_(d.tema),
    'Público: ' + sanear_(d.publico || 'familias y deportistas'),
    'Tono: positivo y preventivo; sin imágenes ni lenguaje alarmista; lenguaje inclusivo.',
    'Formato solicitado: ' + formato
  ].join('\n');
  return { texto: llamarClaude_(SISTEMA_IA, prompt, 1800) };
}

function asistenteIA_(pregunta) {
  return { texto: llamarClaude_(SISTEMA_IA, sanear_(pregunta), 1500) };
}
