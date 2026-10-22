'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/lib/types';
import { 
  BookOpen, 
  Layers, 
  Users, 
  HelpCircle, 
  LogOut,
  Sparkles,
  Award,
  ShieldCheck,
  ChevronRight,
  Boxes,
  Flag,
  Menu,
  X,
  SlidersHorizontal
} from 'lucide-react';

interface SidebarProps {
  profile: Profile | null;
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [pendingChallengesCount, setPendingChallengesCount] = useState<number>(0);

  const isApproved = profile?.status === 'approved';
  const isAdmin = profile?.role === 'admin';

  const handleSignOut = async () => {
    if (typeof document !== 'undefined') {
      document.cookie = 'opos_cached_uid=; path=/; max-age=0';
      document.cookie = 'opos_cached_role=; path=/; max-age=0';
      document.cookie = 'opos_cached_status=; path=/; max-age=0';
    }
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  useEffect(() => {
    if (!isAdmin) return;
    let isMounted = true;
    async function loadPendingChallenges() {
      try {
        const { count, error } = await supabase
          .from('question_challenges')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending');
        if (isMounted && !error && typeof count === 'number') {
          setPendingChallengesCount(count);
        }
      } catch {
        // Ignorar si la tabla no existe aún en supabase
      }
    }
    loadPendingChallenges();
    const interval = setInterval(loadPendingChallenges, 120000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isAdmin, pathname === '/admin/challenges']);

  // Cerrar menú móvil al cambiar de ruta
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileOpen(false);
    };
    if (isMobileOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen]);

  const renderNavLinks = (onItemClick?: () => void) => (
    <div className="space-y-6">
      {/* 1. ZONA DE ESTUDIO (VISIBLE PARA ALUMNOS Y ADMIN) */}
      {isApproved && (
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3">
            Zona de Estudio
          </span>

          <nav className="space-y-1 pt-1">
            {/* Contenidos */}
            <Link
              href="/study/contents"
              prefetch={false}
              onClick={onItemClick}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                pathname.startsWith('/study/contents')
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <BookOpen className="w-4 h-4" />
                <span>Contenidos</span>
              </div>
              {pathname.startsWith('/study/contents') && <ChevronRight className="w-3.5 h-3.5" />}
            </Link>

            {/* Exámenes Oficiales */}
            <Link
              href="/study/official-exams"
              prefetch={false}
              onClick={onItemClick}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                pathname.startsWith('/study/official-exam')
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Award className="w-4 h-4" />
                <span>Exámenes Oficiales</span>
              </div>
              {pathname.startsWith('/study/official-exam') && <ChevronRight className="w-3.5 h-3.5" />}
            </Link>

            {/* Examen Personalizado */}
            <Link
              href="/study/exam"
              prefetch={false}
              onClick={onItemClick}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                pathname === '/study/exam' || (pathname.startsWith('/study/exam') && !pathname.startsWith('/study/official-exam'))
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <SlidersHorizontal className="w-4 h-4" />
                <span>Examen Personalizado</span>
              </div>
              {(pathname === '/study/exam' || (pathname.startsWith('/study/exam') && !pathname.startsWith('/study/official-exam'))) && (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </Link>

            {/* Modo Anki (Test) */}
            <Link
              href="/study/anki"
              prefetch={false}
              onClick={onItemClick}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                pathname.startsWith('/study/anki')
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Sparkles className="w-4 h-4" />
                <span>Modo Anki (Test)</span>
              </div>
              {pathname.startsWith('/study/anki') && <ChevronRight className="w-3.5 h-3.5" />}
            </Link>

            {/* Modo Flashcards */}
            <Link
              href="/study/flashcards"
              prefetch={false}
              onClick={onItemClick}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                pathname.startsWith('/study/flashcards')
                  ? 'bg-indigo-50 text-indigo-700 font-extrabold border border-indigo-200'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Modo Flashcards</span>
              </div>
              {pathname.startsWith('/study/flashcards') && <ChevronRight className="w-3.5 h-3.5" />}
            </Link>
          </nav>
        </div>
      )}

      {/* 2. ZONA DE GESTIÓN ADMIN (SOLO VISIBLE PARA TI: ADMIN) */}
      {isAdmin && (
        <div className="space-y-1.5 pt-4 border-t border-slate-100">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 px-3 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Gestión Admin
          </span>

          <nav className="space-y-1 pt-1">
            {/* Añadir / Gestionar Exámenes Oficiales */}
            <Link
              href="/admin/official-exams"
              prefetch={false}
              onClick={onItemClick}
              className={`flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                pathname.startsWith('/admin/official-exams')
                  ? 'bg-amber-100 text-amber-900'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Award className="w-4 h-4 text-amber-700" />
              <span>Gestor Exámenes Oficiales</span>
            </Link>

            {/* Añadir / Gestionar Flashcards */}
            <Link
              href="/admin/flashcards"
              prefetch={false}
              onClick={onItemClick}
              className={`flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                pathname.startsWith('/admin/flashcards')
                  ? 'bg-amber-100 text-amber-900'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4 text-amber-700" />
              <span>Gestor de Flashcards</span>
            </Link>

            {/* Añadir / Gestionar Preguntas Test */}
            <Link
              href="/admin/questions"
              prefetch={false}
              onClick={onItemClick}
              className={`flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                pathname.startsWith('/admin/questions')
                  ? 'bg-amber-100 text-amber-900'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <HelpCircle className="w-4 h-4 text-amber-700" />
              <span>Banco de Preguntas</span>
            </Link>

            {/* Bloques y Temario */}
            <Link
              href="/admin/topics"
              prefetch={false}
              onClick={onItemClick}
              className={`flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                pathname.startsWith('/admin/topics')
                  ? 'bg-amber-100 text-amber-900'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Boxes className="w-4 h-4 text-amber-700" />
              <span>Bloques y Temario</span>
            </Link>

            {/* Gestión de Alumnos */}
            <Link
              href="/admin/users"
              prefetch={false}
              onClick={onItemClick}
              className={`flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                pathname.startsWith('/admin/users')
                  ? 'bg-amber-100 text-amber-900'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4 text-amber-700" />
              <span>Gestión de Alumnos</span>
            </Link>

            {/* Impugnaciones de Preguntas */}
            <Link
              href="/admin/challenges"
              prefetch={false}
              onClick={onItemClick}
              className={`flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                pathname.startsWith('/admin/challenges')
                  ? 'bg-amber-100 text-amber-900'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Flag className="w-4 h-4 text-amber-700" />
                <span>Impugnaciones</span>
              </div>
              {pendingChallengesCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-2xs">
                  {pendingChallengesCount}
                </span>
              )}
            </Link>
          </nav>
        </div>
      )}
    </div>
  );

  const renderProfile = () => (
    profile && (
      <div className="p-4 border-t border-slate-200 bg-slate-50/70 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="truncate">
            <p className="text-xs font-bold text-slate-900 truncate">
              {profile.full_name || profile.email}
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {profile.role === 'admin' ? '⭐ Administrador' : 'Alumno'}
            </p>
          </div>

          <button
            onClick={handleSignOut}
            title="Cerrar sesión"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 transition-colors shadow-2xs cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  );

  return (
    <>
      {/* ========================================================= */}
      {/* BARRA SUPERIOR PARA MÓVILES (md:hidden)                   */}
      {/* ========================================================= */}
      <header className="md:hidden sticky top-0 z-30 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-2.5 flex items-center justify-between shadow-xs">
        <Link href="/dashboard" prefetch={false} className="flex items-center gap-2.5 min-w-0">
          <div className="relative w-9 h-9 rounded-xl overflow-hidden shadow-xs border border-indigo-100 bg-white shrink-0">
            <Image
              src="/logo-icon.png"
              alt="TESTCLM/CM"
              fill
              className="object-contain p-0.5"
              priority
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-black text-sm text-slate-900 tracking-tight leading-tight">
                TESTCLM<span className="text-indigo-600">/CM</span>
              </span>
            </div>
            <span className="text-[9px] font-semibold text-slate-500 block truncate leading-tight">
              Policía Local y Municipal
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          {pendingChallengesCount > 0 && isAdmin && (
            <Link
              href="/admin/challenges"
              prefetch={false}
              className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-2xs"
            >
              {pendingChallengesCount}
            </Link>
          )}
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 transition-all cursor-pointer"
            aria-label="Abrir menú de navegación"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* MENÚ DESPLEGABLE MÓVIL (DRAWER)                           */}
      {/* ========================================================= */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Fondo oscuro */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Panel lateral */}
          <aside className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col justify-between shadow-2xl z-10 overflow-y-auto animate-in slide-in-from-left duration-200">
            <div className="p-5 space-y-6">
              {/* Cabecera del panel con botón cerrar */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <Link
                  href="/dashboard"
                  prefetch={false}
                  onClick={() => setIsMobileOpen(false)}
                  className="flex items-center gap-2.5 min-w-0"
                >
                  <div className="relative w-8 h-8 rounded-xl overflow-hidden shadow-xs border border-indigo-100 bg-white shrink-0">
                    <Image
                      src="/logo-icon.png"
                      alt="TESTCLM/CM"
                      fill
                      className="object-contain p-0.5"
                    />
                  </div>
                  <div className="min-w-0">
                    <span className="font-black text-sm text-slate-900 tracking-tight leading-tight block">
                      TESTCLM<span className="text-indigo-600">/CM</span>
                    </span>
                    <span className="text-[9px] font-semibold text-slate-500 block truncate leading-tight">
                      Policía Local y Municipal
                    </span>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={() => setIsMobileOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  aria-label="Cerrar menú"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {renderNavLinks(() => setIsMobileOpen(false))}
            </div>

            {renderProfile()}
          </aside>
        </div>
      )}

      {/* ========================================================= */}
      {/* SIDEBAR DE ESCRITORIO (hidden md:flex)                    */}
      {/* ========================================================= */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 min-h-screen flex-col justify-between shrink-0 shadow-xs">
        <div className="p-5 space-y-6">
          {/* Logotipo / Marca */}
          <Link href="/dashboard" prefetch={false} className="flex items-center gap-3 px-1.5 py-1 group">
            <div className="relative w-11 h-11 rounded-2xl overflow-hidden shadow-md shadow-indigo-600/20 group-hover:scale-105 transition-transform shrink-0 border border-indigo-100 bg-white">
              <Image
                src="/logo-icon.png"
                alt="TESTCLM/CM"
                fill
                className="object-contain p-0.5"
                priority
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base text-slate-900 tracking-tight leading-tight">
                  TESTCLM<span className="text-indigo-600">/CM</span>
                </span>
              </div>
              <span className="text-[10px] font-semibold text-slate-500 block truncate leading-tight mt-0.5">
                Policía Local y Municipal
              </span>
            </div>
          </Link>

          {renderNavLinks()}
        </div>

        {renderProfile()}
      </aside>
    </>
  );
}
