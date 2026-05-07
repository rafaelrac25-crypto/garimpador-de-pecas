/**
 * Filtro pós-processamento — descarta resultados de outros modelos quando
 * a busca é por C10/C14 (família caminhonete clássica Chevrolet).
 *
 * Regras:
 * 1) REJEITA se o título cita modelo conhecido de outra plataforma
 *    (Nissan, Honda, VW, Chevrolet moderno, etc).
 * 2) ACEITA se cita explicitamente família C10/C14/D10/Bonanza/Veraneio/etc.
 * 3) ACEITA peça genérica que não menciona modelo (carburador, junta, etc).
 *
 * Tokenização por palavras (word boundaries) — evita matches parciais
 * tipo "punto" dentro de "apontou".
 */

/* Família que aceita explicitamente — caminhonete Chevrolet 1964-1986
   (mesma plataforma mecânica do C10/C14 do Costa) */
const FAMILIA_C10_C14 = [
  'c10', 'c-10', 'c14', 'c-14', 'c15', 'c-15',
  'd10', 'd-10', 'd20', 'd-20',
  'a10', 'a-10', 'a20', 'a-20',
  'bonanza', 'veraneio', 'veraneo',
  'opala', 'caravan',  // mecânica 6cc 4.1 compartilhada
  'brasinca',
];

/* Modelos de OUTRAS plataformas — se aparecer no título, descarta */
const OUTROS_MODELOS = [
  // Nissan
  'livina', 'march', 'versa', 'sentra', 'tiida', 'frontier', 'kicks', 'leaf', 'altima',
  // Honda
  'civic', 'fit', 'city', 'hrv', 'hr-v', 'crv', 'cr-v', 'wrv', 'wr-v',
  // VW
  'gol', 'polo', 'voyage', 'saveiro', 'fox', 'virtus', 'nivus', 'tiguan', 'jetta',
  'passat', 'amarok', 't-cross', 'tcross', 'taos',
  // Chevrolet moderno (plataforma DIFERENTE do C10/C14 antigo)
  's10', 's-10', 'onix', 'prisma', 'cruze', 'tracker', 'equinox', 'cobalt',
  'spin', 'trailblazer', 'montana', 'astra', 'vectra', 'corsa', 'celta',
  'classic', 'agile', 'captiva', 'camaro', 'meriva', 'zafira', 'kadett',
  // Toyota
  'hilux', 'corolla', 'etios', 'yaris', 'rav4', 'sw4', 'camry', 'prius', 'bandeirante',
  // Fiat
  'strada', 'toro', 'argo', 'mobi', 'cronos', 'uno', 'palio', 'doblo',
  'punto', 'linea', 'bravo', 'idea', 'siena', 'fiorino', 'ducato',
  // Renault
  'sandero', 'logan', 'duster', 'kwid', 'stepway', 'captur', 'megane',
  'kangoo', 'master', 'oroch',
  // Jeep
  'compass', 'renegade', 'cherokee', 'wrangler', 'commander', 'gladiator',
  // Hyundai
  'hb20', 'creta', 'tucson', 'ix35', 'azera', 'sonata', 'i30', 'elantra', 'veloster',
  // Ford
  'ka', 'fiesta', 'focus', 'ecosport', 'fusion', 'ranger', 'edge', 'territory',
  'bronco', 'maverick', 'mustang', 'fiesta',
  // Mitsubishi
  'l200', 'asx', 'pajero', 'outlander', 'eclipse', 'lancer', 'airtrek',
  // Peugeot
  '208', '2008', '3008', '308', '408', 'partner', '207', '307', '407',
  // Citroen
  'aircross', 'berlingo',  // 'c3', 'c4' colidem com C10? não, são tokens distintos
  // Suzuki
  'jimny', 'vitara', 's-cross', 'swift',
  // Kia
  'picanto', 'sportage', 'sorento', 'soul', 'cerato', 'rio', 'cadenza',
  // Chery
  'tiggo', 'arrizo',
  // BYD
  'dolphin', 'song', 'yuan',
  // Caminhão moderno (não cruza)
  'scania', 'volvo fh', 'volvo fm', 'iveco', 'mb axor', 'mb actros',
];

function tokenize(title) {
  return String(title || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    /* Mantém hífens dentro de tokens (c-10, hr-v) — separa só por espaço/pontuação */
    .replace(/[^a-z0-9-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function hasFamily(tokens) {
  return tokens.some(t => FAMILIA_C10_C14.includes(t));
}

function hasOtherModel(tokens) {
  return tokens.some(t => OUTROS_MODELOS.includes(t));
}

/**
 * Filtra um array de resultados removendo os que claramente não pertencem
 * à plataforma C10/C14. Usado quando `modelo` é 'C10' ou 'C14'.
 *
 * @param {Array} results
 * @param {string|null} modelo  ex: 'C10', 'C14', null (não filtra)
 * @returns {{ kept: Array, removed: number }}
 */
function filter(results, modelo) {
  if (!modelo) return { kept: results, removed: 0 };
  const m = String(modelo).toLowerCase();
  if (m !== 'c10' && m !== 'c14' && m !== 'c-10' && m !== 'c-14') {
    return { kept: results, removed: 0 };
  }
  const kept = [];
  let removed = 0;
  for (const r of results) {
    const tokens = tokenize(r.title);
    const family = hasFamily(tokens);
    const other  = hasOtherModel(tokens);
    /* Se cita família E outro modelo (ex: "kit junção C10/Hilux"), aceita */
    if (other && !family) { removed++; continue; }
    kept.push(r);
  }
  return { kept, removed };
}

module.exports = { filter, tokenize, hasFamily, hasOtherModel, FAMILIA_C10_C14, OUTROS_MODELOS };
