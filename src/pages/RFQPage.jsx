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

// Espera a que n8n cree la fila en `quotes` (INSERT Quote1) con los campos
// ya normalizados por el LLM (origin_city/destination_city/equipment_type).
// Esto pasa temprano en el flujo -- justo despues de UNA llamada al LLM, no
// hace falta esperar a que termine todo el ciclo de contactar carriers.
async function fetchNormalizedQuote(rfqId) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error } = await supabase
      .from('quotes')
      .select('id, origin_city, destination_city, equipment_type')
      .eq('quote_number', rfqId)
      .maybeSingle();
    if (error) console.error('[FRIA] Error buscando quotes por quote_number:', error);
    console.log(`[FRIA] Intento ${attempt + 1}/8 buscando quote_number=${rfqId}:`, data);
    if (data) return data;
    await sleep(1500);
  }
  console.warn('[FRIA] No se encontró la fila en quotes después de 8 intentos (12s).');
  return null;
}

// Busca tarifarios y cotizaciones anteriores vendidas para esta ruta/equipo,
// SIN esperar a que termine el ciclo de contacto en vivo a carriers (eso es
// lo que lo hacia lento, y ademas no era confiable -- el webhook a veces
// responde antes de que ese ciclo termine). Esto solo depende de datos que
// YA existen en la base, por eso puede correr de inmediato.
async function fetchComparison(quoteId, originCity, destinationCity, equipmentType) {
  console.log('[FRIA] Buscando comparativa para:', { quoteId, originCity, destinationCity, equipmentType });

  const today = new Date().toISOString().slice(0, 10);
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  // Tarifarios vigentes en esta ruta/equipo -- match bidireccional AGRUPADO
  // EN PARES (origen+destino juntos), no 4 condiciones sueltas.
  const { data: rateCardsData, error: rateCardsError } = await supabase
    .from('rate_cards')
    .select('carrier_id, base_rate, valid_until')
    .eq('equipment_type', equipmentType)
    .eq('is_active', true)
    .or(`valid_until.is.null,valid_until.gte.${today}`)
    .or(`and(origin_city.ilike.%${originCity}%,destination_city.ilike.%${destinationCity}%),and(origin_city.ilike.%${destinationCity}%,destination_city.ilike.%${originCity}%)`)
    .limit(50);
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

  const allCarrierIds = new Set([
    ...(rateCardsData || []).map(r => r.carrier_id),
    ...Object.values(carrierByRfqId),
  ]);
  if (allCarrierIds.size === 0) {
    console.log('[FRIA] Sin tarifarios ni cotizaciones anteriores en esta ruta/equipo -- comparativa vacia.');
    return [];
  }

  const { data: carriersData, error: carriersError } = await supabase
    .from('carriers')
    .select('id, name')
    .in('id', [...allCarrierIds]);
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

  // Cotizacion vendida mas reciente por carrier
  const bestHistoricalByCarrier = {};
  (historicalQuotes || []).forEach(q => {
    const carrierId = carrierByRfqId[q.selected_rfq_id];
    if (!carrierId) return;
    const current = bestHistoricalByCarrier[carrierId];
    if (!current || new Date(q.created_at) > new Date(current.created_at)) {
      bestHistoricalByCarrier[carrierId] = { ...q, carrier_id: carrierId };
    }
  });

  // PRIORIDAD: el tarifario manda si existe para ese carrier. La cotizacion
  // anterior solo se usa si el carrier NO tiene tarifario.
  const result = [...allCarrierIds].map(carrierId => {
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
    return {
      name: namesById[carrierId] || 'Carrier',
      price: Number(historical.sell_price),
      source: 'cotizacion_anterior',
      detail: `Sin tarifario · cotización anterior · ${timeAgo(historical.created_at)}`,
    };
  }).sort((a, b) => a.price - b.price);

  console.log('[FRIA] Comparativa final (tarifario > cotización anterior, deduplicada por carrier):', result);
  return result;
}

export default function RFQPage({ user, onSellQuote, result, setResult }) {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
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
      // El RFQ real (correos a carriers) se manda sin esperarlo -- eso es lo
      // que hacia lenta la pantalla. Empezamos a buscar la fila normalizada
      // de inmediato, en paralelo, no despues de que termine todo el flujo.
      fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(res => {
        console.log('[FRIA] Webhook respondió, status:', res.status, '(rfqId enviado:', rfqId, ')');
      }).catch(e => {
        console.error('[FRIA] El webhook falló o no respondió:', e);
      });

      // Una vez que n8n normalizo origen/destino/equipo (el mismo LLM que usa
      // para el correo), leemos esa fila real y buscamos tarifarios/
      // cotizaciones anteriores -- sin esperar a que termine el envio en vivo.
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

  if (result) {
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
  const cheapest = comparison.find(c => c.price != null);

  function handleSellQuote(c) {
    if (!onSellQuote) return;
    onSellQuote({
      quoteNumber: result.rfqId,
      origin: result.normalized?.origin_city || '—',
      destination: result.normalized?.destination_city || '—',
      equipment: result.normalized?.equipment_type || null,
      carrierName: c.name,
      baseRate: c.price || 0,
      currency: 'MXN',
      validUntil: null,
      transitDays: null,
      quoteId: null,
      returnTo: 'rfq',
    });
  }

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
          Sin tarifarios ni cotizaciones anteriores en esta ruta. RFQ enviado a los carriers en vivo — el análisis llegará a <strong>{userEmail}</strong> conforme respondan.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {comparison.map((c, i) => {
            const isCheapest = c === cheapest;
            const badge = SOURCE_BADGE[c.source];
            return (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '18px 22px', borderRadius: 'var(--radius-lg)',
                background: isCheapest ? 'var(--success-bg)' : 'var(--bg-card)',
                border: `1px solid ${isCheapest ? 'var(--success-text)' : 'var(--border-card)'}`,
                opacity: c.price == null ? 0.75 : 1,
                gap: '16px',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '15px', fontWeight: isCheapest ? 700 : 600, color: 'var(--text-primary)' }}>
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
                    color: isCheapest ? 'var(--success-text)' : 'var(--text-secondary)',
                    fontWeight: isCheapest ? 600 : 400,
                  }}>
                    {isCheapest ? 'Más económica · ' : ''}{c.detail}
                  </div>
                </div>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: '19px', fontWeight: 700,
                  color: isCheapest ? 'var(--success-text)' : 'var(--text-tertiary)',
                }}>
                  {c.price != null ? `$${c.price.toLocaleString()}` : '—'}
                </div>
                {c.price != null && (
                  <button
                    onClick={() => handleSellQuote(c)}
                    style={{
                      height: '36px', padding: '0 16px', borderRadius: 'var(--radius-md)',
                      background: isCheapest ? 'var(--accent-primary)' : 'none',
                      border: isCheapest ? 'none' : '1px solid var(--border-input)',
                      color: isCheapest ? '#FFFFFF' : 'var(--text-primary)',
                      fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)',
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}
                  >
                    Armar venta →
                  </button>
                )}
              </div>
            );
          })}
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center' }}>
            Referencia de tarifarios y cotizaciones anteriores — elige el carrier con el que quieras armar la venta. El RFQ en vivo sigue en curso, el análisis con respuestas reales llegará a tu correo.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px' }}>
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
