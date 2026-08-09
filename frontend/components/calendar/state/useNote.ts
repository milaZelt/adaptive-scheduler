"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type NoteSaveState = "idle" | "saving" | "saved" | "error";

export interface UseNoteResult {
  note: string;
  setNote: (value: string) => void;
  noteLoading: boolean;
  noteSaveState: NoteSaveState;
}

const AUTOSAVE_DELAY_MS = 800;

export function useNote(userId: string): UseNoteResult {
  const [supabase] = useState(() => createClient());
  const [note, setNoteState] = useState("");
  const [noteLoading, setNoteLoading] = useState(true);
  const [noteSaveState, setNoteSaveState] = useState<NoteSaveState>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setNoteLoading(true);
      const { data, error } = await supabase
        .from("user_notes")
        .select("content")
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled) return;
      if (!error && data) setNoteState(data.content ?? "");
      setNoteLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const setNote = useCallback(
    (value: string) => {
      setNoteState(value);
      setNoteSaveState("idle");

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setNoteSaveState("saving");
        const { error } = await supabase
          .from("user_notes")
          .upsert({ user_id: userId, content: value }, { onConflict: "user_id" });
        setNoteSaveState(error ? "error" : "saved");
      }, AUTOSAVE_DELAY_MS);
    },
    [supabase, userId],
  );

  return { note, setNote, noteLoading, noteSaveState };
}
