"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { startDemo } from "@/lib/supabase/tryDemo";

interface TryDemoButtonProps {
  className?: string;
  loadingLabel: string;
  children: ReactNode;
}

/** Shared by the navbar and the login section - same handler, different
 *  styling per call site. */
export default function TryDemoButton({ className, loadingLabel, children }: TryDemoButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleClick() {
    setError(null);
    setLoading(true);
    const { error } = await startDemo();
    if (error) {
      setError(error);
      setLoading(false);
      return;
    }
    router.push("/app");
  }

  return (
    <>
      <button type="button" onClick={handleClick} disabled={loading} className={className}>
        {loading ? loadingLabel : children}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
