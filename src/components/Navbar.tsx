'use client';

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
  Sparkles
} from 'lucide-react';

interface NavbarProps {
  profile: Profile | null;
}

export function Navbar({ profile }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const isApproved = profile?.status === 'approved';
  const isAdmin = profile?.role === 'admin';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/90 backdrop-blur-md shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" prefetch={false} className="flex items-center gap-2.5 group">
            <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow-md shadow-indigo-600/20 group-hover:scale-105 transition-transform shrink-0 border border-indigo-100 bg-white">
              <Image
                src="/logo-icon.png"
                alt="TESTCLM/CM"
                fill
                className="object-contain p-0.5"
                priority
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-lg text-slate-900 tracking-tight leading-tight">
                  TESTCLM<span className="text-indigo-600">/CM</span>
                </span>
              </div>
              <span className="text-[10px] font-semibold text-slate-500 block -mt-0.5">
                Policía Local y Municipal
              </span>
            </div>
          </Link>

          {isApproved && (
            <nav className="hidden md:flex items-center gap-1.5">
              <Link
                href="/dashboard"
                prefetch={false}
                className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  pathname === '/dashboard'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Panel de Estudio
              </Link>
              <Link
                href="/study/exam"
                prefetch={false}
                className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  pathname.startsWith('/study/exam')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Modo Examen
              </Link>
              <Link
                href="/study/anki"
                prefetch={false}
                className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  pathname.startsWith('/study/anki')
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Modo Anki (Test)
              </Link>
              <Link
                href="/study/flashcards"
                prefetch={false}
                className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  pathname.startsWith('/study/flashcards')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Modo Flashcards
              </Link>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <div className="hidden sm:flex items-center gap-1 bg-amber-50/70 border border-amber-200 rounded-xl p-1">
              <Link
                href="/admin/users"
                prefetch={false}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  pathname.startsWith('/admin/users')
                    ? 'bg-amber-600 text-white'
                    : 'text-amber-800 hover:bg-amber-100/60'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Usuarios
              </Link>
              <Link
                href="/admin/topics"
                prefetch={false}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  pathname.startsWith('/admin/topics')
                    ? 'bg-amber-600 text-white'
                    : 'text-amber-800 hover:bg-amber-100/60'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Temario
              </Link>
              <Link
                href="/admin/questions"
                prefetch={false}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  pathname.startsWith('/admin/questions')
                    ? 'bg-amber-600 text-white'
                    : 'text-amber-800 hover:bg-amber-100/60'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Preguntas Test
              </Link>
              <Link
                href="/admin/flashcards"
                prefetch={false}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  pathname.startsWith('/admin/flashcards')
                    ? 'bg-purple-600 text-white'
                    : 'text-purple-800 hover:bg-purple-100/60'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Flashcards
              </Link>
            </div>
          )}

          {profile && (
            <div className="flex items-center gap-3 border-l border-slate-200 pl-3">
              <div className="hidden lg:block text-right">
                <p className="text-xs font-semibold text-slate-800">{profile.email}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                  {profile.role} • {profile.status}
                </p>
              </div>

              <button
                onClick={handleSignOut}
                title="Cerrar sesión"
                className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
