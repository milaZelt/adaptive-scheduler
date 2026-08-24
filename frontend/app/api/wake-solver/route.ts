import { NextResponse } from "next/server";

// Render's free tier sleeps after 15 min idle and can take up to a minute
// to wake. Callers fire this without waiting on it, as early as possible
// (marketing page load, sign-in click) so the solver has a head start
// before Update Schedule is ever clicked. Always returns ok - this is a
// best-effort optimization, never something that should surface as an
// error to the user.
export const maxDuration = 60;

export async function GET() {
  const solverUrl = process.env.SOLVER_URL;
  if (solverUrl) {
    await fetch(`${solverUrl}/health`).catch(() => {});
  }
  return NextResponse.json({ status: "ok" });
}
