/**
 * The vegetarian mark, drawn the way Indian food packaging draws it: a square
 * outline with a filled dot for vegetarian, a filled triangle for not.
 *
 * It is the one symbol on the menu every visitor in this market already reads
 * without a legend, which is why it replaces the "Veg" badge rather than sitting
 * beside it. Colour is never the only signal -- the dot and the triangle differ
 * in shape -- and the label is carried for assistive tech, which would otherwise
 * get nothing from an empty span.
 */
export function VegMark({
  vegetarian,
  className,
}: {
  vegetarian: boolean;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={vegetarian ? 'Vegetarian' : 'Non-vegetarian'}
      data-veg={vegetarian ? 'yes' : 'no'}
      className={className ? `veg-mark ${className}` : 'veg-mark'}
    />
  );
}
