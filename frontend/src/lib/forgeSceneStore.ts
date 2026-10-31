/**
 * ARCHIVO: forgeSceneStore.ts
 *
 * ¿Qué es?
 * Es una "libreta compartida" (en programación se llama "store" o almacén de estado).
 * Guarda cómo debe verse la escena 3D de fondo de IdeaForge: en qué pantalla estamos,
 * qué tan "caliente" está el núcleo que brilla, cuántas caras del cristal están encendidas
 * y en qué paso del proyecto vamos.
 *
 * ¿Para qué sirve?
 * Imagina un pizarrón en un salón de clases. Cualquier maestro puede escribir algo nuevo
 * en el pizarrón, y todos los alumnos que lo miran se enteran del cambio. Aquí pasa lo mismo:
 * cualquier pantalla puede cambiar la escena 3D escribiendo en esta libreta.
 *
 * ¿Quién lo usa?
 * - ProjectDetailPage.tsx, NewProjectPage.tsx y DashboardPage.tsx escriben en la libreta
 *   cuando la persona entra a una pantalla o cambia algo de su proyecto.
 * - Backdrop.tsx escribe el modo de la pantalla según la dirección (URL) en la que estás.
 * - NOTA: en los archivos revisados no se ve con claridad quién "escucha" los cambios
 *   con la función subscribe. Si nadie escucha, la escena no reaccionará aunque la libreta cambie.
 */

/**
 * ForgeMode es una lista cerrada de palabras permitidas (como un menú de opciones).
 * Solo estas cinco palabras se pueden usar; cualquier otra daría error al revisar el código.
 *
 * Por su nombre, parece que cada palabra corresponde a una pantalla:
 * - "auth": pantalla para entrar o registrarse.
 * - "dashboard": pantalla de inicio.
 * - "portfolio": lista de todos los proyectos.
 * - "composer": pantalla para crear una idea nueva.
 * - "workspace": trabajo dentro de un proyecto.
 * La relación exacta entre pantalla y palabra está en Backdrop.tsx (NOTA: no lo revisé a fondo aquí).
 */
export type ForgeMode = "auth" | "dashboard" | "portfolio" | "composer" | "workspace";

/**
 * ForgeSceneState describe la "hoja de instrucciones" de la escena 3D.
 * Cada campo es un dato con nombre, como un cajón con su etiqueta.
 */
/** Describe el contrato forge scene state utilizado por shared frontend. */
export interface ForgeSceneState {
  /** Guarda en qué pantalla estamos. Es obligatorio y solo puede valer una de las palabras de ForgeMode. */
  mode: ForgeMode;
  /** 0..1: temperatura/formación del núcleo (porcentaje de escritura o avance del proyecto). */
  /** Es un número decimal entre 0 y 1: 0 = núcleo apagado, 1 = núcleo totalmente encendido. */
  heat: number;
  /** 0..3: facetas obligatorias confirmadas en el proyecto activo. */
  /** Es un número entero de 0 a 3: cuántas de las tres "caras" del cristal ya están encendidas. */
  litFacets: number;
  /** 0..6: índice de etapa activa en el workspace. */
  /** Es un número de 0 a 6 que indica en qué paso del proyecto estamos (0 es el primero). */
  stageIndex: number;
}

/**
 * state es la libreta misma: aquí vive la copia actual de la hoja de instrucciones.
 * Usamos "let" (en lugar de "const") porque el valor se reemplaza cada vez que alguien cambia algo.
 */
/** Define state como el estado actual de la escena, con sus valores de inicio. */
let state: ForgeSceneState = {
  // Al abrir la app, la escena empieza en el panel de inicio ("dashboard").
  mode: "dashboard",
  // El núcleo empieza algo encendido: 0.35 de 1 (un poco más de un tercio).
  heat: 0.35,
  // Empieza con una cara del cristal encendida.
  litFacets: 1,
  // Empieza en el primer paso (índice 0).
  stageIndex: 0,
};

/**
 * listeners es una lista de "timbres": funciones que queremos avisar cuando la libreta cambie.
 * Un Set es como una lista donde nunca se repite el mismo elemento dos veces.
 */
/** Define listeners como la lista de funciones que se avisan cuando el estado cambia. */
const listeners = new Set<() => void>();

/**
 * forgeSceneStore es el objeto que el resto de la app usa para trabajar con la libreta.
 * Tiene tres herramientas: get (mirar), set (escribir) y subscribe (pedir aviso al cambiar).
 */
/** Define forge scene store como el objeto público para leer, cambiar y escuchar la escena. */
export const forgeSceneStore = {
  /**
   * get: devuelve la hoja de instrucciones actual.
   * Es como mirar el pizarrón sin borrar nada. No recibe datos y devuelve un ForgeSceneState.
   */
  get: (): ForgeSceneState => state,
  /**
   * set: cambia solo las partes que le pasemos.
   * Recibe "patch": un objeto con algunos campos nuevos, por ejemplo { heat: 0.8 }.
   * No devuelve nada (void).
   */
  set: (patch: Partial<ForgeSceneState>): void => {
    // Creamos una copia nueva: primero metemos todo lo que hay en state y luego encima lo que llega en patch.
    // Es como sacar una fotocopia de la hoja y tachar solo las líneas que cambiaron.
    const next = { ...state, ...patch };
    // Si la copia nueva tiene exactamente los mismos valores que la anterior, no hacemos nada más.
    // Así evitamos avisar y redibujar la escena sin necesidad.
    // NOTA: esta comparación solo revisa cuatro campos. Si en el futuro se agrega un campo nuevo
    // a ForgeSceneState, habrá que agregarlo aquí también; si no, sus cambios se ignorarían.
    if (
      next.mode === state.mode &&
      next.heat === state.heat &&
      next.litFacets === state.litFacets &&
      next.stageIndex === state.stageIndex
    ) {
      // Ya estaba igual: salimos de la función sin cambiar nada.
      return;
    }
    // Reemplazamos la libreta por la copia nueva, que ya tiene los cambios.
    state = next;
    // Tocamos cada "timbre" de la lista para avisar que hubo un cambio.
    // "forEach" significa "para cada uno de la lista, haz esto".
    listeners.forEach((listener) => listener());
  },
  /**
   * subscribe: pide un aviso cada vez que la libreta cambie.
   * Recibe "listener": la función que queremos que se ejecute cuando haya cambios.
   * Devuelve otra función que, al llamarla, quita ese aviso (como cancelar una suscripción al periódico).
   */
  subscribe: (listener: () => void): (() => void) => {
    // Agregamos el "timbre" a la lista de avisos.
    listeners.add(listener);
    // Devolvemos una función que, cuando se llame, quita ese mismo timbre de la lista.
    return () => listeners.delete(listener);
  },
};
