/**
 * ARCHIVO: ForgeCanvas.tsx
 *
 * ¿Qué es?
 * Es un componente "vacío": cuando se dibuja, no muestra nada en la pantalla. Su función
 * devuelve null, que en React significa "no dibujes nada aquí".
 *
 * ¿Para qué sirve hoy?
 * En el código actual no sirve para nada visible. Lo que se ve en el fondo de la app lo dibuja
 * Backdrop.tsx (las bolas de luz y la rejilla), no este archivo.
 *
 * ⚠ Discrepancia importante:
 * AGENTS.md (las notas técnicas del proyecto) dice que aquí debería haber una escena 3D con
 * Three.js (la dependencia "three" está en package.json), cargada de forma diferida desde Backdrop.tsx.
 * En el código que existe ahora no hay nada de eso: nadie importa este archivo y Backdrop.tsx no lo carga.
 * NOTA: no se debe eliminar ni cambiar esta escena sin confirmarlo con quien lleva el proyecto.
 * Si se decide reactivarla, este es el archivo donde iría el lienzo 3D.
 *
 * ¿Quién lo usa?
 * Nadie en el código actual.
 */

/* "export default" significa que este es el valor principal del archivo, y se puede importar sin llaves.
   "function ForgeCanvas()" es un componente de React: una función que devuelve lo que se debe dibujar. */
export default function ForgeCanvas() {
  // "null" = no dibujar nada. Así el componente existe, pero no ocupa espacio ni se ve en la pantalla.
  return null;
}
