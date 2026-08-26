import { Helmet } from 'react-helmet-async';

const SITE_URL = 'https://www.friaai.com';
const SITE_NAME = 'FRIA';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-cover.png`;

export default function SEO({ title, description, path, image, noindex }) {
  const fullTitle = title ? `${title} | FRIA` : 'FRIA — Freight Rate Intelligence';
  const url = `${SITE_URL}${path}`;
  const ogImage = image || DEFAULT_OG_IMAGE;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, follow" />}

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:locale" content="es_MX" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
}
