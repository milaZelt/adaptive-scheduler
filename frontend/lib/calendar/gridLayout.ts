import { START_HOUR, ROW_HEIGHT } from "./constants";

/** Pixel position and size for a block on the time grid, from its start/end
 *  hours. Also says if it's short enough to need the compact one-line layout. */
export function getBlockGeometry(
  start: number,
  end: number,
): { top: number; height: number; short: boolean } {
  const duration = end - start;
  return {
    top: (start - START_HOUR) * ROW_HEIGHT,
    height: Math.max(duration * ROW_HEIGHT, 26),
    short: duration < 0.8,
  };
}
