/**
 * ARCHIVO: auth/LoginPage.tsx
 *
 * ¿Qué es?
 * Es la pantalla "Bienvenido de nuevo", donde la persona entra a IdeaForge. Tiene un formulario
 * con correo y contraseña, un botón para entrar y un botón para "Continuar con Google".
 *
 * ¿Para qué sirve?
 * Es la puerta de entrada de la cuenta. Desde aquí se llama a Supabase (el servicio que valida
 * la contraseña) y, si todo sale bien, se manda a la persona a la pantalla que quería visitar.
 *
 * ¿Quién la usa?
 * Las rutas de invitado (/iniciar-sesion), protegidas por guards.tsx (GuestOnly). Si la persona
 * ya tiene sesión, esta pantalla ni se muestra.
 *
 * ¿Qué ve la persona en cada caso?
 * - Campos vacíos: el botón "Iniciar sesión" está apagado.
 * - Mientras se valida: el botón muestra la ruedita de carga y no se puede tocar.
 * - Si la contraseña está mal: aparece un aviso rojo con el mensaje en español.
 * - Si la sesión caducó: aparece un aviso azul pidiendo que inicie sesión de nuevo.
 * - Si falta configurar Supabase: aparece un aviso y los botones quedan apagados.
 */

/* "FormEvent" es el tipo del evento al enviar un formulario. "useState" guarda lo que escribe la persona. */
import { type FormEvent, useState } from "react";
/* Icono de "entrar" para el botón de iniciar sesión. */
import { FiLogIn } from "react-icons/fi";
/* El logotipo de Google para el botón de Google. */
import { FcGoogle } from "react-icons/fc";
/* "Link" es un enlace interno. "useLocation" dice en qué página estamos. "useNavigate" cambia de página a la fuerza. */
import { Link, useLocation, useNavigate } from "react-router";

/* El diseño común de las pantallas de entrada (presentación, tarjeta y pie). */
import { AuthLayout } from "../../components/layout/AuthLayout";
/* Avisos de error o información. */
import { Alert } from "../../components/ui/Alert";
/* Botón estándar. */
import { Button } from "../../components/ui/Button";
/* Campo de texto con etiqueta. */
import { TextField } from "../../components/ui/TextField";
/* "errorMessageFrom" convierte cualquier error en un texto que se pueda mostrar. */
import { errorMessageFrom } from "../../lib/formErrors";
/* Cambia el título de la pestaña del navegador. */
import { useDocumentTitle } from "../../lib/useDocumentTitle";
/* El cliente de Supabase (o null si no está configurado). */
import { supabase } from "../../lib/supabaseClient";
/* El hook que da acceso a la sesión (función de entrar, Google y estado de expiración). */
import { useAuth } from "./AuthContext";
/* Lee a dónde quería ir la persona antes de tener que entrar. */
import { redirectTarget } from "./guards";

/**
 * LoginPage dibuja la pantalla de inicio de sesión y maneja sus dos formas de entrar.
 *
 * No recibe datos: toma todo del estado de la sesión y de la dirección actual.
 */
/** Expone la funcion login page para el flujo de auth. */
export function LoginPage() {
  // Pone "Iniciar sesión" como título de la pestaña del navegador.
  useDocumentTitle("Iniciar sesión");
  // Sacamos de la sesión: la función de entrar con correo, la de entrar con Google y si la sesión caducó.
  const { login, loginWithGoogle, sessionExpired } = useAuth();
  // "navigate" nos permite cambiar de página después de entrar.
  const navigate = useNavigate();
  // "location" tiene la dirección actual y el mensaje "from" que dejó RequireAuth (a dónde quería ir).
  const location = useLocation();
  // Calculamos la dirección de destino. Si no hay ninguna, será "/" (el panel de inicio).
  const from = redirectTarget(location.state);

  // Lo que la persona escribe en el correo y en la contraseña.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // El mensaje de error que se muestra (null si no hay error).
  const [error, setError] = useState<string | null>(null);
  // true mientras se valida el correo y la contraseña (para la ruedita de carga del botón).
  const [submitting, setSubmitting] = useState(false);
  // true mientras se espera la respuesta de Google.
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  /**
   * handleSubmit se ejecuta al enviar el formulario (al pulsar "Iniciar sesión" o Enter).
   * Recibe el evento del formulario, que usamos para evitar que la página se recargue.
   */
  /** Gestiona handle submit de autenticacion. */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Evita que el navegador recargue la página al enviar el formulario (comportamiento normal de HTML que aquí no queremos).
    event.preventDefault();
    // Limpiamos el error anterior y activamos la carga.
    setError(null);
    setSubmitting(true);
    // "try" intenta entrar; "catch" recibe cualquier error y lo muestra.
    /** Maneja fallos de la operacion del bloque autenticacion. */
    try {
      // "trim()" quita espacios sobrantes del correo (por ejemplo, uno que se pegó con un espacio al final).
      await login({ email: email.trim(), password });
      // Si entró, lo mandamos a la página que quería visitar. "replace" evita que "atrás" regrese al formulario.
      navigate(from, { replace: true });
    } catch (err) {
      // Convertimos el error en un texto claro y lo mostramos.
      setError(errorMessageFrom(err));
      // Quitamos la carga para que la persona pueda volver a intentarlo.
      setSubmitting(false);
    }
  }

  /**
   * handleGoogleLogin se ejecuta al pulsar "Continuar con Google". Supabase lleva a la persona
   * a la pantalla de Google; cuando termina, regresa a la app ya con sesión.
   */
  /** Gestiona handle google login de autenticacion. */
  async function handleGoogleLogin() {
    setError(null);
    setGoogleSubmitting(true);
    /** Maneja fallos de la operacion del bloque autenticacion. */
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(errorMessageFrom(err));
      // Solo quitamos la carga si hubo error. Si todo salió bien, la página se va de aquí y no hace falta.
      setGoogleSubmitting(false);
    }
  }

  return (
    // El diseño común (AuthLayout) recibe el título, el subtítulo, el pie y el formulario como contenido.
    <AuthLayout
      title="Bienvenido de nuevo"
      subtitle="Vuelve a tus proyectos. Si eres nuevo, crea una cuenta y te guiaremos paso a paso."
      footer={
        <>
          ¿Primera vez en IdeaForge?{" "}
          {/* Enlace a la pantalla de registro. */}
          <Link to="/registro" className="font-medium text-accent-cyan hover:underline">
            Crear una cuenta
          </Link>
        </>
      }
    >
      {/* El formulario. "noValidate" desactiva las revisiones automáticas del navegador, porque las hacemos nosotros con mensajes en español. */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {/* Aviso si falta la configuración de Supabase (las variables de entorno). Solo aparece en ese caso. */}
        {!supabase && (
          <Alert>Falta configurar Supabase en las variables VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.</Alert>
        )}
        {/* Aviso azul de sesión caducada. No se muestra si ya hay un error en pantalla, para no mezclar dos avisos. */}
        {sessionExpired && !error && <Alert tone="info">Tu sesión expiró. Inicia sesión de nuevo.</Alert>}
        {/* El error de entrar (por ejemplo, contraseña equivocada), en rojo. */}
        {error && <Alert>{error}</Alert>}
        {/* Campo de correo. "autoComplete" ayuda al navegador a sugerir el correo guardado. */}
        <TextField
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {/* Campo de contraseña. Trae el botón de mostrar/ocultar (ver TextField.tsx). */}
        <TextField
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {/* El botón de entrar. Se apaga si: no hay Supabase, falta el correo o la contraseña, o está esperando a Google. */}
        <Button
          type="submit"
          size="lg"
          loading={submitting}
          disabled={!supabase || !email.trim() || !password || googleSubmitting}
          icon={<FiLogIn aria-hidden="true" />}
          className="mt-2"
        >
          Iniciar sesión
        </Button>
      </form>
      {/* La línea separadora con el texto "o continúa con", y debajo el botón de Google. */}
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {/* Dos líneas a los lados del texto. "flex-1" hace que ocupen el espacio sobrante. */}
          <span className="h-px flex-1 bg-border" />
          <span>o continúa con</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        {/* El botón de Google. Se apaga si no hay Supabase o si el formulario de correo está enviándose. */}
        <Button
          type="button"
          variant="secondary"
          size="lg"
          loading={googleSubmitting}
          disabled={!supabase || submitting}
          icon={<FcGoogle aria-hidden="true" />}
          onClick={() => void handleGoogleLogin()}
        >
          Continuar con Google
        </Button>
      </div>
    </AuthLayout>
  );
}
