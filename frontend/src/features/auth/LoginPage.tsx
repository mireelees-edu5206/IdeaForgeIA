import { type FormEvent, useState } from "react";
import { FiLogIn } from "react-icons/fi";
import { Link, useLocation, useNavigate } from "react-router";

import { AuthLayout } from "../../components/layout/AuthLayout";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { errorMessageFrom } from "../../lib/formErrors";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { useAuth } from "./AuthContext";
import { redirectTarget } from "./guards";

export function LoginPage() {
  useDocumentTitle("Iniciar sesión");
  const { login, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = redirectTarget(location.state);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessageFrom(err));
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Bienvenido de nuevo"
      subtitle="Continúa investigando y validando tus ideas de negocio."
      footer={
        <>
          ¿No tienes cuenta?{" "}
          <Link to="/registro" className="font-medium text-accent-cyan hover:underline">
            Crear una cuenta
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {sessionExpired && !error && <Alert tone="info">Tu sesión expiró. Inicia sesión de nuevo.</Alert>}
        {error && <Alert>{error}</Alert>}
        <TextField
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <TextField
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button
          type="submit"
          size="lg"
          loading={submitting}
          disabled={!email.trim() || !password}
          icon={<FiLogIn aria-hidden="true" />}
          className="mt-2"
        >
          Iniciar sesión
        </Button>
      </form>
    </AuthLayout>
  );
}
