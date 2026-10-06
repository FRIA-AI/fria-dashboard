import { createHash, timingSafeEqual } from 'node:crypto';

// Verifica el secreto interno (header x-fria-secret) con el que n8n llama a
// los endpoints protegidos de FRIA.
//
// Dos cosas que el "!==" de antes no hacia:
// 1. Comparacion en tiempo constante: "!==" se detiene en el primer caracter
//    distinto, y con muchas pruebas eso permite ir adivinando el secreto por
//    los tiempos de respuesta. Aqui ambos lados se pasan por SHA-256 (asi
//    miden lo mismo siempre) y se comparan con timingSafeEqual.
// 2. Falla cerrado: si FRIA_INTERNAL_SECRET no esta configurado en el
//    servidor, antes "undefined !== undefined" daba false y una peticion SIN
//    header pasaba como autorizada. Ahora, sin secreto configurado, nadie pasa.
export function hasValidInternalSecret(req) {
  const expected = process.env.FRIA_INTERNAL_SECRET;
  const provided = req.headers['x-fria-secret'];

  if (!expected || typeof provided !== 'string' || provided.length === 0) return false;

  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}
