# NORA Dashboard — Setup & Deploy Guide

## 1. Configurar el Webhook de n8n

Abre `src/pages/RFQPage.jsx` y reemplaza:

```js
const N8N_WEBHOOK_URL = 'YOUR_N8N_WEBHOOK_URL_HERE';
```

Con la URL de tu webhook del Workflow 1 de n8n:

```js
const N8N_WEBHOOK_URL = 'https://tu-instancia.n8n.cloud/webhook/nora-rfq';
```

### Campos que llegan al webhook desde el Dashboard

| Campo | Descripción |
|-------|-------------|
| `Body` | Texto libre de la solicitud |
| `ProfileName` | Nombre del vendedor |
| `UserEmail` | Email del vendedor (para enviarle el análisis) |
| `UserId` | ID interno |
| `RFQId` | ID único formato NORA-timestamp-año |
| `Source` | Siempre "dashboard" |

---

## 2. Deploy en Vercel (gratis)

### Paso 1 — Subir a GitHub
```bash
git init
git add .
git commit -m "NORA Dashboard"
git remote add origin https://github.com/TU_USUARIO/nora-dashboard.git
git push -u origin main
```

### Paso 2 — Deploy
1. Ve a vercel.com, crea cuenta (puedes usar GitHub)
2. "Add New Project" → selecciona el repo
3. Vercel detecta Vite automáticamente → Deploy

URL resultante: `https://nora-dashboard.vercel.app`

---

## 3. Usuarios

Credenciales en `src/auth.js`:

| Nombre | Email | Contraseña |
|--------|-------|------------|
| Enrique Mendez | enrique.mendez@noatumlogistics.com | EnriqueNL |
| Oscar Aguilar | oscar.aguilar@noatumlogistics.com | OscarNL |
| Thomas Gaertner | thomas.gaertner@noatumlogistics.com | ThomasNL |
| Vicente Sanchez | vicente.sanchez@noatumlogistics.com | VicenteNL |
| Jacqueline Cruz | jacqueline.cruz@noatumlogistics.com | JacquelineNL |
| Michell Muñoz | michell.munoz@noatumlogistics.com | MichellNL |

---

## 4. Ajuste en n8n — Enviar análisis al email del vendedor

En el Workflow 1, nodo "Send a message1 (Outlook)", campo **To**:

```
{{ $('Webhook').item.json.body.UserEmail || 'adolfo.romero@noatumlogistics.com' }}
```

Esto hace que si la solicitud viene del Dashboard, el análisis llega al email del vendedor. Si viene de WhatsApp, usa el email habitual.

---

## 5. Estructura

```
src/
  auth.js          Usuarios y login
  store.js         Historial y métricas (localStorage)
  App.jsx          App principal
  index.css        Estilos (branding Noatum)
  components/
    Sidebar.jsx
  pages/
    LoginPage.jsx
    RFQPage.jsx
    HistoryPage.jsx
    MetricsPage.jsx
```
