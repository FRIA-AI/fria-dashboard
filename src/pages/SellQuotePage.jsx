import { useState } from 'react';
import { jsPDF } from 'jspdf';
import { supabase } from '../supabaseClient';

function todayLabel() {
  return new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

// NOTA: el logo del cliente va ligado al tenant y se define en el flujo de
// onboarding (todavia no construido) -- cuando exista, se agrega aqui como
// una imagen mas dentro del header, no antes.

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

function buildQuoteHtml({ folio, cliente, vendedor, origin, destination, equipment, rate, currency, validUntil, transitDays, condiciones }) {
  const equipmentLabel = (equipment || '—').replace(/_/g, ' ').toUpperCase();
  const conditionsHtml = CONDICIONES_GENERALES.map(c => `<li style="break-inside:avoid;margin-bottom:3px">${c}</li>`).join('');

  return `
  <div style="width:700px;background:#FFFFFF;font-family:'Inter',Arial,sans-serif;padding:0;box-sizing:border-box;">
    <div style="height:8px;background:linear-gradient(90deg,#4D8EFF,#2E5BA8)"></div>
    <div style="padding:36px 48px 28px;box-sizing:border-box;">

      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div style="display:flex;align-items:center;gap:12px">
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
        <div style="font-size:9px;color:#8894B3">FRIA · cotizaciones@friaai.com · hecho con FRIA — Freight Rate Intelligence</div>
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
    const L = 48, R = 564, W = R - L;
    let y = 48;

    // Barra superior (aproxima el gradiente del diseno con un color solido de marca)
    doc.setFillColor(46, 91, 168);
    doc.rect(0, 0, 612, 8, 'F');

    // Header: logo + fecha/folio
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(10, 15, 31);
    doc.text('FRIA', L, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(92, 107, 138);
    doc.text('FREIGHT RATE INTELLIGENCE', L, y + 11);

    doc.setFontSize(8);
    doc.text('FECHA', R, y - 14, { align: 'right' });
    doc.setFont('courier', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(10, 15, 31);
    doc.text(todayLabel(), R, y - 3, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(92, 107, 138);
    doc.text('FOLIO', R, y + 12, { align: 'right' });
    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(10, 15, 31);
    doc.text(String(context.quoteNumber || '—'), R, y + 23, { align: 'right' });

    y += 34;
    doc.setDrawColor(220, 224, 232);
    doc.setLineWidth(0.75);
    doc.line(L, y, R, y);

    y += 30;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(19);
    doc.setTextColor(10, 15, 31);
    doc.text('Cotización de flete', L, y);

    // Cliente / Vendedor
    y += 26;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(92, 107, 138);
    doc.text('CLIENTE', L, y);
    doc.text('VENDEDOR', L + W / 2, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(10, 15, 31);
    doc.text(cliente || '—', L, y + 15);
    doc.text(user?.name || '—', L + W / 2, y + 15);

    // Tarjeta de ruta
    y += 32;
    const routeCardH = 42;
    doc.setFillColor(245, 248, 253);
    doc.setDrawColor(230, 234, 242);
    doc.roundedRect(L, y, W, routeCardH, 8, 8, 'FD');
    const midY = y + routeCardH / 2 + 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(10, 15, 31);
    const originText = String(context.origin || '—');
    doc.text(originText, L + 16, midY);
    const originW = doc.getTextWidth(originText);

    // Flecha dibujada como vector -- nunca depende de si la fuente soporta el glifo "→"
    const arrowX = L + 16 + originW + 10;
    doc.setDrawColor(77, 142, 255);
    doc.setLineWidth(1.6);
    doc.line(arrowX, midY - 4, arrowX + 16, midY - 4);
    doc.line(arrowX + 16, midY - 4, arrowX + 11, midY - 8);
    doc.line(arrowX + 16, midY - 4, arrowX + 11, midY);

    doc.setTextColor(10, 15, 31);
    doc.text(String(context.destination || '—'), arrowX + 24, midY);

    const equipLabel = (context.equipment || '—').replace(/_/g, ' ').toUpperCase();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(46, 91, 168);
    const equipW = doc.getTextWidth(equipLabel) + 20;
    doc.setFillColor(234, 240, 251);
    doc.roundedRect(R - 16 - equipW, y + 11, equipW, 20, 10, 10, 'F');
    doc.text(equipLabel, R - 16 - equipW / 2, y + 24, { align: 'center' });

    // Tarjeta de tarifa
    y += routeCardH + 12;
    const rateCardH = 56;
    doc.setFillColor(234, 240, 251);
    doc.setDrawColor(77, 142, 255);
    doc.setLineWidth(1.2);
    doc.roundedRect(L, y, W, rateCardH, 9, 9, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(46, 91, 168);
    doc.text('TARIFA COTIZADA', L + 18, y + 18);
    doc.setFont('courier', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(10, 15, 31);
    doc.text(`$${finalRate.toLocaleString()}`, L + 18, y + 42);
    const rateW = doc.getTextWidth(`$${finalRate.toLocaleString()}`);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(92, 107, 138);
    doc.text(currency, L + 18 + rateW + 8, y + 42);

    // Fila de meta: vigencia / transito / condiciones de pago
    y += rateCardH + 20;
    doc.setDrawColor(230, 234, 242);
    doc.setLineWidth(0.75);
    doc.line(L, y - 8, R, y - 8);
    const colW = W / 3;
    const metaCols = [
      ['VIGENCIA', validUntil ? `Hasta ${validUntil}` : '—'],
      ['TRÁNSITO ESTIMADO', transitDays ? `${transitDays} día${transitDays == 1 ? '' : 's'}` : '—'],
      ['CONDICIONES DE PAGO', condiciones || '—'],
    ];
    metaCols.forEach(([label, value], i) => {
      const cx = L + i * colW;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(92, 107, 138);
      doc.text(label, cx, y);
      doc.setFont('courier', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(10, 15, 31);
      const lines = doc.splitTextToSize(value, colW - 12);
      doc.text(lines, cx, y + 13);
    });

    // Condiciones generales -- lista real en 2 columnas
    y += 34;
    doc.setDrawColor(230, 234, 242);
    doc.line(L, y, R, y);
    y += 16;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(10, 15, 31);
    doc.text('CONDICIONES GENERALES', L, y);
    y += 12;

    const colGap = 20;
    const condColW = (W - colGap) / 2;
    const half = Math.ceil(CONDICIONES_GENERALES.length / 2);
    const leftItems = CONDICIONES_GENERALES.slice(0, half);
    const rightItems = CONDICIONES_GENERALES.slice(half);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.7);
    doc.setTextColor(58, 69, 96);

    function renderList(items, x) {
      let cy = y;
      items.forEach(item => {
        const lines = doc.splitTextToSize(`•  ${item}`, condColW);
        doc.text(lines, x, cy);
        cy += lines.length * 8 + 2;
      });
      return cy;
    }
    const leftEndY = renderList(leftItems, L);
    const rightEndY = renderList(rightItems, L + condColW + colGap);
    y = Math.max(leftEndY, rightEndY) + 8;

    // Footer
    doc.setDrawColor(230, 234, 242);
    doc.line(L, y, R, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(136, 148, 179);
    doc.text('FRIA · cotizaciones@friaai.com · hecho con FRIA — Freight Rate Intelligence', L, y);
    doc.setFont('courier', 'normal');
    doc.text('Página 1 de 1', R, y, { align: 'right' });

    doc.save(`Cotizacion_${context.quoteNumber || 'FRIA'}.pdf`);

    if (context.quoteId) {
      setSaving(true);
      await supabase
        .from('quotes')
        .update({
          sell_price: finalRate,
          sell_margin_type: 'fixed',
          sell_margin_value: marginAmount,
          sell_currency: currency,
          sell_pdf_generated_at: new Date().toISOString(),
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
              }),
            }}
          />
        </div>
      </div>
    </div>
  );
}
