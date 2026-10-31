/**
 * ARCHIVO: research/components/SearchSuggestions.tsx
 *
 * ¿Qué es?
 * Es una pequeña ventana aislada que muestra las "sugerencias de búsqueda" de Google, tal como
 * Google las entrega cuando la IA usa su buscador. Es un bloque de HTML que viene del servidor.
 *
 * ¿Por qué está aislada?
 * Google pide que estas sugerencias se muestren exactamente como llegan, sin cambiarlas. Además,
 * como el HTML viene de fuera, no debe poder tocar la app ni leer la sesión de la persona
 * (los tokens guardados en el navegador). Por eso va dentro de un "iframe".
 *
 * Qué es un iframe: una ventana pequeña de otra página metida dentro de la nuestra. Lo que pasa
 * dentro no puede mover ni leer lo que está afuera.
 *
 * ¿Quién lo usa?
 * QueryCard.tsx, cuando la pregunta trae sugerencias de búsqueda.
 */

/**
 * SearchSuggestions recibe el HTML de las sugerencias y lo dibuja dentro de la ventana aislada.
 *
 * Recibe: html (el fragmento HTML que mandó el servidor).
 */
export function SearchSuggestions({ html }: { html: string }) {
  return (
    <iframe
      // El título describe la ventana para lectores de pantalla.
      title="Sugerencias de búsqueda de Google"
      // "sandbox" pone límites a lo que el contenido puede hacer:
      // - No puede ejecutar scripts (no se pone "allow-scripts").
      // - No puede tocar el origen de la app (no se pone "allow-same-origin"), así no ve tokens ni datos.
      // - Solo puede abrir ventanas nuevas ("allow-popups") para que los enlaces de sugerencia funcionen.
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      // "srcDoc" es el contenido HTML mismo, en lugar de una dirección. La etiqueta <base target="_blank">
      // hace que todos los enlaces se abran en una pestaña nueva.
      srcDoc={`<base target="_blank">${html}`}
      // No enviamos la dirección de la app al abrir enlaces de Google.
      referrerPolicy="no-referrer"
      // Estilo: alto fijo de 96 px (h-24), ancho completo y aspecto hundido.
      className="neo-inset h-24 w-full rounded-xl"
    />
  );
}
