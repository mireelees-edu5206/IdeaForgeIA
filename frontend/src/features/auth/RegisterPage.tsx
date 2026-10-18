import { type ChangeEvent, type FormEvent, useState } from "react";
import { FiUserPlus } from "react-icons/fi";
import { Link, useNavigate } from "react-router";

import { AuthLayout } from "../../components/layout/AuthLayout";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { errorMessageFrom, fieldErrorsFrom } from "../../lib/formErrors";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { useAuth } from "./AuthContext";

const PASSWORD_MIN_LENGTH = 8;

export function RegisterPage() {
  useDocumentTitle("Crear cuenta");
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ full_name: "", email: "", password: "", confirm: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!form.full_name.trim()) errors.full_name = "Este campo no puede estar vacío.";
    if (!form.email.trim()) errors.email = "Este campo es obligatorio.";
    if (form.password.length < PASSWORD_MIN_LENGTH)
      errors.password = `Debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
    if (form.confirm !== form.password) errors.confirm = "Las contraseñas no coinciden.";
    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await register({ full_name: form.full_name.trim(), email: form.email.trim(), password: form.password });
      navigate("/", { replace: true });
    } catch (err) {
      const serverFieldErrors = fieldErrorsFrom(err);
      setFieldErrors(serverFieldErrors);
      if (Object.keys(serverFieldErrors).length === 0) setError(errorMessageFrom(err));
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Crea tu cuenta"
      subtitle="Estructura tu idea y descubre qué dice la evidencia."
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link to="/iniciar-sesion" className="font-medium text-accent-cyan hover:underline">
            Iniciar sesión
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {error && <Alert>{error}</Alert>}
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
        <Button type="submit" size="lg" loading={submitting} icon={<FiUserPlus aria-hidden="true" />} className="mt-2">
          Crear cuenta
        </Button>
      </form>
    </AuthLayout>
  );
}
