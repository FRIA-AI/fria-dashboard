import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { supabase } from '../supabaseClient';

function todayLabel() {
  return new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function loadFonts(doc) {
  const fonts = [
    ['/fonts/Inter-Regular.ttf', 'Inter', 'normal'],
    ['/fonts/Inter-Bold.ttf', 'Inter', 'bold'],
    ['/fonts/Inter-ExtraBold.ttf', 'InterExtraBold', 'bold'],
    ['/fonts/JetBrainsMono-Regular.ttf', 'JetBrainsMono', 'normal'],
    ['/fonts/JetBrainsMono-Bold.ttf', 'JetBrainsMono', 'bold'],
  ];
  for (const [url, name, style] of fonts) {
    const res = await fetch(url);
    const buffer = await res.arrayBuffer();
    const b64 = await arrayBufferToBase64(buffer);
    const fileName = url.split('/').pop();
    doc.addFileToVFS(fileName, b64);
    doc.addFont(fileName, name, style);
  }
}

const CONDICIONES_GENERALES = [
  'Tarifas más IVA.',
  'Sujeto a pesos y dimensiones de la carga.',
  'Sujeto a direcciones exactas de recolección y entrega.',
  'No incluye maniobras de carga y descarga.',
  'No incluye seguro de mercancía; la carga viaja por cuenta y riesgo del cliente salvo contratación de cobertura adicional.',
  'Servicios fuera de horario hábil, fines de semana o días festivos se consideran extraordinarios y tienen costo adicional.',
  'Cancelaciones o reprogramaciones de último momento (unidad ya asignada o en ruta) generan cargo de flete en falso por el 100% del flete.',
  'Peso legal máximo: 24 toneladas por contenedor, incluyendo tara (conforme a la NOM-012-SCT). El excedente sobre este peso genera un cargo por sobrepeso de $7,000 + IVA por contenedor.',
  'Tarifas sujetas a ajuste por variaciones en combustible y/o casetas.',
  'Mercancía de alto valor o que requiera custodia especial se cotiza y valida caso por caso.',
  'Sujeto a recibir el MSDS de la mercancía para validar el UN y que se pueda prestar el servicio.',
  'Sujeto a requisitos especiales de EPP, documentación o equipamiento de la unidad.',
  'En caso de requerir rampa hidráulica se revisa caso por caso.',
  'Las estadías de unidades refrigeradas tienen costo adicional de diésel a confirmar caso por caso (por mantenimiento de temperatura).',
  'Solicitar unidad con 48 horas de anticipación para garantizar disponibilidad.',
  'Tránsito en zonas de alto riesgo se debe revisar antes de despachar la unidad.',
];

function buildQuoteHtml({ folio, cliente, vendedor, origin, destination, equipment, rate, currency, validUntil, transitDays, condiciones, logoUrl }) {
  const equipmentLabel = (equipment || '—').replace(/_/g, ' ').toUpperCase();
  const conditionsHtml = CONDICIONES_GENERALES.map(c => `<li style="break-inside:avoid;margin-bottom:3px">${c}</li>`).join('');

  return `
  <div style="width:700px;background:#FFFFFF;font-family:'Inter',Arial,sans-serif;padding:0;box-sizing:border-box;">
    <div style="height:8px;background:linear-gradient(90deg,#4D8EFF,#2E5BA8)"></div>
    <div style="padding:36px 48px 28px;box-sizing:border-box;">

      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div style="display:flex;align-items:center;gap:12px">
          ${logoUrl ? `
          <img src="${logoUrl}" alt="Logo cliente" style="max-height:40px;max-width:180px;object-fit:contain" />
          ` : `
          <div style="display:flex;align-items:flex-end;gap:3px;height:22px">
            <div style="width:6px;height:40%;background:#0A0F1F;border-radius:1px"></div>
            <div style="width:6px;height:65%;background:#2E5BA8;border-radius:1px"></div>
            <div style="width:6px;height:100%;background:#4D8EFF;border-radius:1px"></div>
            <div style="width:6px;height:80%;background:#7BA7EE;border-radius:1px"></div>
            <div style="width:6px;height:55%;background:#0A0F1F;border-radius:1px"></div>
          </div>
          <div>
            <div style="font-size:20px;font-weight:800;color:#0A0F1F;letter-spacing:-.01em;line-height:1">FRIA</div>
            <div style="font-size:9px;font-weight:600;color:#5C6B8A;letter-spacing:.08em;margin-top:3px">FREIGHT RATE INTELLIGENCE</div>
          </div>
          `}
        </div>
        <div style="text-align:right">
          <div style="font-size:9px;font-weight:600;color:#5C6B8A;letter-spacing:.06em;text-transform:uppercase">Fecha</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#0A0F1F;margin-top:2px">${todayLabel()}</div>
          <div style="font-size:9px;font-weight:600;color:#5C6B8A;letter-spacing:.06em;text-transform:uppercase;margin-top:8px">Folio</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#0A0F1F;margin-top:2px">${folio}</div>
        </div>
      </div>

      <div style="height:1px;background:rgba(10,15,31,.1);margin-top:24px"></div>
      <div style="font-size:24px;font-weight:700;color:#0A0F1F;letter-spacing:-.01em;margin-top:24px">Cotización de flete</div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:22px">
        <div>
          <div style="font-size:10px;font-weight:700;color:#5C6B8A;letter-spacing:.06em;text-transform:uppercase">Cliente</div>
          <div style="font-size:15px;font-weight:600;color:#0A0F1F;margin-top:4px">${cliente || '—'}</div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:#5C6B8A;letter-spacing:.06em;text-transform:uppercase">Vendedor</div>
          <div style="font-size:15px;font-weight:600;color:#0A0F1F;margin-top:4px">${vendedor || '—'}</div>
        </div>
      </div>

      <div style="margin-top:26px;padding:20px 22px;background:#F5F8FD;border:1px solid rgba(10,15,31,.08);border-radius:10px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:19px;font-weight:700;color:#0A0F1F">${origin} <span style="color:#4D8EFF">&#8594;</span> ${destination}</div>
          <div style="display:inline-flex;align-items:center;padding:5px 12px;border-radius:20px;background:#EAF0FB;border:1px solid rgba(10,15,31,.08);font-size:11px;font-weight:700;color:#2E5BA8;letter-spacing:.02em">${equipmentLabel}</div>
        </div>
      </div>

      <div style="margin-top:14px;padding:18px 24px;background:linear-gradient(135deg,#EAF0FB,#F5F8FD);border:1.5px solid #4D8EFF;border-radius:12px">
        <div style="font-size:10px;font-weight:700;color:#2E5BA8;letter-spacing:.06em;text-transform:uppercase">Tarifa cotizada</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:34px;font-weight:700;color:#0A0F1F;margin-top:4px;letter-spacing:-.01em">$${rate.toLocaleString()} <span style="font-size:15px;font-weight:600;color:#5C6B8A">${currency}</span></div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:16px;padding-top:14px;border-top:1px solid rgba(10,15,31,.08)">
        <div>
          <div style="font-size:9.5px;font-weight:700;color:#5C6B8A;letter-spacing:.06em;text-transform:uppercase">Vigencia</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#0A0F1F;margin-top:4px">${validUntil ? `Hasta ${validUntil}` : '—'}</div>
        </div>
        <div>
          <div style="font-size:9.5px;font-weight:700;color:#5C6B8A;letter-spacing:.06em;text-transform:uppercase">Tránsito estimado</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#0A0F1F;margin-top:4px">${transitDays ? `${transitDays} día${transitDays == 1 ? '' : 's'}` : '—'}</div>
        </div>
        <div>
          <div style="font-size:9.5px;font-weight:700;color:#5C6B8A;letter-spacing:.06em;text-transform:uppercase">Condiciones de pago</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#0A0F1F;margin-top:4px">${condiciones || '—'}</div>
        </div>
      </div>

      <div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(10,15,31,.08)">
        <div style="font-size:10px;font-weight:700;color:#0A0F1F;letter-spacing:.05em;text-transform:uppercase;margin-bottom:6px">Condiciones generales</div>
        <ul style="columns:2;column-gap:26px;margin:0;padding-left:13px;font-size:7.6px;line-height:1.5;color:#3A4560">${conditionsHtml}</ul>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding-top:10px;border-top:1px solid rgba(10,15,31,.06)">
        <div style="font-size:9px;color:#8894B3">FRIA · cotizaciones@friaai.com</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#8894B3">Página 1 de 1</div>
      </div>
    </div>
  </div>`;
}

export default function SellQuotePage({ user, context, setActiveTab }) {
  const [cliente, setCliente] = useState('');
  const [condiciones, setCondiciones] = useState('50% anticipo · 50% contra entrega');
  const [validUntil, setValidUntil] = useState(context?.validUntil || '');
  const [transitDays, setTransitDays] = useState(context?.transitDays ?? '');
  const [marginAmount, setMarginAmount] = useState(0);
  const [marginPercent, setMarginPercent] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoUrl, setLogoUrl] = useState(null);

  useEffect(() => {
    async function loadBranding() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const res = await fetch('/api/tenant-branding', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        setLogoUrl(data.logoUrl || null);
      } catch {
        setLogoUrl(null);
      }
    }
    loadBranding();
  }, []);

  if (!context) {
    return (
      <div style={{ padding: '56px', textAlign: 'center' }}>
        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
          Nada que armar todavía
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '18px' }}>
          Ve a Pricing o a Historial y elige un carrier con tarifa para armar una cotización de venta.
        </div>
        <button onClick={() => setActiveTab('home')} style={{
          height: '40px', padding: '0 20px', borderRadius: 'var(--radius-md)',
          background: 'var(--accent-primary)', color: '#FFFFFF', border: 'none',
          fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)',
        }}>
          ← Ir a Inicio
        </button>
      </div>
    );
  }

  const baseRate = context.baseRate || 0;
  const currency = context.currency || 'MXN';
  const finalRate = baseRate + marginAmount;

  function handleAmountChange(v) {
    const amt = parseFloat(v) || 0;
    setMarginAmount(amt);
    setMarginPercent(baseRate ? +((amt / baseRate) * 100).toFixed(1) : 0);
  }

  function handlePercentChange(v) {
    const pct = parseFloat(v) || 0;
    setMarginPercent(pct);
    setMarginAmount(baseRate ? Math.round(baseRate * (pct / 100)) : 0);
  }

  async function handleDownload() {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    await loadFonts(doc);

    const SCALE = 612 / 700;
    const px = n => n * SCALE;

    const L = px(48);
    const R = 612 - px(48);
    const W = R - L;

    // Logo del cliente -- se prepara ANTES de dibujar el encabezado, para
    // poder decidir si va el logo del cliente o la marca de FRIA a la
    // izquierda (nunca los dos). Si el tenant no tiene logo, o si falla la
    // descarga, cae de vuelta a la marca de FRIA -- nunca se queda vacio.
    let clientLogo = null;
    if (logoUrl) {
      try {
        const logoRes = await fetch(logoUrl);
        const logoBuffer = await logoRes.arrayBuffer();
        const logoB64 = await arrayBufferToBase64(logoBuffer);
        const contentType = logoRes.headers.get('content-type') || '';
        const format = contentType.includes('png') ? 'PNG' : 'JPEG';

        const dims = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => resolve(null);
          img.src = `data:${contentType};base64,${logoB64}`;
        });

        if (dims) {
          clientLogo = { dataUrl: `data:${contentType};base64,${logoB64}`, format, dims };
        }
      } catch (e) {
        console.error('No se pudo descargar el logo del cliente, usando el de FRIA:', e);
      }
    }

    function gradientRect(x, yTop, w, h, colorA, colorB, direction = 'h') {
      const steps = 40;
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const r = Math.round(colorA[0] + (colorB[0] - colorA[0]) * t);
        const g = Math.round(colorA[1] + (colorB[1] - colorA[1]) * t);
        const b = Math.round(colorA[2] + (colorB[2] - colorA[2]) * t);
        doc.setFillColor(r, g, b);
        if (direction === 'h') {
          doc.rect(x + (w / steps) * i, yTop, w / steps + 0.5, h, 'F');
        } else {
          doc.rect(x, yTop + (h / steps) * i, w, h / steps + 0.5, 'F');
        }
      }
    }

    function drawLogoMark(x, yBase, sizePx = 22) {
      const barW = px(6), gap = px(3), markH = px(sizePx);
      const heights = [0.40, 0.65, 1.00, 0.80, 0.55];
      const colors = [[10, 15, 31], [46, 91, 168], [77, 142, 255], [123, 167, 238], [10, 15, 31]];
      let bx = x;
      heights.forEach((hPct, i) => {
        const barH = markH * hPct;
        doc.setFillColor(...colors[i]);
        doc.rect(bx, yBase - barH, barW, barH, 'F');
        bx += barW + gap;
      });
      return bx - gap;
    }

    gradientRect(0, 0, 612, px(8), [77, 142, 255], [46, 91, 168], 'h');

    let y = px(48);

        if (clientLogo) {
      // El logo del cliente sustituye la marca de FRIA -- este documento lo
      // ve el carrier/cliente final del tenant, debe verse como suyo.
      // Se ancla desde arriba, usando casi todo el alto disponible del
      // encabezado (hasta la linea divisoria) -- necesario para que logos
      // casi cuadrados o verticales (icono + texto apilado, como el de
      // Terra) se vean con presencia real, no diminutos.
      const { dataUrl, format, dims } = clientLogo;
      const logoTop = px(8);
      const maxW = px(190), maxH = px(58);
      let w = maxW, h = (dims.h / dims.w) * maxW;
      if (h > maxH) { h = maxH; w = (dims.w / dims.h) * maxH; }
      doc.addImage(dataUrl, format, L, logoTop, w, h);
    } else {
      const markEndX = drawLogoMark(L, y - px(2), 22);
      doc.setFont('InterExtraBold', 'bold');
      doc.setFontSize(px(20));
      doc.setTextColor(10, 15, 31);
      doc.text('FRIA', markEndX + px(10), y - px(6));
      doc.setFont('Inter', 'normal');
      doc.setFontSize(px(9));
      doc.setTextColor(92, 107, 138);
      doc.text('FREIGHT RATE INTELLIGENCE', markEndX + px(10), y + px(6));
    }

    doc.setFont('Inter', 'bold');
    doc.setFontSize(px(9));
    doc.setTextColor(92, 107, 138);
    doc.text('FECHA', R, y - px(14), { align: 'right' });
    doc.setFont('JetBrainsMono', 'normal');
    doc.setFontSize(px(12));
    doc.setTextColor(10, 15, 31);
    doc.text(todayLabel(), R, y - px(2), { align: 'right' });
    doc.setFont('Inter', 'bold');
    doc.setFontSize(px(9));
    doc.setTextColor(92, 107, 138);
    doc.text('FOLIO', R, y + px(11), { align: 'right' });
    doc.setFont('JetBrainsMono', 'normal');
    doc.setFontSize(px(11));
    doc.setTextColor(10, 15, 31);
    doc.text(String(context.quoteNumber || '—'), R, y + px(23), { align: 'right' });

    y += px(24 + 24);
    doc.setDrawColor(220, 224, 232);
    doc.setLineWidth(0.75);
    doc.line(L, y - px(24), R, y - px(24));

    doc.setFont('Inter', 'bold');
    doc.setFontSize(px(24));
    doc.setTextColor(10, 15, 31);
    doc.text('Cotización de flete', L, y);

    y += px(22 + 4);
    doc.setFont('Inter', 'bold');
    doc.setFontSize(px(10));
    doc.setTextColor(92, 107, 138);
    doc.text('CLIENTE', L, y);
    doc.text('VENDEDOR', L + W / 2, y);
    doc.setFont('Inter', 'bold');
    doc.setFontSize(px(15));
    doc.setTextColor(10, 15, 31);
    doc.text(cliente || '—', L, y + px(15));
    doc.text(user?.name || '—', L + W / 2, y + px(15));

    y += px(26);
    const routeCardH = px(20 * 2 + 19);
    doc.setFillColor(245, 248, 253);
    doc.setDrawColor(230, 234, 242);
    doc.roundedRect(L, y, W, routeCardH, px(10), px(10), 'FD');
    const midY = y + routeCardH / 2 + px(5);

    doc.setFont('Inter', 'bold');
    doc.setFontSize(px(19));
    doc.setTextColor(10, 15, 31);
    const originText = String(context.origin || '—');
    doc.text(originText, L + px(22), midY);
    const originW = doc.getTextWidth(originText);

    const arrowX = L + px(22) + originW + px(10);
    doc.setDrawColor(77, 142, 255);
    doc.setLineWidth(1.6);
    doc.line(arrowX, midY - px(4), arrowX + px(16), midY - px(4));
    doc.line(arrowX + px(16), midY - px(4), arrowX + px(11), midY - px(8));
    doc.line(arrowX + px(16), midY - px(4), arrowX + px(11), midY);

    doc.setTextColor(10, 15, 31);
    doc.text(String(context.destination || '—'), arrowX + px(24), midY);

    const equipLabel = (context.equipment || '—').replace(/_/g, ' ').toUpperCase();
    doc.setFont('Inter', 'bold');
    doc.setFontSize(px(11));
    doc.setTextColor(46, 91, 168);
    const equipW = doc.getTextWidth(equipLabel) + px(24);
    doc.setFillColor(234, 240, 251);
    doc.roundedRect(R - px(22) - equipW, y + px(11), equipW, px(21), px(10), px(10), 'F');
    doc.text(equipLabel, R - px(22) - equipW / 2, y + px(24), { align: 'center' });

    y += routeCardH + px(14);
    const rateCardH = px(18 * 2 + 34);
    gradientRect(L, y, W, rateCardH, [234, 240, 251], [245, 248, 253], 'h');
    doc.setDrawColor(77, 142, 255);
    doc.setLineWidth(1.3);
    doc.roundedRect(L, y, W, rateCardH, px(12), px(12), 'D');
    doc.setFont('Inter', 'bold');
    doc.setFontSize(px(10));
    doc.setTextColor(46, 91, 168);
    doc.text('TARIFA COTIZADA', L + px(24), y + px(22));
    doc.setFont('JetBrainsMono', 'bold');
    doc.setFontSize(px(34));
    doc.setTextColor(10, 15, 31);
    const rateText = `$${finalRate.toLocaleString()}`;
    doc.text(rateText, L + px(24), y + px(50));
    const rateW = doc.getTextWidth(rateText);
    doc.setFont('Inter', 'bold');
    doc.setFontSize(px(15));
    doc.setTextColor(92, 107, 138);
    doc.text(currency, L + px(24) + rateW + px(8), y + px(50));

    y += rateCardH + px(16 + 14);
    doc.setDrawColor(230, 234, 242);
    doc.setLineWidth(0.75);
    doc.line(L, y - px(14), R, y - px(14));
    const colW = W / 3;
    const metaCols = [
      ['VIGENCIA', validUntil ? `Hasta ${validUntil}` : '—'],
      ['TRÁNSITO ESTIMADO', transitDays ? `${transitDays} día${transitDays == 1 ? '' : 's'}` : '—'],
      ['CONDICIONES DE PAGO', condiciones || '—'],
    ];
    metaCols.forEach(([label, value], i) => {
      const cx = L + i * colW;
      doc.setFont('Inter', 'bold');
      doc.setFontSize(px(9.5));
      doc.setTextColor(92, 107, 138);
      doc.text(label, cx, y);
      doc.setFont('JetBrainsMono', 'normal');
      doc.setFontSize(px(12));
      doc.setTextColor(10, 15, 31);
      const lines = doc.splitTextToSize(value, colW - px(12));
      doc.text(lines, cx, y + px(16));
    });

    y += px(34);
    doc.setDrawColor(230, 234, 242);
    doc.line(L, y, R, y);
    y += px(18);
    doc.setFont('Inter', 'bold');
    doc.setFontSize(px(10));
    doc.setTextColor(10, 15, 31);
    doc.text('CONDICIONES GENERALES', L, y);
    y += px(12);

    const colGap = px(26);
    const condColW = (W - colGap) / 2;
    const half = Math.ceil(CONDICIONES_GENERALES.length / 2);
    const leftItems = CONDICIONES_GENERALES.slice(0, half);
    const rightItems = CONDICIONES_GENERALES.slice(half);

    doc.setFont('Inter', 'normal');
    doc.setFontSize(px(7.6));
    doc.setTextColor(58, 69, 96);

    function renderList(items, x) {
      let cy = y;
      items.forEach(item => {
        const lines = doc.splitTextToSize(`•  ${item}`, condColW);
        doc.text(lines, x, cy);
        cy += lines.length * px(7.6 * 1.5) + px(1);
      });
      return cy;
    }
    const leftEndY = renderList(leftItems, L);
    const rightEndY = renderList(rightItems, L + condColW + colGap);
    y = Math.max(leftEndY, rightEndY) + px(8);

    const footerLineY = Math.max(y + px(20), 792 - px(40));
    doc.setDrawColor(230, 234, 242);
    doc.line(L, footerLineY, R, footerLineY);
    const footerTextY = footerLineY + px(14);
    doc.setFont('Inter', 'normal');
    doc.setFontSize(px(9));
    doc.setTextColor(136, 148, 179);
    doc.text('FRIA · cotizaciones@friaai.com', L, footerTextY);
    doc.setFont('JetBrainsMono', 'normal');
    doc.text('Página 1 de 1', R, footerTextY, { align: 'right' });

    // Se obtiene el PDF como blob para poder usarlo dos veces: descarga
    // inmediata en el navegador Y respaldo real en Storage -- antes solo
    // se descargaba y el archivo se perdia, sin quedar registrado en FRIA.
    const blob = doc.output('blob');
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `Cotizacion_${context.quoteNumber || 'FRIA'}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);

    if (context.quoteId) {
      setSaving(true);
      let pdfUrl = null;
      try {
        const fileName = `${context.quoteId}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from('sell-quotes')
          .upload(fileName, blob, { contentType: 'application/pdf', upsert: true });

        if (uploadError) {
          console.error('No se pudo guardar el PDF en Storage:', uploadError);
        } else {
          const { data: urlData } = supabase.storage.from('sell-quotes').getPublicUrl(fileName);
          pdfUrl = urlData.publicUrl;
        }
      } catch (e) {
        console.error('Error subiendo el PDF de venta:', e);
      }

      await supabase
        .from('quotes')
        .update({
          sell_price: finalRate,
          sell_margin_type: 'fixed',
          sell_margin_value: marginAmount,
          sell_currency: currency,
          sell_pdf_generated_at: new Date().toISOString(),
          sell_pdf_url: pdfUrl,
          status: 'quoted',
        })
        .eq('id', context.quoteId);
      setSaving(false);
      setSaved(true);
    }
  }

  return (
    <div style={{ padding: '48px 56px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <div
            onClick={() => setActiveTab(context.returnTo || 'home')}
            style={{ fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '10px' }}
          >
            ← {context.returnTo === 'history' ? 'Historial' : 'Pricing'}
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Armar cotización de venta
          </div>
        </div>

        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)',
          padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Tarifa base — {context.carrierName || 'carrier'} (ganador)
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '16px', color: 'var(--text-primary)' }}>
              ${baseRate.toLocaleString()}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Cliente</div>
            <input value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Nombre del cliente" style={{
              width: '100%', height: '40px', borderRadius: 'var(--radius-md)', background: 'var(--bg-panel)',
              border: '1px solid var(--border-input)', padding: '0 12px', fontSize: '13px', color: 'var(--text-primary)',
              fontFamily: 'var(--font)', boxSizing: 'border-box',
            }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Margen ($)</div>
              <input type="number" value={marginAmount} onChange={e => handleAmountChange(e.target.value)} style={{
                width: '100%', height: '44px', borderRadius: 'var(--radius-md)', background: 'var(--bg-panel)',
                border: '1px solid var(--border-input)', padding: '0 14px', fontFamily: 'var(--mono)', fontSize: '14px',
                color: 'var(--text-primary)', boxSizing: 'border-box',
              }} />
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Equivale a</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input type="number" value={marginPercent} onChange={e => handlePercentChange(e.target.value)} style={{
                  width: '100%', height: '44px', borderRadius: 'var(--radius-md)', background: 'var(--bg-panel)',
                  border: '1px solid var(--border-input)', padding: '0 14px', fontFamily: 'var(--mono)', fontSize: '14px',
                  color: 'var(--text-secondary)', boxSizing: 'border-box',
                }} />
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>%</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Vigencia</div>
              <input value={validUntil} onChange={e => setValidUntil(e.target.value)} placeholder="ej. 2026-08-14" style={{
                width: '100%', height: '40px', borderRadius: 'var(--radius-md)', background: 'var(--bg-panel)',
                border: '1px solid var(--border-input)', padding: '0 12px', fontSize: '13px', color: 'var(--text-primary)',
                fontFamily: 'var(--font)', boxSizing: 'border-box',
              }} />
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Tránsito (días)</div>
              <input type="number" value={transitDays} onChange={e => setTransitDays(e.target.value)} style={{
                width: '100%', height: '40px', borderRadius: 'var(--radius-md)', background: 'var(--bg-panel)',
                border: '1px solid var(--border-input)', padding: '0 12px', fontSize: '13px', color: 'var(--text-primary)',
                fontFamily: 'var(--font)', boxSizing: 'border-box',
              }} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Condiciones de pago</div>
            <input value={condiciones} onChange={e => setCondiciones(e.target.value)} style={{
              width: '100%', height: '40px', borderRadius: 'var(--radius-md)', background: 'var(--bg-panel)',
              border: '1px solid var(--border-input)', padding: '0 12px', fontSize: '13px', color: 'var(--text-primary)',
              fontFamily: 'var(--font)', boxSizing: 'border-box',
            }} />
          </div>

          <div style={{ height: '1px', background: 'var(--border-card)' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Tarifa final al cliente</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '24px', fontWeight: 700, color: 'var(--success-text)' }}>
              ${finalRate.toLocaleString()}
            </div>
          </div>

          <button onClick={handleDownload} disabled={saving} style={{
            height: '46px', borderRadius: 'var(--radius-md)', background: 'var(--accent-primary)', color: '#FFFFFF',
            border: 'none', fontSize: '14px', fontWeight: 700, cursor: saving ? 'default' : 'pointer',
            fontFamily: 'var(--font)', opacity: saving ? 0.7 : 1,
          }}>
            {saving ? 'Guardando…' : '⬇ Descargar PDF de cotización'}
          </button>
          {saved && (
            <div style={{ fontSize: '12px', color: 'var(--success-text)', textAlign: 'center' }}>
              Guardado en la cotización.
            </div>
          )}
        </div>
      </div>

      <div style={{
        background: '#E8ECF3', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)',
        padding: '20px', display: 'flex', justifyContent: 'center', overflow: 'hidden',
      }}>
        <div style={{ width: '360px', height: '466px', overflow: 'hidden', position: 'relative', boxShadow: '0 4px 16px rgba(10,15,31,.12)' }}>
          <div
            style={{ width: '700px', transform: 'scale(0.514)', transformOrigin: 'top left' }}
            dangerouslySetInnerHTML={{
              __html: buildQuoteHtml({
                folio: context.quoteNumber || '—',
                cliente,
                vendedor: user?.name,
                origin: context.origin,
                destination: context.destination,
                equipment: context.equipment,
                rate: finalRate,
                currency,
                validUntil,
                transitDays,
                condiciones,
                logoUrl,
              }),
            }}
          />
        </div>
      </div>
    </div>
  );
}
