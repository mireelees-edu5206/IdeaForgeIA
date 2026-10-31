/**
 * ARCHIVO: admin/AdminPage.tsx
 *
 * ¿Qué es?
 * Es el "centro de mando" del administrador (ruta "/admin"). Muestra las métricas de la plataforma,
 * el rendimiento de cada proveedor de IA, cuántos proyectos hay en cada estado, la lista de cuentas
 * (para cambiar roles, suspender o borrar), y la bitácora de las últimas llamadas a la IA.
 *
 * ¿Para qué sirve?
 * Para vigilar la plataforma: ver cuánto se usa la IA, si hay errores, y administrar las cuentas.
 *
 * ¿Quién la usa?
 * Solo las cuentas con rol de administrador. La ruta está protegida por RequireAdmin (app/router.tsx).
 *
 * Qué ve la persona:
 * - Un encabezado con el botón "Laboratorio de algoritmos" y el botón "Actualizar métricas".
 * - Cuatro tarjetas de totales: usuarios, proyectos, investigaciones y llamadas a IA.
 * - Un panel por proveedor de IA y otro con la distribución de proyectos por estado.
 * - La lista de cuentas, con botones para cambiar rol, activar o suspender y eliminar.
 * - La bitácora de las últimas 25 llamadas a la IA (sin prompts ni claves).
 */

/* "useState" guarda si el diálogo de borrar una cuenta está abierto (dentro de UserRow). */
import { useState } from "react";
/* Iconos: actividad, alerta, libro, check, CPU, carpeta, recargar, escudo, basura y grupo de personas. */
import {
  FiActivity,
  FiAlertCircle,
  FiBookOpen,
  FiCheckCircle,
  FiCpu,
  FiFolder,
  FiRefreshCw,
  FiShield,
  FiTrash2,
  FiUsers,
} from "react-icons/fi";

/* Piezas visuales compartidas. */
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { CrucibleGlyph } from "../../components/ui/ForgeGlyphs";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { LinkButton } from "../../components/ui/LinkButton";
import { Spinner } from "../../components/ui/Spinner";
/* Formato de fecha, convertidor de errores y título de la pestaña del navegador. */
import { formatDateTime } from "../../lib/formatDate";
import { errorMessageFrom } from "../../lib/formErrors";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
/* Usuario que tiene la sesión abierta (para no permitir que se cambie a sí mismo). */
import { useAuth } from "../auth/AuthContext";
/* Cabecera de página y textos de estado de proyecto (carpeta de proyectos). */
import { PageHeader } from "../projects/components/PageHeader";
import { STATUS_META } from "../projects/constants";
import type { ProjectStatus } from "../projects/types";
/* Nombres en español de cada proveedor de IA (carpeta de investigación). */
import { PROVIDER_LABELS } from "../research/constants";
/* Consultas y acciones del panel, desde la caché. */
import { useAdminOverview, useAdminUsers, useDeleteAdminUser, useUpdateAdminUser } from "./queries";
import type { AIOperation, AdminUser } from "./types";

/**
 * OPERATION_LABELS da el nombre en español de cada operación de IA, para la bitácora.
 * Por ejemplo, "grounded_search" se muestra como "Búsqueda web".
 */
/** Catalogo OPERATION_LABELS que define etiquetas o reglas de administracion. */
const OPERATION_LABELS: Record<AIOperation, string> = {
  idea_structuring: "Estructuración de idea",
  research_planning: "Plan de investigación",
  grounded_search: "Búsqueda web",
  extraction: "Extracción de hallazgos",
  analysis: "Análisis de cuadrantes",
  report_generation: "Generación de informe",
  chat: "Asistente contextual",
};

/**
 * MetricTile dibuja una tarjeta de total: un título pequeño, un icono, el número grande y una línea de detalle.
 *
 * Recibe:
 * - label: el título de la tarjeta (en mayúsculas).
 * - value: el número o texto grande.
 * - sublabel: la línea pequeña de abajo con más detalle.
 * - icon: el icono que aparece a la derecha del título.
 */
/** Componente MetricTile: renderiza la vista de administracion. */
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
        {/* "tabular-nums" hace que los números tengan el mismo ancho, para que no "bailen" al cambiar. */}
        <p className="font-display text-3xl font-bold tracking-tight tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-slate-400">{sublabel}</p>
      </div>
    </GlassPanel>
  );
}

/**
 * UserRow dibuja una cuenta de la lista, con sus botones de administración.
 *
 * Recibe:
 * - item: la cuenta (nombre, correo, rol, si está activa, cuántos proyectos tiene, etc.).
 * - currentUserId: el id de quien está usando el panel (puede faltar si la sesión no cargó).
 *
 * Reglas de los botones:
 * - Cambiar rol, activar/desactivar y eliminar están DESACTIVADOS para tu propia cuenta (isSelf),
 *   para que un administrador no se quite el acceso por accidente.
 * - Eliminar abre una ventana de confirmación antes de borrar.
 * - Mientras una acción está en curso, los botones se bloquean para evitar clics repetidos.
 */
/** Componente UserRow: renderiza la vista de administracion. */
function UserRow({ item, currentUserId }: { item: AdminUser; currentUserId?: string }) {
  // Las dos acciones de la cuenta: cambiar (rol o estado) y borrar.
  const updateUser = useUpdateAdminUser();
  const deleteUser = useDeleteAdminUser();
  // Si la ventana de confirmación de borrar está abierta.
  const [confirmDelete, setConfirmDelete] = useState(false);
  // ¿Esta cuenta es la que está usando el panel? Si sí, sus botones se bloquean.
  const isSelf = item.id === currentUserId;

  return (
    <li className="flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {/* El nombre. "truncate" lo corta con puntos suspensivos si es muy largo. */}
          <p className="truncate font-semibold text-slate-100">{item.full_name}</p>
          {/* La etiqueta del rol: cian para administrador, gris para investigador. */}
          <Badge
            className={
              item.role === "admin"
                ? "bg-accent-cyan/15 text-accent-cyan ring-accent-cyan/35"
                : "bg-slate-400/15 text-slate-300 ring-slate-300/25"
            }
          >
            {item.role === "admin" ? "Administrador" : "Investigador"}
          </Badge>
          {/* Si la cuenta está suspendida, una etiqueta roja. */}
          {!item.is_active && (
            <Badge className="bg-rose-500/15 text-rose-200 ring-rose-400/35">Suspendido</Badge>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-400">{item.email}</p>
        {/* Cuántos proyectos e investigaciones tiene, y cuándo se registró. "time" marca la fecha para lectores. */}
        <p className="mt-1 text-xs text-slate-400">
          {item.project_count} {item.project_count === 1 ? "proyecto" : "proyectos"} ·{" "}
          {item.research_run_count}{" "}
          {item.research_run_count === 1 ? "investigación" : "investigaciones"} · Registro:{" "}
          <time dateTime={item.created_at}>{formatDateTime(item.created_at)}</time>
        </p>
        {/* El error de cambiar la cuenta, si lo hubo. */}
        {updateUser.isError && (
          <div className="mt-2">
            <Alert>{errorMessageFrom(updateUser.error)}</Alert>
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {/* Cambiar rol: si es administrador, lo pasa a investigador; si no, lo hace administrador. */}
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
        {/* Suspender o reactivar. "!item.is_active" invierte el valor: si estaba activa, la suspende. */}
        <Button
          size="sm"
          variant={item.is_active ? "danger" : "secondary"}
          disabled={isSelf || updateUser.isPending || deleteUser.isPending}
          onClick={() =>
            updateUser.mutate({
              userId: item.id,
              data: { is_active: !item.is_active },
            })
          }
        >
          {item.is_active ? "Desactivar" : "Reactivar"}
        </Button>
        {/* Eliminar: abre la confirmación. No borra nada hasta que la persona confirme. */}
        <Button
          size="sm"
          variant="danger"
          icon={<FiTrash2 aria-hidden="true" />}
          disabled={isSelf || deleteUser.isPending}
          onClick={() => setConfirmDelete(true)}
        >
          Eliminar cuenta
        </Button>
      </div>

      {/* La ventana de confirmación de borrar. Al confirmar, borra y cierra la ventana si sale bien. */}
      <ConfirmDialog
        open={confirmDelete}
        title="¿Eliminar esta cuenta definitivamente?"
        confirmLabel="Eliminar cuenta"
        loading={deleteUser.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => deleteUser.mutate(item.id, { onSuccess: () => setConfirmDelete(false) })}
      >
        <p>
          Se eliminará la cuenta de <strong className="text-slate-100">{item.full_name}</strong> y también sus
          proyectos, investigaciones, resultados e informes. Esta acción no se puede deshacer.
        </p>
        {/* Si borrar falló, el motivo aparece dentro de la ventana. */}
        {deleteUser.isError && (
          <div className="mt-3">
            <Alert>{errorMessageFrom(deleteUser.error)}</Alert>
          </div>
        )}
      </ConfirmDialog>
    </li>
  );
}

/**
 * AdminPage dibuja el panel completo. Pide el resumen y las cuentas, y muestra:
 * cargando (ruedita), error (aviso con botón de reintentar) o el panel con todos sus paneles.
 */
/** Expone la funcion admin page para el flujo de admin. */
export function AdminPage() {
  // Cambia el título de la pestaña del navegador a "Administración".
  useDocumentTitle("Administración");
  // La cuenta que tiene la sesión abierta.
  const { user } = useAuth();
  // El resumen general y la lista de cuentas. Son dos peticiones separadas.
  const overview = useAdminOverview();
  const users = useAdminUsers();

  // Caso 1: cargando. Si cualquiera de las dos peticiones todavía espera, mostramos la ruedita.
  /** Rama condicional: overview.isPending || users.isPending. */
  if (overview.isPending || users.isPending) {
    return (
      <div role="status" className="flex items-center justify-center gap-3 py-24 text-slate-300">
        <Spinner className="size-5 text-accent-cyan" /> Cargando centro de mando…
      </div>
    );
  }

  // Caso 2: alguna petición falló. Mostramos el primer error que exista y un botón para reintentar ambas.
  /** Rama condicional: overview.isError || users.isError. */
  if (overview.isError || users.isError) {
    // "??" toma el error del resumen; si no hay, el de las cuentas.
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

  // Caso 3: todo cargó. "data" tiene el resumen completo.
  const data = overview.data;

  return (
    <div className="flex flex-col gap-6">
      {/* La cabecera del panel: título, descripción y los dos botones de acción. */}
      <GlassPanel className="stage-3d rounded-3xl p-6 sm:p-8">
        <PageHeader
          eyebrow="Centro de control · Rol Administrador"
          title="Panel de Administración"
          description="Supervisa cuentas de investigadores, métricas globales de validación y telemetría de llamadas a proveedores de IA (Gemini y Ollama)."
          actions={
            <div className="flex flex-wrap gap-2">
              <LinkButton
                to="/admin/laboratorio"
                variant="secondary"
                size="sm"
                icon={<FiBookOpen aria-hidden="true" />}
              >
                Laboratorio de algoritmos
              </LinkButton>
              {/* Vuelve a pedir el resumen y las cuentas, para ver datos recientes. */}
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
            </div>
          }
        />
      </GlassPanel>

      {/* Tarjetas de métricas globales: usuarios, proyectos, investigaciones y llamadas a IA. */}
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
          // "?? 0" muestra cero si no hay proyectos analizados.
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

      {/* Desglose por proveedor de IA (izquierda) y estado de los proyectos (derecha). */}
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

          {/* Si todavía no hay llamadas, un aviso. Si hay, una tarjeta por proveedor. */}
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
                    {/* La latencia promedio: si no hay dato (null), muestra un guion. "!= null" cubre null y undefined. */}
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

          {/* Una casilla por cada estado de proyecto. El orden lo da STATUS_META. */}
          <dl className="grid grid-cols-2 gap-3">
            {(Object.keys(STATUS_META) as ProjectStatus[]).map((statusKey) => (
              <div key={statusKey} className="neo-inset rounded-2xl p-3.5">
                <dt className="text-xs text-slate-400">{STATUS_META[statusKey].label}</dt>
                <dd className="font-display mt-1 text-2xl font-bold tabular-nums">
                  {/* Cuántos proyectos hay en ese estado. "?? 0" muestra cero si no hay ninguno. */}
                  {data.projects_by_status[statusKey] ?? 0}
                </dd>
              </div>
            ))}
          </dl>
        </GlassPanel>
      </div>

      {/* La lista de cuentas. Cada fila recibe la cuenta y el id de quien usa el panel. */}
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

      {/* La bitácora: una tabla con las últimas 25 llamadas a la IA (sin prompts ni claves). */}
      <GlassPanel className="flex flex-col gap-4 rounded-3xl p-6">
        <div>
          <h2 className="font-display text-lg font-bold">Bitácora reciente de llamadas a IA</h2>
          <p className="text-xs text-slate-400">
            Últimas 25 operaciones registradas en la base de datos.
          </p>
        </div>

        {/* Si no hay registros, un aviso. Si hay, una tabla que se puede deslizar en pantallas chicas. */}
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
                    {/* Si la operación no está en la lista de nombres, se muestra el código tal cual. */}
                    <td className="py-2.5 pr-3 font-medium">
                      {OPERATION_LABELS[log.operation] ?? log.operation}
                    </td>
                    <td className="py-2.5 pr-3">
                      {PROVIDER_LABELS[log.provider]} ·{" "}
                      <span className="font-mono-tech text-slate-400">{log.model}</span>
                    </td>
                    {/* El proyecto y el correo de quien lo hizo. Si faltan, se ve un guion. */}
                    <td className="max-w-52 truncate py-2.5 pr-3 text-slate-300">
                      {log.project_title ?? "—"} {log.user_email ? `(${log.user_email})` : ""}
                    </td>
                    {/* Verde si salió bien; rosa con el código de error si falló. */}
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
                    {/* La latencia en milisegundos, o un guion si no se midió. */}
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
