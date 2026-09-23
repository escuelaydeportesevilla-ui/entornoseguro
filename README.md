# EntornoSeguro

Sistema municipal de protección de menores en el deporte. Apoyo al Delegado/a de Protección para la implantación y seguimiento de la LOPIVI y del Protocolo Marco andaluz (Orden 18/11/2024).

- **Web:** https://entornoseguro.escuelaydeporte.com
- **Frontend:** GitHub Pages (`/docs`)
- **Backend:** Google Apps Script Web App (`/apps-script`)
- **Datos:** Google Sheets (Workspace escuelaydeporte.com)

> Repositorio público. Nunca subir datos personales, claves API ni `.clasprc.json`.

## Fase 1 (MVP) — incluido

| Módulo | Función |
|---|---|
| Panel | KPIs, % de implantación por entidad, alertas prioritarias |
| Entidades | Alta, delegado/a, aceptación Protocolo Marco |
| Matriz | 21 requisitos A–K, estado, evidencias (enlace Drive), revisiones |
| Formación | Registro por persona y colectivo, caducidades |
| Alertas | Cálculo diario 07:00 + email resumen |
| Contenidos RRSS | Carruseles, stories, reels, mensajes (Claude API) |
| Asistente IA | Consultas normativas, sin datos identificativos |

**Fuera de fase 1:** registro de incidencias con datos de menores (requiere EIPD, encargo de tratamiento y visto bueno del DPD).

## Roles (`Usuarios_Roles`)

| Rol | Permisos |
|---|---|
| `admin` | Todo |
| `delegado` | Lectura, escritura, IA |
| `tecnico` | Lectura, escritura |
| `entidad` | Solo su entidad (`entidad_id`) |
| `lectura` | Solo lectura |

---

## Despliegue paso a paso

### 1. Repositorio GitHub
1. Crear repo público `entornoseguro` en la cuenta `escuelaydeportesevilla-ui`.
2. Subir el contenido de esta carpeta:
   ```bash
   git remote add origin https://github.com/escuelaydeportesevilla-ui/entornoseguro.git
   git push -u origin main
   ```

### 2. Apps Script (backend)
1. Con la cuenta Workspace: https://script.google.com → **Nuevo proyecto** → nombre `EntornoSeguro API`.
2. Configuración del proyecto → marcar **Mostrar appsscript.json**.
3. Copiar cada archivo de `/apps-script` (o usar `clasp`, paso 6).
4. Ejecutar `setupSistema` → autorizar permisos. Crea la hoja `EntornoSeguro · Base de datos` y te da de alta como `admin`.
5. Configuración → **Propiedades del script**:
   - `GOOGLE_CLIENT_ID` → del paso 3
   - `CLAUDE_API_KEY` → clave de console.anthropic.com
   - `CLAUDE_MODEL` → opcional (por defecto `claude-sonnet-5`)
6. **Implementar → Nueva implementación → Aplicación web**
   - Ejecutar como: **Yo**
   - Acceso: **Cualquier usuario**
   - Copiar la URL `/exec` y el **ID de implementación**.

> Si Workspace bloquea "Cualquier usuario": Admin console → Apps → Google Workspace → Drive y Docs → permitir compartir fuera del dominio para Apps Script.

### 3. OAuth Client ID (login Google)
1. https://console.cloud.google.com → proyecto nuevo `entornoseguro`.
2. **APIs y servicios → Pantalla de consentimiento OAuth** → tipo *Interno* (solo cuentas Workspace) o *Externo* (si accederán clubes con Gmail).
3. **Credenciales → Crear → ID de cliente OAuth → Aplicación web**
   - Orígenes JavaScript autorizados:
     - `https://entornoseguro.escuelaydeporte.com`
     - `https://escuelaydeportesevilla-ui.github.io`
4. Copiar el Client ID.

### 4. Frontend
Editar `docs/js/config.js`:
```js
API_URL: 'https://script.google.com/macros/s/XXXX/exec',
GOOGLE_CLIENT_ID: 'XXXX.apps.googleusercontent.com'
```
Commit y push.

### 5. GitHub Pages + dominio
1. Repo → **Settings → Pages** → Source: *Deploy from a branch* → `main` / `/docs`.
2. Custom domain: `entornoseguro.escuelaydeporte.com` (ya incluido en `docs/CNAME`).
3. **Squarespace Domains** → escuelaydeporte.com → DNS → Custom records:

   | Host | Tipo | Valor |
   |---|---|---|
   | `entornoseguro` | CNAME | `escuelaydeportesevilla-ui.github.io` |

4. No modificar los registros MX (correo Workspace).
5. Tras propagar (10 min–24 h): marcar **Enforce HTTPS**.
6. Recomendado: GitHub → Settings (perfil) → Pages → **Verified domains** → verificar `escuelaydeporte.com` (registro TXT) para evitar secuestro de subdominio.

### 6. Despliegue automático (opcional)
Cada push en `apps-script/**` sube el código con `clasp`.
1. En tu equipo: `npm i -g @google/clasp@2` → `clasp login` (cuenta Workspace).
2. Activar Apps Script API: https://script.google.com/home/usersettings
3. GitHub → Settings → Secrets and variables → Actions:
   - `CLASPRC_JSON` → contenido de `~/.clasprc.json`
   - `SCRIPT_ID` → Configuración del proyecto Apps Script
   - `DEPLOYMENT_ID` → ID de implementación (mantiene la misma URL)

### 7. Puesta en marcha
1. Hoja `Config_Municipio`: rellenar `delegado_municipal`, `email_alertas`.
2. Hoja `Usuarios_Roles`: dar de alta usuarios (email, rol, `activo = SI`).
3. Revisar `Requisitos_Protocolo`: periodicidades orientativas, validar con el texto oficial del Protocolo Marco.
4. Evidencias: guardar documentos en Drive de Workspace (acceso restringido) y pegar el enlace.

## Protección de datos
- La hoja solo contiene datos de entidades y adultos (delegados, formación).
- No registrar nombres ni datos de menores en ninguna hoja.
- La IA recibe solo texto saneado (DNI, NIE, teléfonos y emails se enmascaran).
- Toda acción queda en `Log_Auditoria`.
- Antes de la fase 2: contrato de encargo de tratamiento con el Ayuntamiento, EIPD e informe del DPD.

## Estructura
```
docs/                  Frontend (GitHub Pages)
  CNAME                entornoseguro.escuelaydeporte.com
  index.html
  css/app.css
  js/config.js         URL API + Client ID (públicos)
  js/api.js            Cliente API
  js/app.js            Lógica de vistas
apps-script/           Backend
  Code.gs              Router y acciones
  Auth.gs              Verificación token + roles
  Db.gs                Acceso a Sheets con LockService
  Setup.gs             Crea hojas y requisitos A–K
  Alertas.gs           Motor de alertas diario
  IA.gs                Claude API
  appsscript.json
.github/workflows/     CI clasp
```
