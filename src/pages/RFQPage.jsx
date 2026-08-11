import { useState } from 'react';
import { saveRFQ } from '../store';
import { supabase } from '../supabaseClient';

const N8N_WEBHOOK_URL = 'https://roadnlmx.app.n8n.cloud/webhook-test/fd5bb4ce-a3d1-44e7-986d-c9e84aae3391';

const EXAMPLES = [
  'Monterrey a Laredo, dry van, 2 unidades',
  'Veracruz a CDMX, 40HC, 1 unidad',
  'Guadalajara a Chicago, reefer, 3 unidades',
];

function timeAgo(iso) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.round(hrs / 24);
  return `hace ${days} días`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Espera a que n8n termine de crear la fila en `quotes` (INSERT Quote1) con
// los campos ya normalizados por el LLM (origin_city/destination_city/
// equipment_type). El flujo real de n8n hace varias llamadas a IA y manda
// correos reales por cada carrier antes de terminar -- puede tardar bastante
// mas que unos segundos, por eso reintentamos varias veces con paciencia.
async function fetchNormalizedQuote(rfqId) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await supabase
      .from('quotes')
      .select('origin_city, destination_city, equipment_type')
      .eq('quote_number', rfqId)
      .maybeSingle();
    if (error) console.error('[FRIA] Error buscando quotes por quote_number:', error);
    console.log(`[FRIA] Intento ${attempt + 1}/6 buscando quote_number=${rfqId}:`, data);
    if (data) return data;
    await sleep(3000);
  }
  console.warn('[FRIA] No se encontró la fila en quotes después de 6 intentos (18s). El RFQ pudo no haberse procesado, o el quote_number no coincide.');
  return null;
}

// Reproduce EXACTAMENTE la logica de SR1 (Historical Rates) y SR2
// (Historical Quotes) del workflow real "Envio RFQ" -- mismo match de
// equipo (enum exacto), misma vigencia, misma ventana de 12 meses, mismo
// match bidireccional de ciudad. No es una version aproximada.
async function fetchComparison(originCity, destinationCity, equipmentType) {
  const today = new Date().toISOString().slice(0, 10);
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  console.log('[FRIA] Buscando comparativa para:', { originCity, destinationCity, equipmentType });

  // SR1 - Historical Rates: tarifarios vigentes, match bidireccional
  const { data: rateCardsData, error: rateCardsError } = await supabase
    .from('rate_cards')
    .select('carrier_id, base_rate, valid_until')
    .eq('equipment_type', equipmentType)
    .eq('is_active', true)
    .or(`valid_until.is.null,valid_until.gte.${today}`)
    .or(`origin_city.ilike.%${originCity}%,destination_city.ilike.%${destinationCity}%,origin_city.ilike.%${destinationCity}%,destination_city.ilike.%${originCity}%`)
    .order('base_rate', { ascending: true })
    .limit(20);
  if (rateCardsError) console.error('[FRIA] Error en rate_cards:', rateCardsError);
  console.log('[FRIA] rate_cards encontrados:', rateCardsData);

  // SR2 - Historical Quotes: cotizaciones vendidas en esta ruta/equipo, ultimos 12 meses
  const { data: historicalQuotes, error: historicalError } = await supabase
    .from('quotes')
    .select('sell_price, sell_currency, created_at, selected_rfq_id')
    .eq('equipment_type', equipmentType)
    .ilike('origin_city', `%${originCity}%`)
    .ilike('destination_city', `%${destinationCity}%`)
    .gte('created_at', twelveMonthsAgo.toISOString())
    .not('sell_price', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);
  if (historicalError) console.error('[FRIA] Error en quotes historicos:', historicalError);
  console.log('[FRIA] cotizaciones vendidas encontradas:', historicalQuotes);

  // Resolver el carrier ganador de cada cotizacion vendida (selected_rfq_id -> quote_rfqs)
  const rfqIds = (historicalQuotes || []).map(q => q.selected_rfq_id).filter(Boolean);
  let carrierByRfqId = {};
  if (rfqIds.length) {
    const { data: winningRfqs, error: winningError } = await supabase
      .from('quote_rfqs')
      .select('id, carrier_id')
      .in('id', rfqIds);
    if (winningError) console.error('[FRIA] Error resolviendo carrier ganador:', winningError);
    (winningRfqs || []).forEach(r => { carrierByRfqId[r.id] = r.carrier_id; });
  }

  const allCarrierIds = new Set([
    ...(rateCardsData || []).map(r => r.carrier_id),
    ...Object.values(carrierByRfqId),
  ]);
  if (allCarrierIds.size === 0) {
    console.log('[FRIA] Sin carriers en ninguna de las dos fuentes -- comparativa vacia.');
    return [];
  }

  const { data: carriersData, error: carriersError } = await supabase
    .from('carriers')
    .select('id, name')
    .in('id', [...allCarrierIds]);
  if (carriersError) console.error('[FRIA] Error obteniendo nombres de carriers:', carriersError);
  const namesById = {};
  (carriersData || []).forEach(c => { namesById[c.id] = c.name; });

  const fromRateCards = (rateCardsData || []).map(r => ({
    name: namesById[r.carrier_id] || 'Carrier',
    price: Number(r.base_rate),
    source: 'tarifario',
    detail: r.valid_until ? `Tarifario · vigente hasta ${r.valid_until}` : 'Tarifario de referencia',
  }));

  const fromHistorical = (historicalQuotes || [])
    .filter(q => carrierByRfqId[q.selected_rfq_id])
    .map(q => ({
      name: namesById[carrierByRfqId[q.selected_rfq_id]] || 'Carrier',
      price: Number(q.sell_price),
      source: 'cotizacion_anterior',
      detail: `Cotización anterior · ${timeAgo(q.created_at)}`,
    }));

  const result = [...fromRateCards, ...fromHistorical].sort((a, b) => a.price - b.price);
  console.log('[FRIA] Comparativa final combinada:', result);
  return result;
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
      const webhookResponse = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(e => {
        console.error('[FRIA] El webhook falló o no respondió:', e);
        return null;
      });
      console.log('[FRIA] Webhook respondió, status:', webhookResponse?.status, '(rfqId enviado:', rfqId, ')');

      // Una vez que n8n termino (el webhook ya normalizo origen/destino/equipo
      // con el mismo LLM que usa para el correo), leemos esa fila real y
      // corremos la misma comparativa que arma Basic LLM Chain4.
      const normalized = await fetchNormalizedQuote(rfqId);
      const lane = normalized ? `${normalized.origin_city} → ${normalized.destination_city}` : null;
      const comparison = normalized
        ? await fetchComparison(normalized.origin_city, normalized.destination_city, normalized.equipment_type)
        : [];

      saveRFQ({
        id: rfqId, userName: user.name, userId: user.id, message, lane,
        timestamp: new Date().toISOString(), status: 'sent', hasAnalysis: comparison.length > 0,
      });

      setResult({ rfqId, lane, message, comparison, normalized });
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
  const comparison = result.comparison || [];
  const winner = comparison[0];

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

      {comparison.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)',
          padding: '20px 22px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)',
        }}>
          Sin tarifarios ni cotizaciones anteriores en esta ruta. RFQ enviado a los carriers en vivo — el análisis llegará a <strong>{userEmail}</strong> conforme respondan.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {comparison.map((c, i) => {
            const isWinner = i === 0;
            const badge = SOURCE_BADGE[c.source];
            return (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '18px 22px', borderRadius: 'var(--radius-lg)',
                background: isWinner ? 'var(--success-bg)' : 'var(--bg-card)',
                border: `1px solid ${isWinner ? 'var(--success-text)' : 'var(--border-card)'}`,
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '15px', fontWeight: isWinner ? 700 : 600, color: 'var(--text-primary)' }}>
                      {c.name}
                    </span>
                    <span style={{
                      padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 700,
                      background: badge.bg, color: badge.color,
                    }}>
                      {badge.label}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '12px', marginTop: '2px',
                    color: isWinner ? 'var(--success-text)' : 'var(--text-secondary)',
                    fontWeight: isWinner ? 600 : 400,
                  }}>
                    {isWinner ? 'Mejor referencia disponible · ' : ''}{c.detail}
                  </div>
                </div>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: '19px', fontWeight: 700,
                  color: isWinner ? 'var(--success-text)' : 'var(--text-tertiary)',
                }}>
                  ${c.price.toLocaleString()}
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center' }}>
            Referencia de tarifarios y cotizaciones anteriores — el RFQ en vivo sigue en curso, el análisis con respuestas reales llegará a tu correo.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          disabled={!winner}
          title={winner ? '' : 'Disponible cuando haya al menos una referencia'}
          onClick={() => {
            if (!winner || !onSellQuote) return;
            onSellQuote({
              quoteNumber: result.rfqId,
              origin: result.normalized?.origin_city || '—',
              destination: result.normalized?.destination_city || '—',
              equipment: result.normalized?.equipment_type || null,
              carrierName: winner.name,
              baseRate: winner.price || 0,
              currency: 'MXN',
              validUntil: null,
              transitDays: null,
              quoteId: null,
              returnTo: 'rfq',
            });
          }}
          style={{
            height: '46px', padding: '0 26px', borderRadius: 'var(--radius-md)',
            background: winner ? 'var(--accent-primary)' : 'var(--border-input)',
            color: winner ? '#FFFFFF' : 'var(--text-secondary)',
            border: 'none', fontSize: '14px', fontWeight: 700,
            cursor: winner ? 'pointer' : 'not-allowed', fontFamily: 'var(--font)',
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
