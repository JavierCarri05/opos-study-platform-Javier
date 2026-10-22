# 📚 OposTest PRO - Plataforma Privada de Estudio para Oposiciones

Plataforma web completa desarrollada con **Next.js (App Router)**, **TypeScript**, **Tailwind CSS** y **Supabase** (Auth, PostgreSQL y Row Level Security).

---

## 🚀 PASO A PASO PARA EMPEZAR A UTILIZARLA

### 1. Configurar la Base de Datos en Supabase
1. Entra en tu panel de [Supabase](https://supabase.com).
2. Si aún no tienes un proyecto, crea uno nuevo.
3. En el menú lateral izquierdo, haz clic en **SQL Editor**.
4. Abre el archivo [`supabase_setup.sql`](file:///C:/Users/david/.gemini/antigravity-ide/scratch/opos-study-platform/supabase_setup.sql) ubicado en la raíz de este proyecto, copia todo su contenido, pégalo en el editor SQL de Supabase y haz clic en **RUN**.
5. ¡Listo! Ya tienes creadas todas las tablas (`profiles`, `topics`, `subtopics`, `questions`, `exam_attempts`), disparadores y políticas de seguridad (RLS).

---

### 2. Configurar las Claves de Supabase en el Proyecto
1. En tu panel de Supabase, ve a **Project Settings** (el icono de engranaje) > **API**.
2. Copia la **Project URL** y la **Project API Keys (anon public)**.
3. Abre el archivo [`.env.local`](file:///C:/Users/david/.gemini/antigravity-ide/scratch/opos-study-platform/.env.local) en este proyecto y sustituye los valores:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

---

### 3. Poner en Marcha la Plataforma en tu Ordenador
Abre una terminal en la carpeta del proyecto y ejecuta:

```bash
npm run dev
```

Abre tu navegador en [http://localhost:3000](http://localhost:3000).

---

### 4. Crear tu Cuenta y Asignarte como Administrador
1. En la web, haz clic en **Solicitar Acceso** o entra en `/register`.
2. Regístrate con tu email y contraseña.
3. Por defecto, tu cuenta quedará en estado `pending` (pendiente).
4. Para convertirte en el **Administrador**:
   - Ve a tu panel de Supabase > **Table Editor** > tabla `profiles`.
   - Busca la fila con tu correo electrónico.
   - Cambia el campo `role` a: `admin`.
   - Cambia el campo `status` a: `approved`.
5. Vuelve a la web, recarga la página o inicia sesión en `/login` y accederás con todos los privilegios de Administrador.

---

## 🛠️ FUNCIONALIDADES IMPLEMENTADAS

### 👤 1. Seguridad y Control de Acceso
- **Acceso Privado**: Cualquier opositor que se registre queda bloqueado en la pantalla de *Acceso Pendiente de Autorización* (`/pending`).
- **Panel de Usuarios (`/admin/users`)**: Solo visible para ti como administrador, donde puedes **Aprobar** o **Revocar** acceso a cada alumno con un clic.

### 📚 2. Estructura Jerárquica del Temario
- **Gestión de Temas y Subapartados (`/admin/topics`)**: CRUD visual e intuitivo para crear temas (Tema 1, Tema 2...) y sus subdivisiones (1.1, 1.2...).
- **Banco de Preguntas (`/admin/questions`)**: Creación de preguntas con 4 opciones (A, B, C, D), marcación de la correcta y redacción del artículo de ley / justificación oficial.

### ⏱️ 3. Modo Examen / Simulacro (`/study/exam`)
- Selección de temas o temario completo.
- Selección de longitud: **25, 50 u 80 preguntas**.
- **Temporizador en cuenta atrás** con advertencias visuales de tiempo.
- Navegación ágil, mapa de preguntas y opción de **Marcar para revisar**.
- **Corrección Oficial con Penalización**: 3 fallos restan 1 acierto (-0.33 por fallo).
- Revisión completa pregunta a pregunta con la fundamentación legal.

### 🧠 4. Modo Repaso Activo / Anki (`/study/anki`)
- Selección de temas a memorizar.
- **Feedback Inmediato**: nada más pulsar una opción se descubre si es correcta y se despliega la explicación legal.
- **Algoritmo de Repetición Espaciada**: botones **Fácil**, **Regular** y **Difícil**. Las preguntas dudosas o falladas se reinsertan en la cola de la sesión activa hasta que las domines.


