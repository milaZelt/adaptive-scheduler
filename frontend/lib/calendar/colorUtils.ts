/** Lighten (positive) or darken (negative) a #RRGGBB hex color by a percent. */
export function shadeColor(hex: string, percent: number): string {
  const R = parseInt(hex.substring(1, 3), 16);
  const G = parseInt(hex.substring(3, 5), 16);
  const B = parseInt(hex.substring(5, 7), 16);

  const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v)));

  const r = clamp(R * ((100 + percent) / 100));
  const g = clamp(G * ((100 + percent) / 100));
  const b = clamp(B * ((100 + percent) / 100));

  return (
    "#" +
    r.toString(16).padStart(2, "0") +
    g.toString(16).padStart(2, "0") +
    b.toString(16).padStart(2, "0")
  );
}

export function isValidHex(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

/** Background and border color for a category. Falls back to gray when
 *  there's no category, so every block on the grid (event, session, chip,
 *  month dot) looks the same when uncategorized. */
export function getCategoryColors(
  category: { color: string } | null | undefined,
): { bg: string; border: string } {
  return category
    ? { bg: category.color, border: shadeColor(category.color, -30) }
    : { bg: "#eeeeee", border: "#cccccc" };
}
