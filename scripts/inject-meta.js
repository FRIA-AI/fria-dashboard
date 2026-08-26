// Genera un archivo .html estatico por ruta, cada uno con su propio
// <title>/<meta description>/Open Graph/Twitter Card/canonica -- sin usar
// ningun navegador headless. Corre DESPUES de `vite build`, como parte del
// mismo comando de build (ver package.json), asi que Vercel lo ejecuta en
// cada despliegue automaticamente.
//
// Por que sin navegador: correr Playwright/Chromium DENTRO del paso de
// build de Vercel es un punto de falla conocido (dependencias de sistema
// faltantes, limites de tamano) -- ver nota para Adolfo. Este script en
// cambio solo lee el dist/index.html que Vite ya genero (que trae el
// <script>/<link> con el hash correcto de ESTA compilacion) y le inserta
// el bloque de metadatos de cada pagina antes de </head>, con texto plano,
// sin depender de nada mas que Node.
//
// Limite real de este enfoque: el contenido VISIBLE de la pagina (los
// textos que ve el usuario) sigue apareciendo solo despues de que el
// JavaScript corre -- esto NO cambia. Lo que si mejora, de inmediato y sin
// depender de JS: titulo y descripcion unicos por pagina, vista previa
// correcta al compartir en redes/WhatsApp, y los datos estructurados.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '..', 'dist');
const SITE_URL = 'https://www.friaai.com';

// Misma copia que cada pagina ya declara con <SEO> -- si cambias el texto
// en una pagina, actualiza tambien aqui para que no se desincronicen.
const ROUTES = {
  '/': {
    file: 'index.html',
    title: 'Cotizador de flete terrestre con IA | FRIA',
    description: 'FRIA cotiza transporte terrestre dentro de tu correo: manda el RFQ a tus carriers, lee sus respuestas y entrega la cotización de venta lista para el cliente. Para brokers de carga y forwarders en México y MX-US.',
    jsonLd: true,
  },
  '/que-es': {
    file: 'que-es.html',
    title: 'Qué es FRIA — Cotizador de flete con IA para brokers de carga | FRIA',
    description: 'FRIA automatiza la cotización de transporte terrestre: envía el RFQ a tus carriers desde tu propio correo, interpreta sus respuestas, y arma la cotización de venta. Sin llamadas ni hojas de cálculo.',
  },
  '/como-funciona': {
    file: 'como-funciona.html',
    title: 'Cómo funciona — De la solicitud al PDF de venta en 4 pasos | FRIA',
    description: 'Describe la ruta en lenguaje natural, FRIA envía el RFQ a tus carriers, lee y compara las respuestas, y arma la cotización de venta con tu margen aplicado. Todo dentro de tu correo.',
  },
  '/metricas': {
    file: 'metricas.html',
    title: 'Métricas de cotización para tu equipo comercial | FRIA',
    description: 'Qué cotiza tu equipo, cuánto, en qué rutas y con qué equipo — sin capturar un solo dato. Cada RFQ que sale por FRIA deja registro automático, listo para leer por vendedor, ruta o carrier.',
  },
  '/inteligencia-de-mercado': {
    file: 'inteligencia-de-mercado.html',
    title: 'Inteligencia de Mercado — Índice FRAI de tarifas de flete | FRIA',
    description: 'El Índice FRAI estima la tarifa esperada de una ruta antes de la primera respuesta, con base en tarifarios y cotizaciones reales de toda la red de FRIA. Sabe si tu tarifa está dentro de mercado antes de cerrar.',
  },
  '/demo': {
    file: 'demo.html',
    title: 'Agenda una demo con tu ruta real | FRIA',
    description: 'Te mostramos FRIA con una de tus rutas reales — 30 minutos, sin instalar nada ni conectar tu correo todavía. Preparamos la demo con tu caso y te escribimos para agendarla.',
  },
  '/aviso-de-privacidad': {
    file: 'aviso-de-privacidad.html',
    title: 'Aviso de Privacidad | FRIA',
    description: 'Aviso de Privacidad de FRIA (Freight Rate Intelligence Agent).',
    noindex: true,
  },
};

function buildHead(routePath, meta) {
  const url = `${SITE_URL}${routePath}`;
  const ogImage = `${SITE_URL}/og-cover.png`;
  const parts = [
    `<title>${meta.title}</title>`,
    `<meta name="description" content="${meta.description}">`,
    `<link rel="canonical" href="${url}">`,
  ];
  if (meta.noindex) {
    parts.push('<meta name="robots" content="noindex, follow">');
  }
  parts.push(
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="FRIA">',
    `<meta property="og:title" content="${meta.title}">`,
    `<meta property="og:description" content="${meta.description}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${ogImage}">`,
    '<meta property="og:locale" content="es_MX">',
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${meta.title}">`,
    `<meta name="twitter:description" content="${meta.description}">`,
    `<meta name="twitter:image" content="${ogImage}">`,
  );
  if (meta.jsonLd) {
    parts.push(
      '<script type="application/ld+json">' + JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'FRIA',
        alternateName: 'Freight Rate Intelligence Agent',
        url: SITE_URL,
        description: 'Plataforma de cotización de flete terrestre e inteligencia de mercado para brokers de carga, freight forwarders, y operadores logísticos en México y el corredor MX-US.',
      }) + '</script>',
      '<script type="application/ld+json">' + JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'FRIA',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description: 'FRIA automatiza la cotización de transporte terrestre: envía el RFQ a los carriers, interpreta sus respuestas, y genera la cotización de venta con margen aplicado.',
        url: SITE_URL,
      }) + '</script>',
    );
  }
  return parts.join('\n    ');
}

function main() {
  const baseHtmlPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(baseHtmlPath)) {
    console.error('No se encontró dist/index.html -- corre "vite build" primero.');
    process.exit(1);
  }
  const baseHtml = fs.readFileSync(baseHtmlPath, 'utf-8');

  for (const [routePath, meta] of Object.entries(ROUTES)) {
    const head = buildHead(routePath, meta);
    const html = baseHtml.replace('</head>', `    ${head}\n  </head>`);
    const outPath = path.join(DIST_DIR, meta.file);
    fs.writeFileSync(outPath, html, 'utf-8');
    console.log(`${meta.file} <- metadatos de ${routePath}`);
  }
}

main();
