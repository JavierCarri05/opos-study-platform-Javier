'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/lib/types';
import { 
  Flag, 
  X, 
  Send, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  Info,
  HelpCircle
} from 'lucide-react';

interface QuestionChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: {
    id: string;
    question_text: string;
    options?: string[];
    correct_option?: number;
    explanation?: string;
    _origin?: string;
  } | null;
  user: Profile | null;
  onSuccess?: () => void;
}

export function QuestionChallengeModal({
  isOpen,
  onClose,
  question,
  user,
  onSuccess,
}: QuestionChallengeModalProps) {
  const supabase = createClient();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen || !question) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMsg('Por favor, redacta el motivo o argumentación de la impugnación.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        throw new Error('Debes iniciar sesión para impugnar una pregunta.');
      }

      const questionType = question._origin === 'official' ? 'official' : (question._origin === 'flashcard' ? 'flashcard' : 'bank');

      const { error } = await supabase.from('question_challenges').insert({
        question_id: String(question.id),
        question_type: questionType,
        user_id: authUser.id,
        user_email: user?.email || authUser.email || null,
        user_name: user?.full_name || null,
        reason: reason.trim(),
        status: 'pending',
        question_text: question.question_text,
        options: question.options || [],
        correct_option: question.correct_option ?? null,
        explanation: question.explanation || null,
      });

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('schema cache') || error.message?.includes('does not exist')) {
          throw new Error('La tabla de impugnaciones aún no está creada en Supabase. Por favor, ejecuta el script "create_question_challenges.sql" en el SQL Editor de Supabase.');
        }
        throw error;
      }

      setSubmitted(true);
      setReason('');

      setTimeout(() => {
        setSubmitted(false);
        onClose();
        if (onSuccess) onSuccess();
      }, 1800);

    } catch (err: any) {
      console.error('Error submitting question challenge:', err);
      setErrorMsg(err.message || 'Error al enviar la impugnación.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setErrorMsg(null);
    setSubmitted(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div className="p-6 bg-gradient-to-r from-amber-50 via-rose-50/30 to-amber-50/60 border-b border-amber-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
              <Flag className="w-5 h-5 fill-white/20" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                Impugnar Pregunta
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Reportar posible errata o discrepancia legal para revisión docente
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-xl transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido del Formulario */}
        <div className="p-6 space-y-5">
          {submitted ? (
            <div className="py-8 text-center space-y-3 animate-in fade-in">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">
                ¡Impugnación enviada con éxito!
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                El aviso ha sido enviado al administrador. La pregunta continuará en tu ciclo de estudio de Anki de forma habitual.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Enunciado de la Pregunta */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 text-xs sm:text-sm text-slate-800 space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Pregunta a impugnar</span>
                </div>
                <p className="font-semibold text-slate-900 leading-relaxed line-clamp-3">
                  {question.question_text}
                </p>
              </div>

              {/* Mensaje de Error */}
              {errorMsg && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="leading-snug">{errorMsg}</span>
                </div>
              )}

              {/* Argumentación del Alumno */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase text-slate-700 tracking-wide">
                  Motivo o Argumentación de la Impugnación <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explica detalladamente por qué consideras que la pregunta o respuesta es incorrecta (indica artículo de ley, contradicción o fallo detectado)..."
                  className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-300 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 leading-relaxed resize-y font-medium shadow-2xs"
                  autoFocus
                />
                <p className="text-[11px] text-slate-400 text-right">
                  {reason.length} caracteres
                </p>
              </div>

              {/* Nota Informativa sobre la rueda de Anki */}
              <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Aviso:</strong> Esta pregunta seguirá en tu rueda de estudio de Anki normalmente para no interrumpir tu progreso, pero generará una notificación en el panel del administrador para su comprobación.
                </p>
              </div>

              {/* Acciones */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={submitting || !reason.trim()}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-black text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer flex items-center gap-2 active:scale-95"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Enviar Impugnación</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
