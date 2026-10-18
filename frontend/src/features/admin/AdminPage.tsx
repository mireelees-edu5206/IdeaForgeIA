import {
  FiActivity,
  FiAlertCircle,
  FiCheckCircle,
  FiCpu,
  FiFolder,
  FiRefreshCw,
  FiShield,
  FiUsers,
} from "react-icons/fi";

import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { CrucibleGlyph } from "../../components/ui/ForgeGlyphs";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Spinner } from "../../components/ui/Spinner";
import { formatDateTime } from "../../lib/formatDate";
import { errorMessageFrom } from "../../lib/formErrors";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { useAuth } from "../auth/AuthContext";
import { PageHeader } from "../projects/components/PageHeader";
import { STATUS_META } from "../projects/constants";
import type { ProjectStatus } from "../projects/types";
import { PROVIDER_LABELS } from "../research/constants";
import { useAdminOverview, useAdminUsers, useUpdateAdminUser } from "./queries";
import type { AIOperation, AdminUser } from "./types";

const OPERATION_LABELS: Record<AIOperation, string> = {
  idea_structuring: "Estructuración de idea",
  research_planning: "Plan de investigación",
  grounded_search: "Búsqueda web",
  extraction: "Extracción de hallazgos",
  analysis: "Análisis de cuadrantes",
  report_generation: "Generación de informe",
  chat: "Asistente contextual",
};

function MetricTile({
  label,
  value,
  sublabel,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sublabel: string;
  icon: typeof FiUsers;
}) {
  return (
    <GlassPanel className="flex flex-col justify-between gap-3 rounded-3xl p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono-tech text-xs font-semibold tracking-wider text-slate-400 uppercase">
          {label}
        </span>
        <span className="neo-raised grid size-9 place-items-center rounded-xl text-accent-cyan">
          <Icon aria-hidden="true" className="size-4" />
        </span>
      </div>
      <div>
        <p className="font-display text-3xl font-bold tracking-tight tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-slate-400">{sublabel}</p>
      </div>
    </GlassPanel>
  );
}

function UserRow({ item, currentUserId }: { item: AdminUser; currentUserId?: string }) {
  const updateUser = useUpdateAdminUser();
  const isSelf = item.id === currentUserId;

  return (
    <li className="flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-semibold text-slate-100">{item.full_name}</p>
          <Badge
            className={
              item.role === "admin"
                ? "bg-accent-cyan/15 text-accent-cyan ring-accent-cyan/35"
                : "bg-slate-400/15 text-slate-300 ring-slate-300/25"
            }
          >
            {item.role === "admin" ? "Administrador" : "Investigador"}
          </Badge>
          {!item.is_active && (
            <Badge className="bg-rose-500/15 text-rose-200 ring-rose-400/35">Suspendido</Badge>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-400">{item.email}</p>
        <p className="mt-1 text-xs text-slate-400">
          {item.project_count} {item.project_count === 1 ? "proyecto" : "proyectos"} ·{" "}
          {item.research_run_count}{" "}
          {item.research_run_count === 1 ? "investigación" : "investigaciones"} · Registro:{" "}
          <time dateTime={item.created_at}>{formatDateTime(item.created_at)}</time>
        </p>
        {updateUser.isError && (
          <div className="mt-2">
            <Alert>{errorMessageFrom(updateUser.error)}</Alert>
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={isSelf || updateUser.isPending}
          onClick={() =>
            updateUser.mutate({
              userId: item.id,
              data: { role: item.role === "admin" ? "user" : "admin" },
            })
          }
        >
          {item.role === "admin" ? "Cambiar a investigador" : "Hacer administrador"}
        </Button>
        <Button
          size="sm"
          variant={item.is_active ? "danger" : "secondary"}
          disabled={isSelf || updateUser.isPending}
          onClick={() =>
            updateUser.mutate({
              userId: item.id,
              data: { is_active: !item.is_active },
            })
          }
        >
          {item.is_active ? "Desactivar" : "Reactivar"}
        </Button>
      </div>
    </li>
  );
}

export function AdminPage() {
  useDocumentTitle("Administración");
  const { user } = useAuth();
  const overview = useAdminOverview();
  const users = useAdminUsers();

  if (overview.isPending || users.isPending) {
    return (
      <div role="status" className="flex items-center justify-center gap-3 py-24 text-slate-300">
        <Spinner className="size-5 text-accent-cyan" /> Cargando centro de mando…
      </div>
    );
  }

  if (overview.isError || users.isError) {
    const err = overview.error ?? users.error;
    return (
      <GlassPanel className="flex flex-col items-start gap-4 p-6">
        <Alert>{errorMessageFrom(err)}</Alert>
        <Button
          variant="secondary"
          icon={<FiRefreshCw aria-hidden="true" />}
          onClick={() => {
            void overview.refetch();
            void users.refetch();
          }}
        >
          Reintentar
        </Button>
      </GlassPanel>
    );
  }

  const data = overview.data;

  return (
    <div className="flex animate-fade-up flex-col gap-6">
      <GlassPanel className="stage-3d rounded-3xl p-6 sm:p-8">
        <PageHeader
          eyebrow="Centro de control · Rol Administrador"
          title="Panel de Administración"
          description="Supervisa cuentas de investigadores, métricas globales de validación y telemetría de llamadas a proveedores de IA (Gemini y Ollama)."
          actions={
            <Button
              variant="secondary"
              size="sm"
              icon={<FiRefreshCw aria-hidden="true" />}
              onClick={() => {
                void overview.refetch();
                void users.refetch();
              }}
            >
              Actualizar métricas
            </Button>
          }
        />
      </GlassPanel>

      {/* Tarjetas de métricas globales */}
      <section aria-label="Métricas globales" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Usuarios"
          value={data.total_users}
          sublabel={`${data.active_users} activos · ${data.admin_users} admin`}
          icon={FiUsers}
        />
        <MetricTile
          label="Proyectos"
          value={data.total_projects}
          sublabel={`${data.projects_by_status.analyzed ?? 0} analizados · ${data.total_reports} informes`}
          icon={FiFolder}
        />
        <MetricTile
          label="Investigaciones"
          value={data.total_research_runs}
          sublabel={`${data.completed_research_runs} completadas · ${data.failed_research_runs} fallidas`}
          icon={FiActivity}
        />
        <MetricTile
          label="Llamadas a IA"
          value={data.total_ai_calls}
          sublabel={`${data.total_findings} hallazgos extraídos con evidencia`}
          icon={FiCpu}
        />
      </section>

      {/* Desglose por proveedor de IA y estado de proyectos */}
      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <GlassPanel className="flex flex-col gap-4 rounded-3xl p-6">
          <div className="flex items-center gap-2.5">
            <CrucibleGlyph className="size-5 text-accent-cyan" />
            <div>
              <h2 className="font-display text-lg font-bold">Rendimiento por proveedor de IA</h2>
              <p className="text-xs text-slate-400">
                Auditoría agregada de <code className="font-mono-tech">ai_api_logs</code> (sin exponer prompts ni claves).
              </p>
            </div>
          </div>

          {data.ai_by_provider.length === 0 ? (
            <p className="neo-inset rounded-2xl p-4 text-sm text-slate-400">
              Aún no se registran llamadas a proveedores de IA.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.ai_by_provider.map((item) => (
                <div key={item.provider} className="neo-inset flex flex-col gap-2.5 rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-bold text-slate-100">
                      {PROVIDER_LABELS[item.provider]}
                    </span>
                    <span className="font-mono-tech text-xs font-semibold text-accent-cyan tabular-nums">
                      {item.total_calls} llamadas
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                    <span>Éxito: {item.success_calls}</span>
                    <span>Errores: {item.error_calls}</span>
                    <span>
                      Latencia media:{" "}
                      {item.avg_latency_ms != null ? `${item.avg_latency_ms} ms` : "—"}
                    </span>
                    <span>Búsquedas web: {item.search_queries}</span>
                    <span>Tokens entrada: {item.input_tokens}</span>
                    <span>Tokens salida: {item.output_tokens}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>

        <GlassPanel className="flex flex-col gap-4 rounded-3xl p-6">
          <div className="flex items-center gap-2.5">
            <FiShield aria-hidden="true" className="size-5 text-accent-violet" />
            <div>
              <h2 className="font-display text-lg font-bold">Distribución de proyectos</h2>
              <p className="text-xs text-slate-400">Estado actual de todas las ideas en la plataforma</p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3">
            {(Object.keys(STATUS_META) as ProjectStatus[]).map((statusKey) => (
              <div key={statusKey} className="neo-inset rounded-2xl p-3.5">
                <dt className="text-xs text-slate-400">{STATUS_META[statusKey].label}</dt>
                <dd className="font-display mt-1 text-2xl font-bold tabular-nums">
                  {data.projects_by_status[statusKey] ?? 0}
                </dd>
              </div>
            ))}
          </dl>
        </GlassPanel>
      </div>

      {/* Gestión de usuarios */}
      <GlassPanel className="flex flex-col gap-4 rounded-3xl p-6">
        <div>
          <h2 className="font-display text-lg font-bold">Cuentas registradas ({users.data.length})</h2>
          <p className="text-xs text-slate-400">
            Administra roles o suspende el acceso (revoca inmediatamente sus tokens de sesión).
          </p>
        </div>

        <ul className="divide-y divide-slate-400/15">
          {users.data.map((item) => (
            <UserRow key={item.id} item={item} currentUserId={user?.id} />
          ))}
        </ul>
      </GlassPanel>

      {/* Registro reciente de llamadas a la IA */}
      <GlassPanel className="flex flex-col gap-4 rounded-3xl p-6">
        <div>
          <h2 className="font-display text-lg font-bold">Bitácora reciente de llamadas a IA</h2>
          <p className="text-xs text-slate-400">
            Últimas 25 operaciones registradas en la base de datos.
          </p>
        </div>

        {data.recent_ai_logs.length === 0 ? (
          <p className="neo-inset rounded-2xl p-4 text-sm text-slate-400">
            Todavía no hay registros en la bitácora.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-xs">
              <thead className="border-b border-slate-400/20 text-slate-400">
                <tr>
                  <th className="py-2.5 pr-3">Fecha</th>
                  <th className="py-2.5 pr-3">Operación</th>
                  <th className="py-2.5 pr-3">Proveedor / Modelo</th>
                  <th className="py-2.5 pr-3">Proyecto / Usuario</th>
                  <th className="py-2.5 pr-3">Estado</th>
                  <th className="py-2.5 text-right">Latencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-400/15 text-slate-200">
                {data.recent_ai_logs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2.5 pr-3 whitespace-nowrap text-slate-400">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="py-2.5 pr-3 font-medium">
                      {OPERATION_LABELS[log.operation] ?? log.operation}
                    </td>
                    <td className="py-2.5 pr-3">
                      {PROVIDER_LABELS[log.provider]} ·{" "}
                      <span className="font-mono-tech text-slate-400">{log.model}</span>
                    </td>
                    <td className="max-w-52 truncate py-2.5 pr-3 text-slate-300">
                      {log.project_title ?? "—"} {log.user_email ? `(${log.user_email})` : ""}
                    </td>
                    <td className="py-2.5 pr-3">
                      {log.status === "success" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-300">
                          <FiCheckCircle aria-hidden="true" /> OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-300">
                          <FiAlertCircle aria-hidden="true" /> {log.error_code ?? "error"}
                        </span>
                      )}
                    </td>
                    <td className="font-mono-tech py-2.5 text-right tabular-nums">
                      {log.latency_ms != null ? `${log.latency_ms} ms` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
