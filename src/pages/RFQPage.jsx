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
// equipment_type), y de mandar los RFQs reales a los carriers relevantes
// (crea una fila en quote_rfqs por cada uno). El flujo real de n8n hace
// varias llamadas a IA y manda correos reales antes de terminar -- puede
// tardar bastante mas que unos segundos, por eso reintentamos con paciencia.
async function fetchNormalizedQuote(rfqId) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await supabase
      .from('quotes')
      .select('id, origin_city, destination_city, equipment_type')
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

// Los carriers "relevantes para esta ruta" son, literalmente, a quienes n8n
// ya decidio contactar (una fila en quote_rfqs por cada uno, creada por SR3 -
// Carriers for RFQ). Para CADA uno de esos carriers -- no solo los que ya
// tienen precio -- se busca primero tarifario, si no hay se busca cotizacion
// anterior vigente (ultimos 12 meses), y si tampoco hay, se muestra sin
// precio con la aclaracion de que se solicito al carrier.
async function fetchComparison(quoteId, originCity, destinationCity, equipmentType) {
  console.log('[FRIA] Buscando comparativa para:', { quoteId, originCity, destinationCity, equipmentType });

  // Carriers realmente contactados para ESTA cotizacion
  const { data: contactedRfqs, error: contactedError } = await supabase
    .from('quote_rfqs')
    .select('carrier_id')
    .eq('quote_id', quoteId);
  if (contactedError) console.error('[FRIA] Error obteniendo carriers contactados:', contactedError);
  const relevantCarrierIds = [...new Set((contactedRfqs || []).map(r => r.carrier_id).filter(Boolean))];
  console.log('[FRIA] Carriers contactados para esta ruta:', relevantCarrierIds);

  if (relevantCarrierIds.length === 0) {
    console.log('[FRIA] Ningun carrier fue contactado para esta ruta -- comparativa vacia.');
    return [];
  }

  const today = new Date().toISOString().slice(0, 10);
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  // Tarifarios vigentes de esos carriers en esta ruta/equipo
  const { data: rateCardsData, error: rateCardsError } = await supabase
    .from('rate_cards')
    .select('carrier_id, base_rate, valid_until')
    .in('carrier_id', relevantCarrierIds)
    .eq('equipment_type', equipmentType)
    .eq('is_active', true)
    .or(`valid_until.is.null,valid_until.gte.${today}`)
    .or(`origin_city.ilike.%${originCity}%,destination_city.ilike.%${destinationCity}%,origin_city.ilike.%${destinationCity}%,destination_city.ilike.%${originCity}%`);
  if (rateCardsError) console.error('[FRIA] Error en rate_cards:', rateCardsError);
  console.log('[FRIA] rate_cards encontrados:', rateCardsData);

  // Cotizaciones vendidas anteriores en esta ruta/equipo, ultimos 12 meses
  // (excluyendo la cotizacion recien creada, que todavia no tiene venta)
  const { data: historicalQuotes, error: historicalError } = await supabase
    .from('quotes')
    .select('id, sell_price, sell_currency, created_at, selected_rfq_id')
    .neq('id', quoteId)
    .eq('equipment_type', equipmentType)
    .ilike('origin_city', `%${originCity}%`)
    .ilike('destination_city', `%${destinationCity}%`)
    .gte('created_at', twelveMonthsAgo.toISOString())
    .not('sell_price', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);
  if (historicalError) console.error('[FRIA] Error en quotes historicos:', historicalError);
  console.log('[FRIA] cotizaciones vendidas encontradas:', historicalQuotes);

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

  const { data: carriersData, error: carriersError } = await supabase
    .from('carriers')
    .select('id, name')
    .in('id', relevantCarrierIds);
  if (carriersError) console.error('[FRIA] Error obteniendo nombres de carriers:', carriersError);
  const namesById = {};
  (carriersData || []).forEach(c => { namesById[c.id] = c.name; });

  // Tarifario mas barato por carrier
  const bestRateCardByCarrier = {};
  (rateCardsData || []).forEach(r => {
    const current = bestRateCardByCarrier[r.carrier_id];
    if (!current || Number(r.base_rate) < Number(current.base_rate)) {
      bestRateCardByCarrier[r.carrier_id] = r;
    }
  });

  // Cotizacion vendida mas reciente por carrier, solo de los carriers relevantes
  const bestHistoricalByCarrier = {};
  (historicalQuotes || []).forEach(q => {
    const carrierId = carrierByRfqId[q.selected_rfq_id];
    if (!carrierId || !relevantCarrierIds.includes(carrierId)) return;
    const current = bestHistoricalByCarrier[carrierId];
    if (!current || new Date(q.created_at) > new Date(current.created_at)) {
      bestHistoricalByCarrier[carrierId] = { ...q, carrier_id: carrierId };
    }
  });

  // Un renglon por CADA carrier contactado -- con precio si hay tarifario o
  // cotizacion anterior (tarifario manda), y sin precio si no hay ninguno.
  const result = relevantCarrierIds.map(carrierId => {
    const rateCard = bestRateCardByCarrier[carrierId];
    if (rateCard) {
      return {
        name: namesById[carrierId] || 'Carrier',
        price: Number(rateCard.base_rate),
        source: 'tarifario',
        detail: rateCard.valid_until ? `Tarifario · vigente hasta ${rateCard.valid_until}` : 'Tarifario de referencia',
      };
    }
    const historical = bestHistoricalByCarrier[carrierId];
    if (historical) {
      return {
        name: namesById[carrierId] || 'Carrier',
        price: Number(historical.sell_price),
        source: 'cotizacion_anterior',
        detail: `Sin tarifario · cotización anterior · ${timeAgo(historical.created_at)}`,
      };
    }
    return {
      name: namesById[carrierId] || 'Carrier',
      price: null,
      source: 'sin_datos',
      detail: 'Sin tarifa registrada · se solicitó al carrier',
    };
  }).sort((a, b) => {
    if (a.price == null && b.price == null) return 0;
    if (a.price == null) return 1; // sin datos siempre al final
    if (b.price == null) return -1;
    return a.price - b.price;
  });

  console.log('[FRIA] Comparativa final (un carrier por fila, incluye los sin tarifa):', result);
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
        ? await fetchComparison(normalized.id, normalized.origin_city, normalized.destination_city, normalized.equipment_type)
        : [];

      saveRFQ({
        id: rfqId, userName: user.name, userId: user.id, message, lane,
        timestamp: new Date().toISOString(), status: 'sent', hasAnalysis: comparison.some(c => c.price != null),
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
  sin_datos: { label: 'RFQ solicitado', bg: '#F5F5F5', color: 'var(--text-secondary)' },
};

function ComparativaView({ result, userEmail, onNewQuote, onSellQuote }) {
  const comparison = result.comparison || [];
  const winner = comparison.find(c => c.price != null);

  return (
    <div style={{ padding: '48px 56px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)',
        padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {result.lane || 'Solicitud enviada'}
          {result.normalized?.equipment_type && (
            <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
              {' · '}{result.normalized.equipment_type.replace(/_/g, ' ')}
            </span>
          )}
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
          No se identificaron carriers para esta ruta todavía. RFQ enviado — el análisis llegará a <strong>{userEmail}</strong> conforme respondan.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {comparison.map((c, i) => {
            const isWinner = i === 0 && c.price != null;
            const badge = SOURCE_BADGE[c.source];
            return (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '18px 22px', borderRadius: 'var(--radius-lg)',
                background: isWinner ? 'var(--success-bg)' : 'var(--bg-card)',
                border: `1px solid ${isWinner ? 'var(--success-text)' : 'var(--border-card)'}`,
                opacity: c.price == null ? 0.75 : 1,
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
                  {c.price != null ? `$${c.price.toLocaleString()}` : '—'}
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center' }}>
            Carriers que cubren esta ruta — con tarifario o cotización anterior donde existe, RFQ en vivo solicitado a los demás. El análisis con respuestas reales llegará a tu correo.
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
