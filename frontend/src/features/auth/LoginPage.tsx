import { type FormEvent, useState } from "react";
import { FiLogIn } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import { Link, useLocation, useNavigate } from "react-router";

import { AuthLayout } from "../../components/layout/AuthLayout";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { errorMessageFrom } from "../../lib/formErrors";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "./AuthContext";
import { redirectTarget } from "./guards";

export function LoginPage() {
  useDocumentTitle("Iniciar sesión");
  const { login, loginWithGoogle, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = redirectTarget(location.state);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

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

  async function handleGoogleLogin() {
    setError(null);
    setGoogleSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(errorMessageFrom(err));
      setGoogleSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Bienvenido de nuevo"
      subtitle="Vuelve a tus proyectos. Si eres nuevo, crea una cuenta y te guiaremos paso a paso."
      footer={
        <>
          ¿Primera vez en IdeaForge?{" "}
          <Link to="/registro" className="font-medium text-accent-cyan hover:underline">
            Crear una cuenta
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {!supabase && (
          <Alert>Falta configurar Supabase en las variables VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.</Alert>
        )}
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
          disabled={!supabase || !email.trim() || !password || googleSubmitting}
          icon={<FiLogIn aria-hidden="true" />}
          className="mt-2"
        >
          Iniciar sesión
        </Button>
      </form>
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="h-px flex-1 bg-border" />
          <span>o continúa con</span>
          <span className="h-px flex-1 bg-border" />
        </div>
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
