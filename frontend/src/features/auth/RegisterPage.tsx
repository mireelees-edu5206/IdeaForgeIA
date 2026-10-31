/**
 * ARCHIVO: auth/RegisterPage.tsx
 *
 * ¿Qué es?
 * Es la pantalla "Crea tu cuenta", con cuatro campos: nombre completo, correo, contraseña y
 * confirmación de la contraseña.
 *
 * ¿Para qué sirve?
 * Crea una cuenta nueva. Antes de enviar nada revisa los campos aquí mismo (sin molestar al servidor)
 * y muestra mensajes claros debajo de cada casilla que tenga un problema.
 *
 * ¿Qué pasa después de registrarse?
 * - Si Supabase exige confirmar el correo: se muestra un aviso azul "Te enviamos un enlace de confirmación".
 * - Si no hace falta confirmar: la persona entra directo al panel de inicio.
 *
 * ¿Quién la usa?
 * La ruta /registro, protegida por GuestOnly (solo para quien NO tiene sesión).
 */

/* Tipos para el texto que escribe la persona y para el envío del formulario. */
import { type ChangeEvent, type FormEvent, useState } from "react";
/* Icono de "agregar persona" para el botón. */
import { FiUserPlus } from "react-icons/fi";
/* "Link" es un enlace interno. "useNavigate" cambia de página. */
import { Link, useNavigate } from "react-router";

/* Diseño común de las pantallas de entrada. */
import { AuthLayout } from "../../components/layout/AuthLayout";
/* Avisos, botón y campo de texto estándar. */
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
/* "errorMessageFrom" da un mensaje general. "fieldErrorsFrom" saca los errores de cada campo que manda el servidor. */
import { errorMessageFrom, fieldErrorsFrom } from "../../lib/formErrors";
/* Cambia el título de la pestaña del navegador. */
import { useDocumentTitle } from "../../lib/useDocumentTitle";
/* El cliente de Supabase (o null si no está configurado). */
import { supabase } from "../../lib/supabaseClient";
/* El hook que da acceso a la función de registro. */
import { useAuth } from "./AuthContext";

/**
 * PASSWORD_MIN_LENGTH es el número mínimo de caracteres de la contraseña: 8.
 * Está como constante para que el mensaje y la revisión usen siempre el mismo número.
 */
/** Define PASSWORD_MIN_LENGTH para el bloque de autenticacion. */
const PASSWORD_MIN_LENGTH = 8;

/**
 * RegisterPage dibuja el formulario de registro y coordina las revisiones y el envío.
 *
 * No recibe datos. Guarda lo que escribe la persona en un solo objeto ("form").
 */
/** Expone la funcion register page para el flujo de auth. */
export function RegisterPage() {
  // Título de la pestaña: "Crear cuenta".
  useDocumentTitle("Crear cuenta");
  // La función que crea la cuenta (viene del AuthProvider).
  const { register } = useAuth();
  // Para cambiar de página al terminar el registro.
  const navigate = useNavigate();

  // "form" guarda los cuatro campos juntos. Empiezan vacíos.
  const [form, setForm] = useState({ full_name: "", email: "", password: "", confirm: "" });
  // "fieldErrors" guarda un mensaje por campo con problemas. Es un diccionario: nombre del campo → mensaje.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Error general que no pertenece a un solo campo (por ejemplo, sin conexión).
  const [error, setError] = useState<string | null>(null);
  // true cuando el registro se envió y falta confirmar el correo. Cambia el aviso que se muestra.
  const [confirmationSent, setConfirmationSent] = useState(false);
  // true mientras se envía el registro (para la ruedita de carga).
  const [submitting, setSubmitting] = useState(false);

  /**
   * update crea la función que actualiza un campo concreto cada vez que la persona escribe.
   * Ejemplo: update("email") devuelve una función que cambia solo el campo "email".
   * El "...current" copia lo que ya estaba y luego cambia solo ese campo.
   */
  /** Define update para el bloque de autenticacion. */
  const update = (field: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  /**
   * validate revisa los campos en el navegador, antes de enviar nada al servidor.
   * Devuelve un diccionario con los errores encontrados. Si está vacío, todo está bien.
   */
  /** Valida validate de autenticacion. */
  function validate(): Record<string, string> {
    // Empezamos con un diccionario vacío de errores.
    const errors: Record<string, string> = {};
    // "trim()" quita espacios: un campo con solo espacios cuenta como vacío.
    /** Rama condicional: !form.full_name.trim(). */
    if (!form.full_name.trim()) errors.full_name = "Este campo no puede estar vacío.";
    /** Rama condicional: !form.email.trim(). */
    if (!form.email.trim()) errors.email = "Este campo es obligatorio.";
    // La contraseña debe tener al menos 8 caracteres.
    /** Rama condicional: form.password.length < PASSWORD_MIN_LENGTH. */
    if (form.password.length < PASSWORD_MIN_LENGTH)
      errors.password = `Debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
    // La confirmación debe ser idéntica a la contraseña, para evitar errores de escritura.
    /** Rama condicional: form.confirm !== form.password. */
    if (form.confirm !== form.password) errors.confirm = "Las contraseñas no coinciden.";
    return errors;
  }

  /**
   * handleSubmit se ejecuta al enviar el formulario. Primero revisa los campos; si todo está bien,
   * crea la cuenta y decide a dónde mandar a la persona.
   */
  /** Gestiona handle submit de autenticacion. */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Evita que la página se recargue al enviar.
    event.preventDefault();
    // Limpiamos los avisos anteriores.
    setError(null);
    setConfirmationSent(false);
    // Revisamos los campos y guardamos los errores para mostrarlos debajo de cada casilla.
    const errors = validate();
    setFieldErrors(errors);
    // Si hay errores, no seguimos: la persona debe corregirlos primero.
    /** Rama condicional: Object.keys(errors).length > 0. */
    if (Object.keys(errors).length > 0) return;

    // Todo bien: activamos la carga y enviamos el registro.
    setSubmitting(true);
    /** Maneja fallos de la operacion del bloque autenticacion. */
    try {
      // "needsConfirmation" es true si Supabase pide confirmar el correo antes de entrar.
      // Quitamos los espacios sobrantes del nombre y del correo antes de enviarlos.
      const needsConfirmation = await register({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      // Si hay que confirmar, mostramos el aviso azul. Si no, la cuenta ya está lista: entramos al panel.
      /** Rama condicional: needsConfirmation. */
      if (needsConfirmation) {
        setConfirmationSent(true);
      } else {
        navigate("/", { replace: true });
      }
    } catch (err) {
      // Si el servidor mandó errores específicos de algún campo (por ejemplo, correo ya registrado), los mostramos debajo de ese campo.
      const serverFieldErrors = fieldErrorsFrom(err);
      setFieldErrors(serverFieldErrors);
      // Si no hubo errores por campo, mostramos un mensaje general arriba del formulario.
      /** Rama condicional: Object.keys(serverFieldErrors).length === 0. */
      if (Object.keys(serverFieldErrors).length === 0) setError(errorMessageFrom(err));
      // Quitamos la carga para que pueda volver a intentarlo.
      setSubmitting(false);
    }
  }

  return (
    // El diseño común de las pantallas de entrada, con el título y el pie de "¿Ya tienes cuenta?".
    <AuthLayout
      title="Crea tu cuenta"
      subtitle="Guarda tu idea y sigue una guía sencilla para explorarla."
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          {/* Enlace para volver a la pantalla de inicio de sesión. */}
          <Link to="/iniciar-sesion" className="font-medium text-accent-cyan hover:underline">
            Iniciar sesión
          </Link>
        </>
      }
    >
      {/* El formulario. "noValidate" desactiva las revisiones del navegador: usamos las nuestras, en español. */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {/* Aviso si falta la configuración de Supabase. */}
        {!supabase && (
          <Alert>Falta configurar Supabase en las variables VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.</Alert>
        )}
        {/* Aviso azul después de registrarse: pide abrir el enlace que llegó al correo. */}
        {confirmationSent && (
          <Alert tone="info">
            Te enviamos un enlace de confirmación. Ábrelo desde tu correo para activar la cuenta y después inicia sesión.
          </Alert>
        )}
        {/* Error general en rojo (los errores de campo se muestran dentro de cada casilla). */}
        {error && <Alert>{error}</Alert>}
        {/* Cada campo recibe su función "update" para guardar lo que escribe, y su error (si tiene uno). */}
        <TextField
          label="Nombre completo"
          autoComplete="name"
          required
          value={form.full_name}
          onChange={update("full_name")}
          error={fieldErrors.full_name}
        />
        <TextField
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={update("email")}
          error={fieldErrors.email}
        />
        {/* La contraseña muestra una ayuda gris con el mínimo de caracteres. "new-password" indica al navegador que es una contraseña nueva. */}
        <TextField
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          required
          value={form.password}
          onChange={update("password")}
          error={fieldErrors.password}
          hint={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres. Una frase larga es más segura.`}
        />
        <TextField
          label="Confirmar contraseña"
          type="password"
          autoComplete="new-password"
          required
          value={form.confirm}
          onChange={update("confirm")}
          error={fieldErrors.confirm}
        />
        {/* El botón de crear cuenta. Se apaga si no hay Supabase. Muestra la carga mientras se envía. */}
        <Button
          type="submit"
          size="lg"
          loading={submitting}
          disabled={!supabase}
          icon={<FiUserPlus aria-hidden="true" />}
          className="mt-2"
        >
          Crear cuenta
        </Button>
      </form>
    </AuthLayout>
  );
}
