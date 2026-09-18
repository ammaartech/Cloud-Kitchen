/**
 * A JSON-LD block for search engines.
 *
 * Rendered from a server component into the page body, where Google reads it
 * just as it would from `<head>`. The one thing worth being careful about is
 * the `<` escape: a string in the data containing `</script>` would otherwise
 * end the block early, and the data here includes copy the kitchen types into
 * the admin screens.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
