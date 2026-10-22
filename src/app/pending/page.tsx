'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { RefreshCw, LogOut, Clock } from 'lucide-react';

export default function PendingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [checking, setChecking] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  const checkStatus = async () => {
    setChecking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUserEmail(user.email || '');

      const { data: profile } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', user.id)
        .single();

      if (profile?.status === 'approved') {
        router.push('/dashboard');
        router.refresh();
      }
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 text-slate-900 w-full max-w-full overflow-x-hidden">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-sm">
        <div className="flex justify-center mb-6">
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden shadow-md shadow-indigo-600/20 border border-indigo-100 bg-white">
            <Image
              src="/logo-icon.png"
              alt="TESTCLM/CM"
              fill
              className="object-contain p-0.5"
              priority
            />
          </div>
        </div>

        <h1 className="text-2xl font-black text-slate-900 mb-2">Acceso Pendiente de Autorización</h1>
        
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          Hola <span className="text-slate-900 font-bold">{userEmail}</span>. Tu solicitud se ha enviado y está pendiente de validación por el administrador.
        </p>

        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-left mb-6 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
            <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping" />
            Estado actual: PENDIENTE DE REVISIÓN
          </div>
          <p className="text-xs text-amber-800">
            Una vez aprobada tu cuenta desde el panel de control, podrás acceder inmediatamente al temario y los tests.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={checkStatus}
            disabled={checking}
            className="w-full py-3 px-4 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            Comprobar si ya he sido aprobado
          </button>

          <button
            onClick={handleSignOut}
            className="w-full py-2.5 px-4 rounded-xl text-sm font-bold text-slate-500 hover:text-rose-600 transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
