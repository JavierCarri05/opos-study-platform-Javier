'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getCachedUserProfile } from '@/lib/supabaseHelper';

export function SecurityGuard() {
  const pathname = usePathname();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(/(?:^|;\s*)opos_cached_role=([^;]*)/);
      if (match && match[1] === 'admin') return true;
    }
    return false;
  });
  const supabase = createClient();

  useEffect(() => {
    let isMounted = true;

    async function checkRole() {
      try {
        const { user, profile } = await getCachedUserProfile(supabase);
        if (!user) {
          if (isMounted) setIsAdmin(false);
          document.body.classList.remove('is-admin');
          document.documentElement.classList.remove('is-admin');
          return;
        }

        const userIsAdmin = profile?.role === 'admin';
        if (isMounted) {
          setIsAdmin(userIsAdmin);
        }

        if (userIsAdmin) {
          document.body.classList.add('is-admin');
          document.documentElement.classList.add('is-admin');
        } else {
          document.body.classList.remove('is-admin');
          document.documentElement.classList.remove('is-admin');
        }
      } catch (err) {
        console.error('Error comprobando rol de administrador:', err);
      }
    }

    checkRole();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      checkRole();
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const showSecurityToast = (msg: string) => {
    // El administrador nunca recibe avisos ni bloqueos
    if (isAdmin) return;
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  useEffect(() => {
    // Si el usuario autenticado es administrador o la URL es de admin, LIBERTAD TOTAL:
    // Puedes copiar, pegar, hacer clic derecho, inspeccionar y hacer lo que quieras en cualquier página.
    if (isAdmin || pathname?.startsWith('/admin')) {
      return;
    }

    // 1. Bloqueo de Clic Derecho (Menú contextual) para alumnos
    const handleContextMenu = (e: MouseEvent) => {
      if (isAdmin) return;
      e.preventDefault();
      showSecurityToast('🔒 Función deshabilitada: Contenido académico protegido');
    };

    // 2. Bloqueo de Atajos de Teclado de Inspección y Copia masiva para alumnos
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAdmin) return;

      const isMac = typeof navigator !== 'undefined' && navigator.platform?.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // F12 (DevTools)
      if (e.key === 'F12') {
        e.preventDefault();
        showSecurityToast('🔒 Inspección de código deshabilitada');
        return;
      }

      // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C (DevTools)
      if (cmdOrCtrl && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) {
        e.preventDefault();
        showSecurityToast('🔒 Herramientas de desarrollador protegidas');
        return;
      }

      // Ctrl+U (Ver código fuente HTML)
      if (cmdOrCtrl && ['U', 'u'].includes(e.key)) {
        e.preventDefault();
        showSecurityToast('🔒 Visualización de código fuente bloqueada');
        return;
      }

      // Ctrl+S (Guardar página completa)
      if (cmdOrCtrl && ['S', 's'].includes(e.key)) {
        e.preventDefault();
        showSecurityToast('🔒 Guardado de página bloqueado');
        return;
      }

      // Ctrl+P (Imprimir)
      if (cmdOrCtrl && ['P', 'p'].includes(e.key)) {
        e.preventDefault();
        showSecurityToast('🔒 Impresión deshabilitada');
        return;
      }

      // Bloqueo de copia con Ctrl+C en zona de estudio para alumnos
      if (cmdOrCtrl && ['C', 'c'].includes(e.key) && pathname?.startsWith('/study')) {
        const target = e.target as HTMLElement;
        if (target && !['INPUT', 'TEXTAREA'].includes(target.tagName)) {
          e.preventDefault();
          showSecurityToast('🔒 El material de estudio está protegido contra copia');
        }
      }
    };

    // 3. Bloqueo de arrastre de imágenes y textos para alumnos
    const handleDragStart = (e: DragEvent) => {
      if (isAdmin) return;
      e.preventDefault();
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('dragstart', handleDragStart);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('dragstart', handleDragStart);
    };
  }, [isAdmin, pathname]);

  if (!toastMessage || isAdmin) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2.5 px-4 py-3 bg-slate-900/95 backdrop-blur-md text-white text-xs font-bold rounded-2xl shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-2 select-none">
      <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
      <span>{toastMessage}</span>
    </div>
  );
}
