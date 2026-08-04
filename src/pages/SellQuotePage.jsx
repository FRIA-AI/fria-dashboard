import { useState, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { supabase } from '../supabaseClient';

function todayLabel() {
  return new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
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
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Ve a Pricing o a Historial y elige un carrier con tarifa para armar una cotización de venta.
        </div>
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
    const left = 56;
    let y = 60;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(10, 15, 31);
    doc.text('FRIA', left, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(92, 107, 138);
    doc.text('FREIGHT RATE INTELLIGENCE', left, y + 12);

    doc.setFontSize(10);
    doc.text(todayLabel(), 556, y - 4, { align: 'right' });
    doc.text(`Folio: ${context.quoteNumber || '—'}`, 556, y + 10, { align: 'right' });

    y += 30;
    doc.setDrawColor(10, 15, 31);
    doc.setLineWidth(1.2);
    doc.line(left, y, 556, y);

    y += 32;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(10, 15, 31);
    doc.text('Cotización de flete', left, y);

    y += 26;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Cliente', left, y);
    doc.text('Vendedor', 340, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(58, 69, 96);
    doc.text(cliente || '—', left, y + 14);
    doc.text(user?.name || '—', 340, y + 14);

    const rows = [
      ['Ruta', `${context.origin} → ${context.destination}`],
      ['Equipo', context.equipment || '—'],
      ['Carrier', context.carrierName || '—'],
      ['Tarifa', `$${finalRate.toLocaleString()} ${currency}`],
      ['Vigencia', validUntil ? `Hasta ${validUntil}` : '—'],
      ['Tránsito estimado', transitDays ? `${transitDays} día${transitDays == 1 ? '' : 's'}` : '—'],
      ['Condiciones de pago', condiciones || '—'],
    ];

    y += 38;
    doc.setFontSize(11);
    rows.forEach(([label, value]) => {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(92, 107, 138);
      doc.text(label, left, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(10, 15, 31);
      doc.text(String(value), 556, y, { align: 'right' });
      y += 22;
    });

    y += 16;
    doc.setDrawColor(220, 224, 232);
    doc.setLineWidth(0.6);
    doc.line(left, y, 556, y);
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(92, 107, 138);
    const disclaimer = 'Tarifa sujeta a disponibilidad de unidad al confirmar. Incluye seguro de carga básico; no incluye maniobras especiales ni tiempo de espera mayor a 2 horas.';
    const lines = doc.splitTextToSize(disclaimer, 500);
    doc.text(lines, left, y);

    doc.setFontSize(8);
    doc.setTextColor(154, 167, 196);
    doc.text('FRIA · cotizaciones@friaai.com', left, 740);
    doc.text('Página 1 de 1', 556, 740, { align: 'right' });

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
        <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
          Armar cotización de venta
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
        background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)',
        padding: '36px', display: 'flex', flexDirection: 'column', gap: '18px', color: 'var(--text-primary)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--text-primary)', paddingBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700 }}>FRIA</div>
            <div style={{ fontSize: '9px', color: 'var(--text-secondary)', letterSpacing: '.04em' }}>FREIGHT RATE INTELLIGENCE</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{todayLabel()}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Folio: {context.quoteNumber || '—'}</div>
          </div>
        </div>

        <div style={{ fontSize: '18px', fontWeight: 700 }}>Cotización de flete</div>

        <div style={{
          display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)',
          background: 'var(--bg-panel)', borderRadius: 'var(--radius-md)', padding: '12px 14px',
        }}>
          <div><div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Cliente</div><div>{cliente || '—'}</div></div>
          <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Vendedor</div><div>{user?.name || '—'}</div></div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
          {[
            ['Ruta', `${context.origin} → ${context.destination}`],
            ['Equipo', context.equipment || '—'],
            ['Tarifa', `$${finalRate.toLocaleString()} ${currency}`, true],
            ['Vigencia', validUntil ? `Hasta ${validUntil}` : '—'],
            ['Tránsito estimado', transitDays ? `${transitDays} días` : '—'],
            ['Condiciones de pago', condiciones || '—'],
          ].map(([label, value, mono]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
              <span style={{ fontWeight: 600, fontFamily: mono ? 'var(--mono)' : 'var(--font)' }}>{value}</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5, borderTop: '1px solid var(--border-card)', paddingTop: '14px' }}>
          Tarifa sujeta a disponibilidad de unidad al confirmar. Incluye seguro de carga básico; no incluye maniobras especiales ni tiempo de espera mayor a 2 horas.
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-card)', paddingTop: '12px' }}>
          <span>FRIA · cotizaciones@friaai.com</span><span>Página 1 de 1</span>
        </div>
      </div>
    </div>
  );
}
