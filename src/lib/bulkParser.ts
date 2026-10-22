/**
 * Parser de exámenes tipo test con enfoque de máquina de estados por líneas.
 * Procesa línea por línea de forma robusta, soportando:
 * - Cualquier formato de numeración de pregunta:
 *   1., 1), 1.-, 1 -, 1:, PREGUNTA 1, P1, EJERCICIO 1, o incluso preguntas sin número si vienen separadas
 * - Opciones de 3 o 4 respuestas:
 *   a), A), a., A., a -, A-, [a], (a), 1), 1., etc.
 *   opciones multilínea (cuando una opción ocupa varios párrafos o líneas)
 * - Detección de respuesta correcta:
 *   RESPUESTA: A, RESPUESTA A, SOLUCIÓN: B, SOL: C, CORRECTA: D, CLAVE: B, etc.
 *   o asterisco (*) al inicio de la opción: *b) texto
 *   o marca (CORRECTA) o ✓ en la opción
 * - Explicación / justificación legal:
 *   EXPLICACIÓN: ..., JUSTIFICACIÓN: ..., ART: ..., etc.
 * - JSON si proviene de IA.
 */

export interface ParsedQuestionItem {
  question_number?: number;
  question_text: string;
  options: string[];
  correct_option: number; // 0..3
  explanation: string;
  topic_reference?: string; // Ej: "1", "Tema 1", "La Constitución", etc.
}

export function parseBulkExamQuestions(rawText: string): ParsedQuestionItem[] {
  if (!rawText || !rawText.trim()) return [];

  // 1. Intentar parsear como JSON si viene en formato estructurado
  const trimmed = rawText.trim();
  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    try {
      const parsed = JSON.parse(trimmed);
      const items = Array.isArray(parsed) ? parsed : (parsed.questions || [parsed]);
      if (Array.isArray(items) && items.length > 0) {
        return items.map((it: any, idx: number) => {
          let opts: string[] = [];
          if (Array.isArray(it.options)) {
            opts = it.options.map((o: any) => String(o).trim());
          } else if (it.opciones && Array.isArray(it.opciones)) {
            opts = it.opciones.map((o: any) => String(o).trim());
          } else if (it.a || it.A) {
            opts = [it.a || it.A, it.b || it.B, it.c || it.C];
            if (it.d || it.D) opts.push(it.d || it.D);
          }

          let corr = 0;
          if (typeof it.correct_option === 'number') {
            corr = it.correct_option;
          } else if (typeof it.correcta === 'string' || typeof it.respuesta === 'string' || typeof it.solucion === 'string') {
            const letter = (it.correcta || it.respuesta || it.solucion || 'A').toUpperCase().trim();
            corr = letter === 'B' ? 1 : letter === 'C' ? 2 : letter === 'D' ? 3 : 0;
          }

          const topicRef = it.topic_reference || it.topic || it.tema || it.topic_number || it.tema_numero || it.topic_id || it.tema_id;

          return {
            question_number: it.question_number || it.numero || idx + 1,
            question_text: (it.question_text || it.pregunta || it.enunciado || '').trim(),
            options: opts.filter(Boolean),
            correct_option: Math.min(corr, Math.max(0, opts.length - 1)),
            explanation: (it.explanation || it.explicacion || it.justificacion || 'Conforme a la plantilla oficial de respuestas.').trim(),
            topic_reference: topicRef ? String(topicRef).trim() : undefined,
          };
        }).filter(q => q.question_text && q.options.length >= 3);
      }
    } catch {
      // Continuar con parser por líneas
    }
  }

  // 2. Normalizar líneas
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trim());

  interface RawQuestionDraft {
    qNum?: number;
    qLines: string[];
    options: { label: string; text: string; isCorrectFlag?: boolean }[];
    explicitCorrect?: number;
    expLines: string[];
    topicRef?: string;
  }

  const drafts: RawQuestionDraft[] = [];
  let current: RawQuestionDraft | null = null;
  let currentSection: 'question' | 'option' | 'explanation' = 'question';

  // Expresiones regulares de detección
  const isQuestionStart = (line: string): { isStart: boolean; num?: number; content: string } => {
    // Ejemplo: "1. ¿Quién...", "1) ¿Quién...", "1.- ...", "1 - ...", "1: ...", "PREGUNTA 1: ...", "P.1: ..."
    const m = line.match(/^(?:(?:preg|pregunta|ejercicio|p|p\.)\s*(\d+)[\.\:\)\-\s]*|(\d+)[\.\)\:\-]\s+)(.*)/i);
    if (m) {
      const numStr = m[1] || m[2];
      const rest = m[3] ? m[3].trim() : '';
      return { isStart: true, num: parseInt(numStr, 10), content: rest };
    }
    return { isStart: false, content: line };
  };

  const isOptionStart = (line: string): { isOpt: boolean; label: string; content: string; isStarred: boolean } => {
    // Ejemplo: "a) texto", "A) texto", "*b) texto", "a. texto", "[a] texto", "(a) texto", "a - texto"
    const m = line.match(/^(\*?)\s*(?:[\(\[]?([a-dA-D]|1|2|3|4)[\.\)\]\:\-]\s*|\b([a-dA-D])\s*[\)\.\-]\s*)(.*)/);
    if (m) {
      const isStarred = !!m[1] || line.includes('✓') || line.includes('(CORRECTA)');
      let label = (m[2] || m[3]).toUpperCase();
      if (label === '1') label = 'A';
      if (label === '2') label = 'B';
      if (label === '3') label = 'C';
      if (label === '4') label = 'D';

      const content = (m[4] || '').replace(/\s*(?:✓|\(CORRECTA\)|\*)\s*$/i, '').trim();
      return { isOpt: true, label, content, isStarred };
    }
    return { isOpt: false, label: '', content: line, isStarred: false };
  };

  const isAnswerLine = (line: string): { isAns: boolean; correctIdx: number; extraExp?: string } => {
    // Ejemplo: "RESPUESTA: A", "SOLUCIÓN: B", "RESPUESTA CORRECTA: C", "CORRECTA: D", "SOL: A", "RESP: B"
    const m = line.match(/^(?:resp(?:uesta)?(?:\s+correcta)?|soluci[oó]n|sol|correcta|clave):?\s*([a-dA-D]|1|2|3|4)(.*)/i);
    if (m) {
      const letUpper = m[1].toUpperCase();
      let idx = 0;
      if (letUpper === 'B' || letUpper === '2') idx = 1;
      else if (letUpper === 'C' || letUpper === '3') idx = 2;
      else if (letUpper === 'D' || letUpper === '4') idx = 3;

      const extra = (m[2] || '').replace(/^[\.\:\-\s]+/, '').trim();
      return { isAns: true, correctIdx: idx, extraExp: extra || undefined };
    }
    return { isAns: false, correctIdx: 0 };
  };

  const isExplanationStart = (line: string): { isExp: boolean; content: string } => {
    // Ejemplo: "EXPLICACIÓN: ...", "JUSTIFICACIÓN: ...", "FUNDAMENTO: ...", "ARTÍCULO: ..."
    const m = line.match(/^(?:exp(?:licaci[oó]n)?|justificaci[oó]n|fundamento|ley|normativa|criterio):?\s*(.*)/i);
    if (m) {
      return { isExp: true, content: m[1] ? m[1].trim() : '' };
    }
    return { isExp: false, content: line };
  };

  const isTopicLine = (line: string): { isTopic: boolean; topicRef: string } => {
    // Caso 1: [TEMA 1], [TEMA: 1], [Tema 1: La Constitución], # TEMA 1
    const bracketMatch = line.match(/^(?:\[\s*tema\s*[:\-\.]?\s*([^\]]+)\]|\#+\s*tema\s*[:\-\.]?\s*(.+))/i);
    if (bracketMatch) {
      const raw = (bracketMatch[1] || bracketMatch[2] || '').trim();
      if (raw) return { isTopic: true, topicRef: raw };
    }

    // Caso 2: Prefijo "TEMA" seguido de número o texto: "TEMA 1:", "TEMA: 1", "TEMA 1 - ", "Tema: Régimen Local"
    const colonMatch = line.match(/^tema\s*(?:n[úu]m(?:ero|\.)?)?\s*[:\-\.]\s*([0-9]+|[a-zA-Z0-9\s\.\-_]+)$/i);
    if (colonMatch) {
      const raw = colonMatch[1].trim();
      if (raw) return { isTopic: true, topicRef: raw };
    }

    // Caso 3: "TEMA <numero>" solo en una línea corta: "TEMA 1", "Tema 12"
    const shortNumMatch = line.match(/^tema\s+(\d+)\s*$/i);
    if (shortNumMatch) {
      return { isTopic: true, topicRef: shortNumMatch[1].trim() };
    }

    return { isTopic: false, topicRef: '' };
  };

  let activeTopicRef: string | undefined = undefined;

  // Recorrer línea a línea
  for (const line of lines) {
    if (!line) continue; // Ignorar líneas en blanco

    // 0. ¿Es una etiqueta de tema para la siguiente pregunta o bloque de preguntas?
    const topicCheck = isTopicLine(line);
    if (topicCheck.isTopic) {
      activeTopicRef = topicCheck.topicRef;
      if (current) {
        current.topicRef = topicCheck.topicRef;
      }
      continue;
    }

    // 1. ¿Inicia una nueva pregunta explícita por número?
    const qCheck = isQuestionStart(line);
    if (qCheck.isStart) {
      if (current) {
        drafts.push(current);
      }
      current = {
        qNum: qCheck.num,
        qLines: qCheck.content ? [qCheck.content] : [],
        options: [],
        expLines: [],
        topicRef: activeTopicRef,
      };
      currentSection = 'question';
      continue;
    }

    // 2. ¿Es la respuesta correcta explícita?
    const ansCheck = isAnswerLine(line);
    if (ansCheck.isAns) {
      if (!current) {
        current = { qLines: [], options: [], expLines: [] };
      }
      current.explicitCorrect = ansCheck.correctIdx;
      if (ansCheck.extraExp) {
        current.expLines.push(ansCheck.extraExp);
      }
      currentSection = 'explanation';
      continue;
    }

    // 3. ¿Es una explicación explícita?
    const expCheck = isExplanationStart(line);
    if (expCheck.isExp) {
      if (!current) {
        current = { qLines: [], options: [], expLines: [] };
      }
      if (expCheck.content) {
        current.expLines.push(expCheck.content);
      }
      currentSection = 'explanation';
      continue;
    }

    // 4. ¿Es una opción de respuesta (a, b, c, d)?
    const optCheck = isOptionStart(line);
    if (optCheck.isOpt) {
      if (!current) {
        current = { qLines: [], options: [], expLines: [] };
      }

      // Si nos llega una opción 'A' y el borrador actual ya tiene opciones completas (por ejemplo ya tenía A, B, C),
      // significa que ha empezado una nueva pregunta sin número antes!
      if (optCheck.label === 'A' && current.options.length >= 3) {
        drafts.push(current);
        current = {
          qLines: [],
          options: [{ label: optCheck.label, text: optCheck.content, isCorrectFlag: optCheck.isStarred }],
          expLines: [],
          topicRef: activeTopicRef,
        };
        currentSection = 'option';
        continue;
      }

      current.options.push({
        label: optCheck.label,
        text: optCheck.content,
        isCorrectFlag: optCheck.isStarred,
      });
      currentSection = 'option';
      continue;
    }

    // 5. Línea de texto continuado según la sección actual
    if (!current) {
      // Si aún no hay borrador, la primera línea es el inicio de la primera pregunta
      current = {
        qLines: [line],
        options: [],
        expLines: [],
      };
      currentSection = 'question';
      continue;
    }

    if (currentSection === 'explanation') {
      current.expLines.push(line);
    } else if (currentSection === 'option' && current.options.length > 0) {
      // Texto que continúa la opción anterior en la siguiente línea
      current.options[current.options.length - 1].text += ' ' + line;
    } else {
      // Sigue siendo parte del enunciado de la pregunta
      current.qLines.push(line);
    }
  }

  // Guardar el último borrador
  if (current) {
    drafts.push(current);
  }

  // Convertir los borradores a preguntas válidas
  const finalResults: ParsedQuestionItem[] = [];
  let fallbackNumber = 1;

  for (const draft of drafts) {
    const qText = draft.qLines.join(' ').trim();
    const finalOpts = draft.options.map(o => o.text.trim()).filter(Boolean);

    // Debe tener enunciado y al menos 3 opciones
    if (qText && finalOpts.length >= 3) {
      let correctIdx = 0;
      if (typeof draft.explicitCorrect === 'number') {
        correctIdx = draft.explicitCorrect;
      } else {
        const starIdx = draft.options.findIndex(o => o.isCorrectFlag);
        if (starIdx !== -1) {
          correctIdx = starIdx;
        }
      }

      correctIdx = Math.min(correctIdx, finalOpts.length - 1);

      finalResults.push({
        question_number: draft.qNum || fallbackNumber,
        question_text: qText,
        options: finalOpts.slice(0, 4),
        correct_option: correctIdx,
        explanation: draft.expLines.join(' ').trim() || 'Conforme a la normativa oficial y criterios del tribunal.',
        topic_reference: draft.topicRef || activeTopicRef,
      });

      fallbackNumber = (draft.qNum ? draft.qNum + 1 : fallbackNumber + 1);
    }
  }

  return finalResults;
}
