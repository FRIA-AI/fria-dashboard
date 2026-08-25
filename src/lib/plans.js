// Fuente unica de verdad para los 4 planes de FRIA -- tanto la pantalla de
// Planes como la de Tenants leen de aqui, para que nunca queden
// desincronizados. Si cambian precios o limites, este es el unico archivo
// que hay que tocar del lado del frontend (el backend tiene su propia
// copia en api/admin/tenants.js, a proposito -- nunca hay que confiar en
// que el navegador mande los valores correctos, el servidor los vuelve a
// calcular el mismo).
//
// IMPORTANTE: hoy en el codigo real, el UNICO acceso que de verdad se hace
// cumplir en la aplicacion es Inteligencia de Mercado (mi_plan). Chat y el
// logo/Terminos personalizados estan disponibles para cualquier tenant hoy,
// sin importar su plan -- por eso featureChat y featureBranding se muestran
// en la pantalla de Planes como parte del paquete comercial, pero no
// bloquean nada todavia si un tenant de un plan inferior los usa.

export const PLAN_DEFINITIONS = {
  starter: {
    label: 'Starter',
    price: 2900,
    priceLabel: '$2,900 MXN / mes',
    userLimit: 3,
    quoteLimit: 100,
    quoteLimitLabel: '100 cotizaciones/mes',
    marketIntelligence: false,
    featureChat: false,
    featureBranding: false,
  },
  growth: {
    label: 'Growth',
    price: 6900,
    priceLabel: '$6,900 MXN / mes',
    userLimit: 8,
    quoteLimit: null,
    quoteLimitLabel: 'Cotizaciones ilimitadas',
    marketIntelligence: true,
    featureChat: true,
    featureBranding: true,
    featured: true,
  },
  pro: {
    label: 'Pro',
    price: 13900,
    priceLabel: '$13,900 MXN / mes',
    userLimit: 20,
    quoteLimit: null,
    quoteLimitLabel: 'Cotizaciones ilimitadas',
    marketIntelligence: true,
    featureChat: true,
    featureBranding: true,
  },
  enterprise: {
    label: 'Enterprise',
    price: null,
    priceLabel: 'A cotizar',
    userLimit: null,
    quoteLimit: null,
    quoteLimitLabel: 'Cotizaciones ilimitadas',
    marketIntelligence: true,
    featureChat: true,
    featureBranding: true,
  },
};

export const PLAN_ORDER = ['starter', 'growth', 'pro', 'enterprise'];
