"use client";

import { useEffect } from "react";
import { wakeSolver } from "@/lib/wakeSolver";

/** Renders nothing - just pings the solver backend once on marketing page
 *  load, so it has a head start waking up before anyone reaches Update
 *  Schedule. */
export default function WarmSolver() {
  useEffect(() => {
    wakeSolver();
  }, []);

  return null;
}
