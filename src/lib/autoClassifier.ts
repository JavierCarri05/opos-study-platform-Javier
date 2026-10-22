import { Topic, TopicClassificationRules } from './types';

export interface ClassificationResult {
  topic: Topic;
  confidence: 'high' | 'medium';
  score: number;
  matchedTerms: string[];
  reason: string;
  runnerUp?: {
    topic: Topic;
    score: number;
  } | null;
  allScores?: {
    topic: Topic;
    score: number;
    matchedTerms: string[];
  }[];
}

// Clave para almacenamiento en localStorage (fallback inmediato sin esperar migraciones SQL)
export const TOPIC_RULES_LOCAL_STORAGE_KEY = 'opos_topic_classification_rules';

// Lista de palabras vacías (stopwords) en español para no computar términos genéricos
export const SPANISH_STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'u', 'e',
  'de', 'del', 'a', 'al', 'en', 'con', 'por', 'para', 'sobre', 'entre', 'tras',
  'sin', 'segun', 'hacia', 'contra', 'desde', 'hasta', 'durante', 'mediante',
  'que', 'se', 'lo', 'le', 'les', 'su', 'sus', 'mi', 'mis', 'tu', 'tus',
  'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'aquel', 'aquella',
  'aquellos', 'aquellas', 'todo', 'toda', 'todos', 'todas', 'otro', 'otra', 'otros', 'otras',
  'como', 'cuando', 'donde', 'quien', 'quienes', 'cual', 'cuales', 'mas', 'menos',
  'pero', 'sino', 'ser', 'estar', 'haber', 'hay', 'fue', 'sido', 'tiene', 'tienen',
  'tener', 'son', 'era', 'eran', 'esta', 'estan', 'sera', 'seran', 'sea', 'sean',
  'articulo', 'articulos', 'art', 'arts', 'parrafo', 'letra', 'numero', 'ley', 'leyes',
  'real', 'decreto', 'acuerdo', 'texto', 'punto', 'pregunta', 'opcion', 'opciones',
  'senale', 'indique', 'correcta', 'incorrecta', 'respuesta', 'respuestas',
  'relacion', 'respecto', 'conformidad', 'dispuesto', 'terminos', 'sentido',
  'general', 'generales', 'titulo', 'capitulo', 'seccion', 'norma', 'normativa',
  'principio', 'principios', 'caso', 'forma', 'manera', 'modo', 'bien', 'solo',
  'cada', 'ambas', 'ninguna', 'todas', 'anterior', 'anteriores', 'siguiente', 'siguientes'
]);

/**
 * Normaliza una cadena de texto (sin acentos, en minúsculas, espacios colapsados)
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
    .replace(/[^a-z0-9\/\s\-]/g, ' ') // Mantener letras, números, barras (para 39/2015) y guiones
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrae tokens significativos (palabras >= 4 letras que no sean stopwords)
 */
export function extractSignificantTokens(text: string): string[] {
  const norm = normalizeText(text);
  const words = norm.split(' ');
  const tokens: string[] = [];

  for (const w of words) {
    const cleanWord = w.replace(/^[^\w]+|[^\w]+$/g, '');
    if (cleanWord.length >= 4 && !SPANISH_STOPWORDS.has(cleanWord)) {
      tokens.push(cleanWord);
    }
  }

  return Array.from(new Set(tokens));
}

/**
 * Obtiene el mapa de reglas guardado en localStorage
 */
export function getStoredTopicRules(): Record<string, TopicClassificationRules> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(TOPIC_RULES_LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Guarda el mapa de reglas en localStorage
 */
export function saveStoredTopicRules(rulesMap: Record<string, TopicClassificationRules>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TOPIC_RULES_LOCAL_STORAGE_KEY, JSON.stringify(rulesMap));
  } catch (e) {
    console.error('Error al guardar reglas en localStorage:', e);
  }
}

/**
 * Obtiene las reglas activas de un tema (prioriza Supabase, luego localStorage, y fallback a sugerencias automáticas)
 */
export function getTopicRules(topic: Topic): TopicClassificationRules {
  if (topic.classification_rules && (
    (topic.classification_rules.keywords && topic.classification_rules.keywords.length > 0) ||
    (topic.classification_rules.laws && topic.classification_rules.laws.length > 0) ||
    (topic.classification_rules.negativeWords && topic.classification_rules.negativeWords.length > 0)
  )) {
    return topic.classification_rules;
  }

  const stored = getStoredTopicRules();
  const topicStored = stored[topic.id];
  if (topicStored && (
    (topicStored.keywords && topicStored.keywords.length > 0) ||
    (topicStored.laws && topicStored.laws.length > 0) ||
    (topicStored.negativeWords && topicStored.negativeWords.length > 0)
  )) {
    return topicStored;
  }

  // AUTO-DETECCIÓN INTELIGENTE: si no hay reglas explícitas guardadas, extraer automáticamente
  // las leyes y términos del título del tema (ej: "L 39/2015", "LRBRL 7/85", "TREBEP", etc.)
  return generateSuggestedRulesForTopic(topic);
}

/**
 * Guarda las reglas de un tema en localStorage y trata de persistir en Supabase
 */
export async function saveTopicRules(
  supabase: any,
  topicId: string,
  rules: TopicClassificationRules
): Promise<{ syncedToDb: boolean; error?: string }> {
  // 1. Guardar en localStorage siempre (para disponibilidad inmediata sin fallos)
  const currentMap = getStoredTopicRules();
  currentMap[topicId] = rules;
  saveStoredTopicRules(currentMap);

  // 2. Intentar guardar en Supabase
  try {
    const { error } = await supabase
      .from('topics')
      .update({ classification_rules: rules })
      .eq('id', topicId);

    if (error) {
      console.warn('No se pudo guardar classification_rules en Supabase (puede que falte la columna):', error.message);
      return { syncedToDb: false, error: error.message };
    }
    return { syncedToDb: true };
  } catch (err: any) {
    return { syncedToDb: false, error: err?.message || 'Error de conexión' };
  }
}

/**
 * Genera sugerencias inteligentes iniciales para un tema a partir de su título,
 * descripción y subapartados, extrayendo leyes conocidas y conceptos clave.
 */
export function generateSuggestedRulesForTopic(topic: Topic): TopicClassificationRules {
  const normTitle = normalizeText(topic.title || '');
  const normDesc = normalizeText(topic.description || '');
  const subNorms = (topic.subtopics || []).map(s => normalizeText(s.title || ''));
  const combined = `${normTitle} ${normDesc} ${subNorms.join(' ')}`;

  const laws = new Set<string>();
  const keywords = new Set<string>();

  // 1. Detección de leyes por formato numérico (ej: 39/2015, 7/1985, 7/85, 4/85, 9/2017)
  const lawMatches = combined.match(/\b\d{1,4}\/\d{2,4}\b/g);
  if (lawMatches) {
    lawMatches.forEach(l => {
      laws.add(l);
      extractLawVariants(l).forEach(v => laws.add(v));
    });
  }

  // 2. Detección de leyes y normas clásicas españolas
  const knownLawsCatalog: { key: string; label: string; triggers: string[] }[] = [
    { key: 'ce', label: 'ce 1978', triggers: ['constitucion', 'constitucional', 'corona', 'cortes generales', 'ce 1978', 'ce'] },
    { key: '39/2015', label: '39/2015', triggers: ['procedimiento administrativo', 'acto administrativo', 'lapac', '39/2015', '39/15', 'l 39/2015', 'ley 39/2015'] },
    { key: '40/2015', label: '40/2015', triggers: ['regimen juridico', 'sector publico', 'lrjsp', '40/2015', '40/15', 'l 40/2015', 'ley 40/2015', 'organos colegiados'] },
    { key: '7/1985', label: '7/1985', triggers: ['regimen local', 'bases del regimen local', 'municipio', 'provincia', 'lbrl', 'lrbrl', '7/1985', '7/85', '4/85', 'l 7/1985', 'ley 7/1985'] },
    { key: 'trebep', label: 'trebep', triggers: ['empleado publico', 'funcion publica', 'estatuto basico', 'trebep', 'ebep', '5/2015', '5/15', 'rdleg 5/2015'] },
    { key: '9/2017', label: '9/2017', triggers: ['contratos', 'contratacion', 'sector publico', 'lcsp', '9/2017', '9/17', 'ley 9/2017', 'l 9/2017'] },
    { key: 'trlrhl', label: 'trlrhl', triggers: ['haciendas locales', 'hacienda local', 'presupuesto local', 'tributos locales', '2/2004', '2/04', 'trlrhl'] },
    { key: '2/1986', label: '2/1986', triggers: ['fuerzas y cuerpos', 'seguridad ciudadana', 'policia local', '2/1986', 'lo 2/1986'] },
    { key: '3/2018', label: '3/2018', triggers: ['proteccion de datos', 'lopd', 'lopdgdd', 'garantia de derechos digitales', '3/2018', '3/18'] },
    { key: '19/2013', label: '19/2013', triggers: ['transparencia', 'buen gobierno', 'acceso a la informacion', '19/2013'] },
    { key: 'rd 1372/1986', label: 'rd 1372/1986', triggers: ['bienes de las entidades locales', 'patrimonio municipal', 'rbel', '1372/1986'] },
    { key: 'rd 2568/1986', label: 'rd 2568/1986', triggers: ['organizacion funcionamiento y regimen juridico', 'rofas', 'rofrj', 'rop', 'rof', '2568/1986'] },
    { key: '29/1998', label: '29/1998', triggers: ['contencioso administrativo', 'ljca', '29/1998'] },
    { key: '31/1995', label: '31/1995', triggers: ['prevencion de riesgos', 'lprl', '31/1995'] },
    { key: '50/1997', label: '50/1997', triggers: ['ley del gobierno', '50/1997'] },
    { key: '53/1984', label: '53/1984', triggers: ['incompatibilidades', '53/1984'] }
  ];

  for (const item of knownLawsCatalog) {
    if (item.triggers.some(tr => combined.includes(tr))) {
      laws.add(item.label);
      extractLawVariants(item.label).forEach(v => laws.add(v));
    }
  }

  // 3. Extracción de frases compuestas del título y subtemas
  const titleWords = normTitle.split(' ').filter(w => !SPANISH_STOPWORDS.has(w) && w.length >= 3 && !['tema', 'bloque'].includes(w));
  for (let i = 0; i < titleWords.length - 1; i++) {
    const pair = `${titleWords[i]} ${titleWords[i + 1]}`;
    if (pair.length >= 7) keywords.add(pair);
  }

  for (const s of topic.subtopics || []) {
    const sNorm = normalizeText(s.title || '');
    if (sNorm && sNorm !== 'general' && sNorm.length >= 5) {
      if (sNorm.length <= 35) {
        keywords.add(sNorm);
      } else {
        const subWords = sNorm.split(' ').filter(w => !SPANISH_STOPWORDS.has(w) && w.length >= 3);
        if (subWords.length >= 2) {
          keywords.add(`${subWords[0]} ${subWords[1]}`);
        }
      }
    }
  }

  // 4. Extracción de tokens significativos
  const tokens = extractSignificantTokens(normTitle);
  tokens.slice(0, 8).forEach(t => keywords.add(t));

  return {
    laws: Array.from(laws),
    keywords: Array.from(keywords).slice(0, 15),
    negativeWords: []
  };
}

/**
 * Catálogo de dominios legales por defecto (respaldo cuando un tema no tiene reglas configuradas)
 */
const DEFAULT_LEGAL_DOMAINS: { triggers: string[]; laws: string[]; phrases: string[] }[] = [
  {
    triggers: ['constitucion', 'constitucional', 'corona', 'cortes generales', 'poder judicial', 'derechos fundamentales', 'ce 1978', 'ce'],
    laws: ['ce 1978', 'ce', 'constitucion'],
    phrases: ['constitucion espanola', 'defensor del pueblo', 'tribunal constitucional', 'recurso de amparo', 'cortes generales', 'poder judicial']
  },
  {
    triggers: ['procedimiento administrativo', 'acto administrativo', 'recursos administrativos', 'ley 39/2015', 'l 39/2015', '39/2015', '39/15', 'lapac'],
    laws: ['39/2015', 'lapac', 'ley 39/2015'],
    phrases: ['procedimiento administrativo comun', 'acto administrativo', 'silencio administrativo', 'recurso de alzada', 'nulidad de pleno derecho', 'interesado']
  },
  {
    triggers: ['regimen juridico', 'sector publico', 'ley 40/2015', 'l 40/2015', '40/2015', '40/15', 'lrjsp'],
    laws: ['40/2015', 'lrjsp', 'ley 40/2015'],
    phrases: ['regimen juridico del sector publico', 'organos colegiados', 'potestad sancionadora', 'responsabilidad patrimonial']
  },
  {
    triggers: ['regimen local', 'bases del regimen local', 'municipio', 'provincia', 'ayuntamiento', 'alcalde', 'ley 7/1985', 'l 7/1985', '7/1985', '7/85', '4/85', 'lrbrl', 'lbrl'],
    laws: ['7/1985', '7/85', 'lrbrl', 'lbrl', 'ley 7/1985'],
    phrases: ['bases del regimen local', 'pleno del ayuntamiento', 'junta de gobierno local', 'competencias municipales', 'empadronamiento']
  },
  {
    triggers: ['empleado publico', 'funcion publica', 'trebep', 'ebep', 'personal al servicio', 'estatuto basico', '5/2015', '5/15'],
    laws: ['trebep', 'ebep', '5/2015'],
    phrases: ['empleados publicos', 'funcionarios de carrera', 'personal laboral', 'situaciones administrativas', 'regimen disciplinario']
  },
  {
    triggers: ['contratos', 'contratacion', 'sector publico', 'ley 9/2017', 'lcsp', '9/2017', '9/17'],
    laws: ['9/2017', 'lcsp', 'ley 9/2017'],
    phrases: ['contratos del sector publico', 'contrato de obras', 'contrato de servicios', 'contrato menor', 'adjudicacion']
  },
  {
    triggers: ['hacienda local', 'presupuesto', 'tributario', 'tributos', 'financiero', 'trlrhl', '2/2004'],
    laws: ['trlrhl', '2/2004'],
    phrases: ['haciendas locales', 'presupuesto municipal', 'ibi', 'iae', 'tasas y precios publicos']
  }
];

const GENERIC_EXPLANATIONS = [
  'conforme a la plantilla oficial de respuestas',
  'conforme a la plantilla oficial',
  'conforme a la plantilla',
  'conforme a la normativa oficial',
  'conforme a la normativa vigente',
  'conforme a la legislacion vigente',
  'segun plantilla',
  'sin explicacion',
  'sin justificacion'
];

export function isRealExplanation(text: string): boolean {
  if (!text) return false;
  const norm = normalizeText(text);
  if (norm.length < 6) return false;
  for (const gen of GENERIC_EXPLANATIONS) {
    if (norm === gen || (norm.includes(gen) && norm.length <= gen.length + 10)) {
      return false;
    }
  }
  return true;
}

export function extractLawVariants(law: string): string[] {
  const norm = normalizeText(law);
  const variants = new Set<string>();
  if (norm.length >= 2) variants.add(norm);

  // Extraer número de ley tipo "39/2015", "7/1985", "7/85", "4/85"
  const numMatch = norm.match(/\b\d{1,4}\/\d{2,4}\b/);
  if (numMatch) {
    variants.add(numMatch[0]);
    const parts = numMatch[0].split('/');
    if (parts[1].length === 4) {
      variants.add(`${parts[0]}/${parts[1].slice(2)}`);
    } else if (parts[1].length === 2) {
      variants.add(`${parts[0]}/19${parts[1]}`);
      variants.add(`${parts[0]}/20${parts[1]}`);
    }
  }

  // Abreviaturas y equivalencias legales clásicas
  if (norm.includes('constitucion') || norm === 'ce' || norm === 'ce 1978') {
    variants.add('constitucion');
    variants.add('ce');
    variants.add('ce 1978');
    variants.add('constitucion espanola');
  }
  if (norm.includes('trebep') || norm.includes('ebep') || norm.includes('5/2015') || norm === '5/15') {
    variants.add('trebep');
    variants.add('ebep');
    variants.add('5/2015');
    variants.add('estatuto basico');
  }
  if (norm.includes('lapac') || norm.includes('39/2015') || norm.includes('39/15') || norm.includes('l 39/2015') || norm.includes('ley 39/2015')) {
    variants.add('39/2015');
    variants.add('39/15');
    variants.add('lapac');
    variants.add('ley 39/2015');
    variants.add('l 39/2015');
    variants.add('procedimiento administrativo');
  }
  if (norm.includes('lrjsp') || norm.includes('40/2015') || norm.includes('40/15') || norm.includes('l 40/2015') || norm.includes('ley 40/2015')) {
    variants.add('40/2015');
    variants.add('40/15');
    variants.add('lrjsp');
    variants.add('ley 40/2015');
    variants.add('l 40/2015');
    variants.add('regimen juridico');
  }
  if (norm.includes('lrbrl') || norm.includes('lbrl') || norm.includes('7/1985') || norm.includes('7/85') || norm.includes('4/85')) {
    variants.add('7/1985');
    variants.add('7/85');
    variants.add('lbrl');
    variants.add('lrbrl');
    variants.add('ley 7/1985');
    variants.add('l 7/1985');
    variants.add('bases del regimen local');
    variants.add('regimen local');
  }
  if (norm.includes('lcsp') || norm.includes('9/2017') || norm.includes('9/17') || norm.includes('ley 9/2017')) {
    variants.add('9/2017');
    variants.add('9/17');
    variants.add('lcsp');
    variants.add('ley 9/2017');
    variants.add('l 9/2017');
    variants.add('contratos del sector publico');
  }
  if (norm.includes('trlrhl') || norm.includes('2/2004') || norm.includes('2/04')) {
    variants.add('trlrhl');
    variants.add('2/2004');
    variants.add('2/04');
    variants.add('haciendas locales');
    variants.add('hacienda local');
  }
  if (norm.includes('lopd') || norm.includes('3/2018') || norm.includes('3/18')) {
    variants.add('3/2018');
    variants.add('3/18');
    variants.add('lopd');
    variants.add('lopdgdd');
    variants.add('proteccion de datos');
  }

  return Array.from(variants);
}

export function classifyQuestionByKeywords(
  question: {
    question_text: string;
    explanation?: string;
    options?: string[];
  },
  topics: Topic[]
): ClassificationResult | null {
  if (!question || !question.question_text || !topics || topics.length === 0) {
    return null;
  }

  const rawExp = question.explanation || '';
  const qExpNorm = normalizeText(rawExp);
  const qTextNorm = normalizeText(question.question_text || '');
  const qOptionsNorm = (question.options || []).map(o => normalizeText(o)).join(' ');
  const hasRealExp = isRealExplanation(rawExp);
  const fullContentNorm = `${qExpNorm} ${qTextNorm} ${qOptionsNorm}`;

  // 1. Prioridad Absoluta: Mención explícita a número de tema en la justificación o enunciado
  const explicitTemaMatch = fullContentNorm.match(/\b(?:\[\s*tema\s*[:\-\.]?\s*(\d+)\s*\]|tema\s*(?:n[úu]m(?:ero|\.)?)?\s*[:\-\.]?\s*(\d+)|\btema\s+(\d+)\b|\bt-(\d+)\b)/i);
  if (explicitTemaMatch) {
    const temaNum = parseInt(explicitTemaMatch[1] || explicitTemaMatch[2] || explicitTemaMatch[3] || explicitTemaMatch[4], 10);
    const targetTopic = topics.find(t => t.order_index === temaNum);
    if (targetTopic) {
      return {
        topic: targetTopic,
        confidence: 'high',
        score: 250,
        matchedTerms: [`Tema ${temaNum} explícito`],
        reason: `Mención explícita a "Tema ${temaNum}" en el texto.`
      };
    }
  }

  // 2. Evaluación tema por tema
  const scoredTopics: {
    topic: Topic;
    score: number;
    matchedTerms: string[];
  }[] = [];

  for (const topic of topics) {
    let score = 0;
    const matches: string[] = [];
    const rules = getTopicRules(topic);

    const hasCustomRules = (rules.laws && rules.laws.length > 0) ||
      (rules.keywords && rules.keywords.length > 0) ||
      (rules.negativeWords && rules.negativeWords.length > 0);

    // --- A) REGLAS PERSONALIZADAS POR EL USUARIO ---
    if (hasCustomRules) {
      // 1. Leyes oficiales y sus variantes (Máxima relevancia)
      for (const rawLaw of rules.laws || []) {
        const variants = extractLawVariants(rawLaw);
        let lawMatched = false;

        for (const v of variants) {
          if (lawMatched) break;
          const isVShort = v.length <= 3;
          const vRegex = isVShort ? new RegExp(`\\b${v}\\b`, 'i') : null;

          // Búsqueda en Justificación
          if (hasRealExp && (vRegex ? vRegex.test(qExpNorm) : qExpNorm.includes(v))) {
            score += 60;
            matches.push(`Ley en justificación: ${rawLaw} (+60 pts)`);
            lawMatched = true;
          } 
          // Búsqueda en Enunciado
          else if (vRegex ? vRegex.test(qTextNorm) : qTextNorm.includes(v)) {
            score += 45;
            matches.push(`Ley en enunciado: ${rawLaw} (+45 pts)`);
            lawMatched = true;
          }
          // Búsqueda en Opciones
          else if (vRegex ? vRegex.test(qOptionsNorm) : qOptionsNorm.includes(v)) {
            score += 25;
            matches.push(`Ley en opciones: ${rawLaw} (+25 pts)`);
            lawMatched = true;
          }
        }
      }

      // 2. Palabras y frases clave
      for (const kw of rules.keywords || []) {
        const normKw = normalizeText(kw);
        if (normKw.length < 2) continue;

        const isCompound = normKw.includes(' ') || normKw.includes('-');

        if (isCompound) {
          if (hasRealExp && qExpNorm.includes(normKw)) {
            score += 30;
            matches.push(`Frase en justificación: "${kw}" (+30 pts)`);
          } else if (qTextNorm.includes(normKw)) {
            score += 20;
            matches.push(`Frase en enunciado: "${kw}" (+20 pts)`);
          } else if (qOptionsNorm.includes(normKw)) {
            score += 10;
            matches.push(`Frase en opciones: "${kw}" (+10 pts)`);
          }
        } else {
          const wordRegex = new RegExp(`\\b${normKw}\\b`, 'i');
          if (hasRealExp && wordRegex.test(qExpNorm)) {
            score += 18;
            matches.push(`Palabra en justificación: ${kw} (+18 pts)`);
          } else if (wordRegex.test(qTextNorm)) {
            score += 12;
            matches.push(`Palabra en enunciado: ${kw} (+12 pts)`);
          } else if (wordRegex.test(qOptionsNorm)) {
            score += 6;
            matches.push(`Palabra en opciones: ${kw} (+6 pts)`);
          }
        }
      }

      // 3. Términos excluyentes / negativos
      for (const neg of rules.negativeWords || []) {
        const normNeg = normalizeText(neg);
        if (normNeg.length < 2) continue;

        const isCompound = normNeg.includes(' ');
        let found = false;

        if (isCompound) {
          found = fullContentNorm.includes(normNeg);
        } else {
          const negRegex = new RegExp(`\\b${normNeg}\\b`, 'i');
          found = negRegex.test(fullContentNorm);
        }

        if (found) {
          score -= 100;
          matches.push(`Excluyente detectado: "${neg}" (-100 pts)`);
        }
      }
    } else {
      // --- B) RESPALDO: TEMAS SIN REGLAS CONFIGURADAS (DOMINIOS Y TÍTULO) ---
      const normTitle = normalizeText(topic.title);
      const subNorms = (topic.subtopics || []).map(s => normalizeText(s.title));

      for (const domain of DEFAULT_LEGAL_DOMAINS) {
        const matchesDomain = domain.triggers.some(tr => normTitle.includes(tr) || subNorms.some(s => s.includes(tr)));
        if (matchesDomain) {
          for (const rawL of domain.laws) {
            const variants = extractLawVariants(rawL);
            for (const l of variants) {
              const lRegex = l.length <= 3 ? new RegExp(`\\b${l}\\b`, 'i') : null;
              if (hasRealExp && (lRegex ? lRegex.test(qExpNorm) : qExpNorm.includes(l))) {
                score += 50;
                matches.push(`Ley general en justificación: ${rawL}`);
                break;
              } else if (lRegex ? lRegex.test(qTextNorm) : qTextNorm.includes(l)) {
                score += 35;
                matches.push(`Ley general en enunciado: ${rawL}`);
                break;
              }
            }
          }
          for (const p of domain.phrases) {
            if (hasRealExp && qExpNorm.includes(p)) {
              score += 25;
              matches.push(`Frase general en justificación: "${p}"`);
            } else if (qTextNorm.includes(p)) {
              score += 15;
              matches.push(`Frase general en enunciado: "${p}"`);
            }
          }
        }
      }

      // Palabras del título
      const titleTokens = extractSignificantTokens(topic.title);
      for (const tok of titleTokens) {
        const tokRegex = new RegExp(`\\b${tok}\\b`, 'i');
        if (hasRealExp && tokRegex.test(qExpNorm)) {
          score += 15;
          matches.push(`Título en justificación: ${tok}`);
        } else if (tokRegex.test(qTextNorm)) {
          score += 10;
          matches.push(`Título en enunciado: ${tok}`);
        }
      }
    }

    if (score > 0) {
      scoredTopics.push({ topic, score, matchedTerms: matches });
    }
  }

  if (scoredTopics.length === 0) {
    return null;
  }

  // Ordenar por puntuación descendente
  scoredTopics.sort((a, b) => b.score - a.score);

  const best = scoredTopics[0];
  const runnerUp = scoredTopics.length > 1 ? scoredTopics[1] : null;

  // Si no llega al umbral mínimo, no clasificar
  if (best.score < 10) {
    return null;
  }

  // Comprobar si es certeza alta (para asignación directa) o media (sugerencia con 1 clic)
  const isHighGap = !runnerUp || (best.score - runnerUp.score >= 10) || (best.score >= runnerUp.score * 1.6);
  const isScoreSolid = best.score >= 20;

  if (isScoreSolid && isHighGap) {
    return {
      topic: best.topic,
      confidence: 'high',
      score: best.score,
      matchedTerms: best.matchedTerms,
      reason: `Clasificado con alta certeza (${best.score} pts): ${best.matchedTerms.slice(0, 3).join(', ')}`,
      runnerUp: runnerUp ? { topic: runnerUp.topic, score: runnerUp.score } : null,
      allScores: scoredTopics
    };
  }

  // Coincidencia con dudas razonables -> 'medium'
  const runnerInfo = runnerUp ? ` (Disputado con "${runnerUp.topic.title}": ${runnerUp.score} pts)` : '';
  return {
    topic: best.topic,
    confidence: 'medium',
    score: best.score,
    matchedTerms: best.matchedTerms,
    reason: `Sugerencia recomendada (${best.score} pts)${runnerInfo}: ${best.matchedTerms.slice(0, 3).join(', ')}`,
    runnerUp: runnerUp ? { topic: runnerUp.topic, score: runnerUp.score } : null,
    allScores: scoredTopics
  };
}

/**
 * Función sandbox para probar el clasificador en vivo desde la UI.
 * Devuelve el desglose detallado de todos los temas que han obtenido puntuación.
 */
export function testClassifierSandbox(
  input: string | { question_text?: string; explanation?: string; options?: string[] },
  topics: Topic[]
): {
  result: ClassificationResult | null;
  leaderboard: {
    topic: Topic;
    score: number;
    matchedTerms: string[];
    isWinner: boolean;
  }[];
} {
  const qPayload = typeof input === 'string'
    ? { question_text: '', explanation: input }
    : { question_text: input.question_text || '', explanation: input.explanation || '', options: input.options || [] };

  const result = classifyQuestionByKeywords(qPayload, topics);
  if (!result || !result.allScores) {
    return {
      result,
      leaderboard: []
    };
  }

  const leaderboard = result.allScores.map((item, idx) => ({
    topic: item.topic,
    score: item.score,
    matchedTerms: item.matchedTerms,
    isWinner: idx === 0
  }));

  return { result, leaderboard };
}

/**
 * Resuelve un tema a partir de una referencia escrita o etiqueta explícita
 * (ej: "[TEMA 1]", "Tema: 4", "TEMA 12 - La Constitución", etc.)
 */
export function matchTopicFromReference(topicRef: string, topics: Topic[]): Topic | null {
  if (!topicRef || !topics || topics.length === 0) return null;
  const cleanRef = topicRef.trim();

  // 1. Coincidencia directa por número
  const isOnlyDigits = /^\d+$/.test(cleanRef);
  if (isOnlyDigits) {
    const num = parseInt(cleanRef, 10);
    const byNum = topics.find(t => t.order_index === num);
    if (byNum) return byNum;
  }

  const explicitTemaMatch = cleanRef.match(/\b(?:\[\s*tema\s*[:\-\.]?\s*(\d+)\s*\]|tema\s*(?:n[úu]m(?:ero|\.)?)?\s*[:\-\.]?\s*(\d+)|\btema\s+(\d+)\b|\bt-(\d+)\b)/i);
  if (explicitTemaMatch) {
    const num = parseInt(explicitTemaMatch[1] || explicitTemaMatch[2] || explicitTemaMatch[3] || explicitTemaMatch[4], 10);
    const byNum = topics.find(t => t.order_index === num);
    if (byNum) return byNum;
  }

  // 2. Coincidencia por título del tema exacto
  const lowerRef = normalizeText(cleanRef);
  const byExactTitle = topics.find(t => normalizeText(t.title) === lowerRef);
  if (byExactTitle) return byExactTitle;

  // 3. Coincidencia por palabras clave
  const fallbackMatch = classifyQuestionByKeywords({ question_text: cleanRef }, topics);
  if (fallbackMatch) {
    return fallbackMatch.topic;
  }

  return null;
}
