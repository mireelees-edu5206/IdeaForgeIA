/**
 * Google exige mostrar las "Search Suggestions" del grounding de Gemini tal como llegan.
 * Se aíslan en un iframe sandbox sin scripts ni acceso al origen de la app (tokens en localStorage).
 */
export function SearchSuggestions({ html }: { html: string }) {
  return (
    <iframe
      title="Sugerencias de búsqueda de Google"
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      srcDoc={`<base target="_blank">${html}`}
      referrerPolicy="no-referrer"
      className="neo-inset h-24 w-full rounded-xl"
    />
  );
}
