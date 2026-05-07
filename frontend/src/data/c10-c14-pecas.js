/**
 * Catálogo curado de peças comuns de Chevrolet C10 e C14.
 *
 * Usado pra:
 *   1. Sugestões/chips de busca rápida na tela inicial
 *   2. Referência semântica no prompt da IA vision (Fase 5)
 *   3. Tradução de termos regionais (sinônimos)
 *
 * Adicionar conforme aparecer mais peça relevante. Não é exaustivo.
 */

export const MODELOS = ['C10', 'C14', 'D10', 'A10', 'A20', 'C15', 'Outro'];

/* Categorias top-level — pra agrupar UI */
export const CATEGORIAS = [
  { id: 'motor',     nome: 'Motor',          icone: '🔧' },
  { id: 'embreagem', nome: 'Embreagem/Câmbio', icone: '⚙️' },
  { id: 'suspensao', nome: 'Suspensão',      icone: '🛞' },
  { id: 'freios',    nome: 'Freios',         icone: '🛑' },
  { id: 'eletrica',  nome: 'Elétrica',       icone: '⚡' },
  { id: 'lataria',   nome: 'Lataria',        icone: '🚛' },
  { id: 'interior',  nome: 'Interior',       icone: '🪑' },
  { id: 'iluminacao',nome: 'Iluminação',     icone: '💡' },
];

/**
 * Peças comuns. Cada item:
 *   nome:        nome principal (PT-BR)
 *   sinonimos:   variantes regionais / formais / informais
 *   categoria:   id da categoria
 *   c10:         compatível C10
 *   c14:         compatível C14
 *   palavras:    keywords pra busca em marketplaces
 */
export const PECAS = [
  /* === Motor === */
  { nome: 'Kit motor completo',  sinonimos: ['retífica motor', 'kit retífica'],
    categoria: 'motor', c10: true, c14: true,
    palavras: ['kit motor', 'retifica motor', 'C10', 'C14'] },
  { nome: 'Carburador',          sinonimos: ['carbu'],
    categoria: 'motor', c10: true, c14: true,
    palavras: ['carburador', 'C10', 'opala', 'gasolina'] },
  { nome: 'Bomba dágua',         sinonimos: ['bomba de água', 'bomba d\'água'],
    categoria: 'motor', c10: true, c14: true,
    palavras: ['bomba dagua', 'bomba agua C10'] },
  { nome: 'Cabeçote',             sinonimos: [],
    categoria: 'motor', c10: true, c14: true,
    palavras: ['cabeçote C10', 'cabecote chevrolet 6 cilindros'] },
  { nome: 'Coletor de admissão',  sinonimos: ['coletor admissao'],
    categoria: 'motor', c10: true, c14: true,
    palavras: ['coletor admissão C10', 'coletor admissao chevrolet'] },
  { nome: 'Radiador',             sinonimos: [],
    categoria: 'motor', c10: true, c14: true,
    palavras: ['radiador C10', 'radiador C14'] },

  /* === Embreagem/Câmbio === */
  { nome: 'Kit embreagem',        sinonimos: ['embreagem completa'],
    categoria: 'embreagem', c10: true, c14: true,
    palavras: ['embreagem C10', 'kit embreagem chevrolet'] },
  { nome: 'Câmbio',               sinonimos: ['caixa de marcha', 'caixa cambio'],
    categoria: 'embreagem', c10: true, c14: true,
    palavras: ['câmbio C10', 'cambio chevrolet 4 marchas'] },

  /* === Suspensão === */
  { nome: 'Amortecedor dianteiro', sinonimos: [],
    categoria: 'suspensao', c10: true, c14: true,
    palavras: ['amortecedor dianteiro C10', 'amortecedor C14'] },
  { nome: 'Mola dianteira',       sinonimos: [],
    categoria: 'suspensao', c10: true, c14: true,
    palavras: ['mola dianteira C10', 'feixe mola C14'] },
  { nome: 'Bandeja',              sinonimos: ['braço da suspensão'],
    categoria: 'suspensao', c10: true, c14: true,
    palavras: ['bandeja C10', 'braço suspensão chevrolet'] },

  /* === Freios === */
  { nome: 'Pastilha de freio',    sinonimos: [],
    categoria: 'freios', c10: true, c14: true,
    palavras: ['pastilha freio C10'] },
  { nome: 'Disco de freio',       sinonimos: [],
    categoria: 'freios', c10: true, c14: true,
    palavras: ['disco freio C10'] },
  { nome: 'Cilindro mestre',      sinonimos: ['cilindro de freio'],
    categoria: 'freios', c10: true, c14: true,
    palavras: ['cilindro mestre C10', 'cilindro freio chevrolet'] },

  /* === Elétrica === */
  { nome: 'Alternador',           sinonimos: [],
    categoria: 'eletrica', c10: true, c14: true,
    palavras: ['alternador C10', 'alternador chevrolet 6 cilindros'] },
  { nome: 'Motor de partida',     sinonimos: ['arranque', 'motor arranque'],
    categoria: 'eletrica', c10: true, c14: true,
    palavras: ['motor de partida C10', 'arranque chevrolet'] },
  { nome: 'Distribuidor',         sinonimos: ['ignição'],
    categoria: 'eletrica', c10: true, c14: true,
    palavras: ['distribuidor C10', 'distribuidor ignição chevrolet'] },
  { nome: 'Bateria',              sinonimos: [],
    categoria: 'eletrica', c10: true, c14: true,
    palavras: ['bateria 60ah', 'bateria caminhonete'] },

  /* === Lataria === */
  { nome: 'Para-choque dianteiro', sinonimos: ['parachoque'],
    categoria: 'lataria', c10: true, c14: true,
    palavras: ['para-choque dianteiro C10', 'parachoque C14'] },
  { nome: 'Para-choque traseiro',  sinonimos: [],
    categoria: 'lataria', c10: true, c14: true,
    palavras: ['parachoque traseiro C10'] },
  { nome: 'Capô',                 sinonimos: ['capot'],
    categoria: 'lataria', c10: true, c14: true,
    palavras: ['capô C10', 'capo chevrolet caminhonete'] },
  { nome: 'Porta',                sinonimos: [],
    categoria: 'lataria', c10: true, c14: true,
    palavras: ['porta C10', 'porta C14'] },
  { nome: 'Para-lama',            sinonimos: ['paralama'],
    categoria: 'lataria', c10: true, c14: true,
    palavras: ['para-lama C10', 'paralama dianteiro chevrolet'] },
  { nome: 'Caçamba',              sinonimos: ['carroceria'],
    categoria: 'lataria', c10: true, c14: true,
    palavras: ['caçamba C10', 'caçamba C14', 'carroceria chevrolet caminhonete'] },
  { nome: 'Tampa traseira',       sinonimos: ['tampa caçamba', 'porta-malas'],
    categoria: 'lataria', c10: true, c14: true,
    palavras: ['tampa traseira C10', 'tampa caçamba C14'] },
  { nome: 'Grade frontal',        sinonimos: ['grade dianteira'],
    categoria: 'lataria', c10: true, c14: true,
    palavras: ['grade frontal C10', 'grade dianteira C14'] },

  /* === Interior === */
  { nome: 'Painel de instrumentos', sinonimos: ['painel'],
    categoria: 'interior', c10: true, c14: true,
    palavras: ['painel C10', 'painel C14'] },
  { nome: 'Banco',                sinonimos: ['banco dianteiro', 'estofado'],
    categoria: 'interior', c10: true, c14: true,
    palavras: ['banco C10', 'banco C14', 'estofado caminhonete chevrolet'] },
  { nome: 'Volante',              sinonimos: [],
    categoria: 'interior', c10: true, c14: true,
    palavras: ['volante C10', 'volante chevrolet caminhonete'] },

  /* === Iluminação === */
  { nome: 'Farol',                sinonimos: ['faróis'],
    categoria: 'iluminacao', c10: true, c14: true,
    palavras: ['farol C10', 'farol C14'] },
  { nome: 'Lanterna traseira',    sinonimos: [],
    categoria: 'iluminacao', c10: true, c14: true,
    palavras: ['lanterna traseira C10', 'lanterna C14'] },
  { nome: 'Lanterna dianteira',   sinonimos: ['pisca', 'seta'],
    categoria: 'iluminacao', c10: true, c14: true,
    palavras: ['lanterna dianteira C10', 'pisca C10'] },
];

/* Atalhos pré-prontos — chips na home */
export const BUSCAS_RAPIDAS = [
  { label: 'Kit motor C10',       q: 'kit motor C10',       modelo: 'C10' },
  { label: 'Para-choque C10',     q: 'para-choque C10',     modelo: 'C10' },
  { label: 'Caçamba C14',         q: 'caçamba C14',         modelo: 'C14' },
  { label: 'Grade frontal C10',   q: 'grade frontal C10',   modelo: 'C10' },
  { label: 'Painel C10',          q: 'painel C10',          modelo: 'C10' },
  { label: 'Farol C10',           q: 'farol C10',           modelo: 'C10' },
];
