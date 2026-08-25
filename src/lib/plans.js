// Fuente unica de verdad para los 4 planes de FRIA -- tanto la pantalla de
// Planes como la de Tenants leen de aqui, para que nunca queden
// desincronizados. Si cambian precios o limites, este es el unico archivo
// que hay que tocar del lado del frontend (el backend tiene su propia
// copia en api/admin/tenants.js, a proposito -- nunca hay que confiar en
// que el navegador mande los valores correctos, el servidor los vuelve a
// calcular el mismo).
//
// Informacion comercial oficial tomada del documento "Guia Comercial de
// Ventas y Estructura de Planes con SLA".
//
// IMPORTANTE: hoy en el codigo real, el UNICO acceso que de verdad se hace
// cumplir en la aplicacion es Inteligencia de Mercado (mi_plan). Chat y el
// logo/Terminos personalizados estan disponibles para cualquier tenant hoy,
// sin importar su plan -- featureChat y featureBranding se muestran en la
// pantalla de Planes como parte del paquete comercial, pero no bloquean
// nada todavia si un tenant de un plan inferior los usa. El limite de
// cotizaciones (quoteLimit) tampoco se hace cumplir todavia -- se guarda,
// listo para cuando se construya esa validacion.
//
// Definicion de "cotizacion" para el limite mensual: 1 solicitud que el
// usuario le hace a FRIA (1 fila en la tabla de cotizaciones) -- sin
// importar a cuantos carriers se les mando el RFQ por debajo, ni cuantos
// contestaron. Confirmado con Adolfo el 24 de agosto de 2026.
//
// El SLA (uptime, tiempo de respuesta de soporte) es un compromiso
// comercial/humano, no algo que la aplicacion pueda verificar o hacer
// cumplir por si sola -- vive aqui solo como referencia para mostrar en la
// pantalla de Planes.

export const PLAN_DEFINITIONS = {
  starter: {
    label: 'Starter',
    segment: 'Brokers independientes y agencias pequeñas',
    price: 2900,
    priceLabel: '$2,900 MXN / mes',
    priceAnnualLabel: '$29,000 MXN / año (ahórrate 2 meses)',
    userLimit: 3,
    quoteLimit: 100,
    quoteLimitLabel: '100 cotizaciones/mes',
    marketIntelligence: false,
    featureChat: false,
    featureBranding: false,
    included: ['Hasta 3 usuarios activos', '100 cotizaciones/mes', 'Conecta con tu correo', 'Historial y Tarifarios'],
    sla: { uptime: '99.0% mensual', response: '< 24 horas hábiles', channels: 'Correo electrónico' },
  },
  growth: {
    label: 'Growth',
    segment: 'Forwarders medianos en expansión',
    price: 6900,
    priceLabel: '$6,900 MXN / mes',
    priceAnnualLabel: '$69,000 MXN / año (ahórrate 2 meses)',
    userLimit: 8,
    quoteLimit: null,
    quoteLimitLabel: 'Cotizaciones ilimitadas',
    marketIntelligence: true,
    featureChat: true,
    featureBranding: true,
    featured: true,
    included: ['Hasta 8 usuarios activos', 'Cotizaciones ilimitadas', 'Todo lo de Starter', 'Inteligencia de Mercado + Índice FRAI', 'Chat con FRIA', 'Logo y T&C propios en PDF'],
    sla: { uptime: '99.5% mensual', response: '< 8 horas hábiles', channels: 'Correo electrónico y Chat en plataforma' },
  },
  pro: {
    label: 'Pro',
    segment: 'Forwarders consolidados y multi-sucursal',
    price: 13900,
    priceLabel: '$13,900 MXN / mes',
    priceAnnualLabel: '$139,000 MXN / año (ahórrate 2 meses)',
    userLimit: 20,
    quoteLimit: null,
    quoteLimitLabel: 'Cotizaciones ilimitadas',
    marketIntelligence: true,
    featureChat: true,
    featureBranding: true,
    included: ['Hasta 20 usuarios activos, con gestión de roles', 'Cotizaciones ilimitadas', 'Todo lo de Growth', 'Inteligencia de Mercado avanzada', 'Dashboard analítico por ejecutivo', 'Onboarding dedicado para el equipo de pricing'],
    sla: { uptime: '99.9% mensual', response: '< 4 horas hábiles', channels: 'Chat, correo, y WhatsApp corporativo' },
  },
  enterprise: {
    label: 'Enterprise',
    segment: 'Multinacionales, 3PLs masivos y brokers globales',
    price: null,
    priceLabel: 'Desde $35,000 MXN / mes',
    priceAnnualLabel: 'Desde $420,000 MXN / año',
    userLimit: null,
    quoteLimit: null,
    quoteLimitLabel: 'Cotizaciones ilimitadas',
    marketIntelligence: true,
    featureChat: true,
    featureBranding: true,
    included: ['Usuarios e infraestructura ilimitada', 'Todo lo de Pro', 'Integración API/Webhooks con TMS/ERP (CargoWise, SAP, Oracle)', 'Customer Success Manager dedicado'],
    sla: { uptime: '99.95% (garantizado por contrato, con créditos de servicio)', response: '< 1 hora, 24/7/365', channels: 'Atención dedicada 24/7, CSM, WhatsApp, y teléfono directo' },
  },
};

export const PLAN_ORDER = ['starter', 'growth', 'pro', 'enterprise'];
