// Consulta la fila más reciente de frai_index_values para una ruta+equipo.
// Usa la MISMA función normalize_city() de Postgres que ya usa el workflow
// de cálculo de FRAI, vía RPC -- así el match nunca se desalinea aunque el
// origin/destination venga en mayúsculas, con acentos, etc.
export async function fetchMarketRate(supabase, originCity, destinationCity, equipmentType) {
  if (!originCity || !destinationCity || !equipmentType) return null;

  const [{ data: normOrigin }, { data: normDest }] = await Promise.all([
    supabase.rpc('normalize_city', { input: originCity }),
    supabase.rpc('normalize_city', { input: destinationCity }),
  ]);
  if (!normOrigin || !normDest) return null;

  const { data, error } = await supabase
    .from('frai_index_values')
    .select('frai_value, projection_low, projection_high, sources, created_at')
    .eq('origin_city', normOrigin)
    .eq('destination_city', normDest)
    .eq('equipment_type', equipmentType)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) { console.error('[FRIA] Error consultando frai_index_values:', error); return null; }
  return data;
}

// % de diferencia de un precio contra la mediana de mercado. Positivo =
// arriba del mercado, negativo = abajo.
export function pctVsMarket(price, marketValue) {
  if (price == null || !marketValue) return null;
  return ((Number(price) / Number(marketValue)) - 1) * 100;
}
