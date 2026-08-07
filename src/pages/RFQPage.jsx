import { useState } from 'react';
import { saveRFQ } from '../store';
import { supabase } from '../supabaseClient';

const N8N_WEBHOOK_URL = 'https://roadnlmx.app.n8n.cloud/webhook-test/fd5bb4ce-a3d1-44e7-986d-c9e84aae3391';

const EXAMPLES = [
  'Monterrey a Laredo, dry van, 2 unidades',
  'Veracruz a CDMX, 40HC, 1 unidad',
  'Guadalajara a Chicago, reefer, 3 unidades',
];

function parseLaneParts(text) {
  const patterns = [
    /(?:de|from)\s+([\w\s]+?)\s+(?:a|to)\s+([\w\s]+?)(?:\s*,|\s*$)/i,
    /([\w\s]+?)\s+(?:a|to)\s+([\w\s]+?)(?:\s+en|\s+,|\s*$)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return { origin: m[1].trim(), destination: m[2].trim() };
  }
  return null;
}

function timeAgo(iso) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.round(hrs / 24);
  return `hace ${days} días`;
}

// Comparativa de referencia -- NO son respuestas en vivo de carriers, son
// datos ya guardados en Supabase (tarifarios subidos, o cotizaciones reales
// anteriores en la misma ruta). Se busca por coincidencia parcial de ciudad
// (ILIKE), no hay normalizacion geografica todavia -- limitacion conocida.
async function fetchReferenceComparison(origin, destination) {
  if (!origin || !destination) return [];

  const { data: rateCardsData } = await supabase
    .from('rate_cards')
    .select('carrier_id, base_rate, valid_until')
    .ilike('origin_city', `%${origin}%`)
    .ilike('destination_city', `%${destination}%`)
    .eq('is_active', true);

  const { data: matchingQuotes } = await supabase
    .from('quotes')
    .select('id')
    .ilike('origin_city', `%${origin}%`)
    .ilike('destination_city', `%${destination}%`)
    .limit(30);

  let historicalRfqs = [];
  if (matchingQuotes && matchingQuotes.length) {
    const quoteIds = matchingQuotes.map(q => q.id);
    const { data: rfqData } = await supabase
      .from('quote_rfqs')
      .select('carrier_id, quoted_rate, responded_at')
      .in('quote_id', quoteIds)
      .eq('status', 'responded')
      .order('responded_at', { ascending: false });
    historicalRfqs = rfqData || [];
  }

  // Cotizacion mas reciente por carrier
  const latestByCarrier = {};
  historicalRfqs.forEach(r => {
    if (!r.quoted_rate) return;
    if (!latestByCarrier[r.carrier_id]) latestByCarrier[r.carrier_id] = r;
  });

  const rateCardByCarrier = {};
  (rateCardsData || []).forEach(r => {
    if (!rateCardByCarrier[r.carrier_id]) rateCardByCarrier[r.carrier_id] = r;
  });

  // Si un carrier tiene las dos fuentes, gana la cotizacion real anterior --
  // es mas confiable que un tarifario estatico que puede estar desactualizado.
  const allCarrierIds = new Set([...Object.keys(latestByCarrier), ...Object.keys(rateCardByCarrier)]);
  if (allCarrierIds.size === 0) return [];

  const { data: carriersData } = await supabase
    .from('carriers')
    .select('id, name')
    .in('id', [...allCarrierIds]);
  const namesById = {};
  (carriersData || []).forEach(c => { namesById[c.id] = c.name; });

  const combined = [...allCarrierIds].map(carrierId => {
    const historical = latestByCarrier[carrierId];
    const rateCard = rateCardByCarrier[carrierId];
    if (historical) {
      return {
        carrierId, name: namesById[carrierId] || 'Carrier', price: Number(historical.quoted_rate),
        source: 'cotizacion_anterior',
        detail: `Cotización anterior · ${timeAgo(historical.responded_at)}`,
      };
    }
    return {
      carrierId, name: namesById[carrierId] || 'Carrier', price: Number(rateCard.base_rate),
      source: 'tarifario',
      detail: rateCard.valid_until ? `Tarifario · vigente hasta ${rateCard.valid_until}` : 'Tarifario de referencia',
    };
  });

  return combined.sort((a, b) => a.price - b.price);
}

export default function RFQPage({ user, onSellQuote }) {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!message.trim()) return;

    setStatus('loading');
    setError('');
    setResult(null);

    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace(/[-T:]/g, '');
    const suffix = user.id.slice(0, 4).toUpperCase();
    const rfqId = `FRIA-${timestamp}-${suffix}`;
    const laneParts = parseLaneParts(message);
    const lane = laneParts ? `${laneParts.origin} → ${laneParts.destination}` : null;

    const payload = {
      Body: message,
      From: 'whatsapp:dashboard',
      ProfileName: user.name,
      UserEmail: user.email,
      UserId: user.id,
      RFQId: rfqId,
      Source: 'dashboard',
    };

    try {
      // El envio real del RFQ (correos a carriers) y la busqueda de
      // referencia en Supabase corren en paralelo -- no hace falta esperar
      // uno para tener el otro.
      const [webhookData, reference] = await Promise.all([
        fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).then(async res => {
          const contentType = res.headers.get('content-type') || '';
          return contentType.includes('application/json') ? res.json() : null;
        }).catch(() => null),
        laneParts ? fetchReferenceComparison(laneParts.origin, laneParts.destination) : Promise.resolve([]),
      ]);

      saveRFQ({
        id: rfqId, userName: user.name, userId: user.id, message, lane,
        timestamp: new Date().toISOString(), status: 'sent', hasAnalysis: !!webhookData,
      });

      setResult({ rfqId, data: webhookData, lane, message, reference });
      setStatus('success');
      setMessage('');
    } catch (err) {
      setError('No se pudo conectar con FRIA. Intenta de nuevo en un momento.');
      setStatus('error');
    }
  }

  if (status === 'success' && result) {
    return <ComparativaView result={result} userEmail={user.email} onNewQuote={() => { setStatus('idle'); setResult(null); }} onSellQuote={onSellQuote} />;
  }

  return (
    <div style={{
      padding: '56px', display: 'flex', flexDirection: 'column', gap: '24px',
      maxWidth: '820px', margin: '0 auto',
    }}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
          Pídele una cotización a FRIA
        </div>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          Describe la ruta y el equipo en lenguaje natural — FRIA arma el RFQ y contacta a los carriers.
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {EXAMPLES.map((ex, i) => (
          <button key={i} onClick={() => setMessage(ex)} style={{
            padding: '10px 16px', borderRadius: '20px', border: '1px solid var(--border-input)',
            fontSize: '13px', color: 'var(--text-tertiary)', background: 'var(--bg-card)',
            cursor: 'pointer', fontFamily: 'var(--font)',
          }}>
            {ex}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder='Escribe tu solicitud, ej. "Necesito 2 dry van de Monterrey a Laredo saliendo el jueves"...'
          rows={5}
          style={{
            width: '100%', height: '150px', borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-card)', border: '1px solid var(--border-input)',
            padding: '20px', fontSize: '14px', color: 'var(--text-primary)',
            resize: 'vertical', outline: 'none', lineHeight: 1.6, fontFamily: 'var(--font)',
          }}
        />

        {error && (
          <div style={{ fontSize: '13px', color: 'var(--alert-text)', textAlign: 'center' }}>{error}</div>
        )}

        <button type="submit" disabled={!message.trim() || status === 'loading'} style={{
          alignSelf: 'center', height: '46px', padding: '0 30px', borderRadius: 'var(--radius-md)',
          background: message.trim() ? 'var(--accent-primary)' : 'var(--border-input)',
          color: message.trim() ? '#FFFFFF' : 'var(--text-secondary)',
          border: 'none', fontSize: '14px', fontWeight: 700,
          cursor: message.trim() ? 'pointer' : 'not-allowed', fontFamily: 'var(--font)',
        }}>
          {status === 'loading' ? 'Enviando…' : 'Enviar a FRIA'}
        </button>

        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>
          Enviando como <strong>{user.name}</strong> · el análisis llegará a <strong>{user.email}</strong>
        </div>
      </form>
    </div>
  );
}

const SOURCE_BADGE = {
  cotizacion_anterior: { label: 'Cotización anterior', bg: 'var(--info-bg)', color: 'var(--info-text)' },
  tarifario: { label: 'Tarifario', bg: '#EEF1F8', color: 'var(--text-secondary)' },
};

function ComparativaView({ result, userEmail, onNewQuote, onSellQuote }) {
  const liveCarriers = result.data?.carriers || result.data?.analysis?.carriers || [];
  const sorted = [...liveCarriers].sort((a, b) => a.price - b.price);
  const reference = result.reference || [];

  // Para "Armar cotizacion de venta": prioriza un carrier en vivo si existe,
  // si no, el mejor de la referencia (dejando claro que es referencia, no viva).
  const bestForSale = sorted[0] || reference[0];

  return (
    <div style={{ padding: '48px 56px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)',
        padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {result.lane || 'Solicitud enviada'}
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
          {result.rfqId} · enviado {timeAgo(new Date().toISOString())}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)',
          padding: '20px 22px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)',
        }}>
          RFQ enviado a los carriers — el análisis con respuestas reales llegará a <strong>{userEmail}</strong> conforme respondan.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sorted.map((c, i) => {
            const isWinner = i === 0 && c.price;
            return (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '18px 22px', borderRadius: 'var(--radius-lg)',
                background: isWinner ? 'var(--success-bg)' : 'var(--bg-card)',
                border: `1px solid ${isWinner ? 'var(--success-text)' : 'var(--border-card)'}`,
              }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: isWinner ? 700 : 600, color: 'var(--text-primary)' }}>
                    {c.name}
                  </div>
                  {isWinner && (
                    <div style={{ fontSize: '12px', color: 'var(--success-text)', fontWeight: 600, marginTop: '2px' }}>
                      Recomendado · mejor tarifa disponible
                    </div>
                  )}
                  {c.note && !isWinner && (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', fontStyle: 'italic' }}>
                      {c.note}
                    </div>
                  )}
                </div>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: '19px', fontWeight: 700,
                  color: isWinner ? 'var(--success-text)' : 'var(--text-tertiary)',
                }}>
                  {c.price ? `${c.currency || '$'}${c.price.toLocaleString()}` : '—'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {reference.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>
            Referencia mientras llegan respuestas reales
          </div>
          {reference.map((c, i) => {
            const badge = SOURCE_BADGE[c.source];
            return (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 22px', borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-panel)', border: '1px solid var(--border-card)',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 700,
                      background: badge.bg, color: badge.color,
                    }}>
                      {badge.label}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{c.detail}</div>
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '16px', fontWeight: 700, color: 'var(--text-tertiary)' }}>
                  ${c.price.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          disabled={!bestForSale}
          title={bestForSale ? '' : 'Disponible cuando haya al menos una cotización o referencia'}
          onClick={() => {
            if (!bestForSale || !onSellQuote) return;
            const [origin, destination] = (result.lane || ' → ').split(' → ');
            onSellQuote({
              quoteNumber: result.rfqId,
              origin: origin || '—',
              destination: destination || '—',
              equipment: null,
              carrierName: bestForSale.name,
              baseRate: bestForSale.price || 0,
              currency: bestForSale.currency || 'MXN',
              validUntil: null,
              transitDays: null,
              quoteId: null,
              returnTo: 'rfq',
            });
          }}
          style={{
            height: '46px', padding: '0 26px', borderRadius: 'var(--radius-md)',
            background: bestForSale ? 'var(--accent-primary)' : 'var(--border-input)',
            color: bestForSale ? '#FFFFFF' : 'var(--text-secondary)',
            border: 'none', fontSize: '14px', fontWeight: 700,
            cursor: bestForSale ? 'pointer' : 'not-allowed', fontFamily: 'var(--font)',
          }}
        >
          Armar cotización de venta →
        </button>
        <button onClick={onNewQuote} style={{
          height: '46px', padding: '0 20px', borderRadius: 'var(--radius-md)',
          background: 'none', border: '1px solid var(--border-input)', color: 'var(--text-primary)',
          fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)',
        }}>
          Nueva cotización
        </button>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: '20px', padding: '18px 22px',
        borderRadius: 'var(--radius-lg)', background: 'var(--bg-panel)', border: '1px solid rgba(46,91,168,.3)',
      }}>
        <svg width="120" height="46" viewBox="0 0 120 46" style={{ flexShrink: 0, opacity: 0.6 }}>
          <polyline points="0,36 20,30 40,32 60,18 80,22 100,10 120,14" fill="none" stroke="var(--accent-primary)" strokeWidth="2" />
        </svg>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Agrega Market Intelligence</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Ve benchmarks de mercado en tiempo real para esta ruta.
          </div>
        </div>
      </div>
    </div>
  );
}
