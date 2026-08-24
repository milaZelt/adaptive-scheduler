/** Fire-and-forget ping to start waking a sleeping solver backend early.
 *  Never awaited by callers, never throws - see app/api/wake-solver. */
export function wakeSolver(): void {
  fetch("/api/wake-solver").catch(() => {});
}
