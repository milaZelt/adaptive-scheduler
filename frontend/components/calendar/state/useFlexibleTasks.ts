"use client";

import { useCallback, useEffect, useState } from "react";
import type { FlexibleTask } from "@/lib/calendar/types";
import {
  flexibleTaskFromRow,
  flexibleTaskToRowPatch,
  type FlexibleTaskRow,
} from "@/lib/calendar/supabaseMappers";
import { createClient } from "@/lib/supabase/client";

export interface UseFlexibleTasksResult {
  flexibleTasks: FlexibleTask[];
  flexibleTasksLoading: boolean;
  flexibleTasksError: string | null;
  getFlexibleTaskById: (id: string) => FlexibleTask | undefined;
  createFlexibleTask: (
    input: Omit<FlexibleTask, "id" | "schedulingStatus" | "createdAt" | "updatedAt">,
  ) => Promise<FlexibleTask | null>;
  updateFlexibleTask: (id: string, patch: Partial<FlexibleTask>) => Promise<boolean>;
  deleteFlexibleTask: (id: string) => Promise<boolean>;
  /** Cascades a category delete — removes every task tied to that category
   *  from local state (the DB relationship is ON DELETE CASCADE already). */
  removeFlexibleTasksByCategory: (categoryId: string) => void;
  /** Replaces local state wholesale - used right after a successful Update
   *  Schedule run, whose Route Handler already persisted the fresh rows
   *  server-side and returns them for the client to adopt directly. */
  setFlexibleTasks: (tasks: FlexibleTask[]) => void;
}

export function useFlexibleTasks(
  userId: string,
  onError: (message: string) => void,
): UseFlexibleTasksResult {
  const [supabase] = useState(() => createClient());
  const [flexibleTasks, setFlexibleTasksState] = useState<FlexibleTask[]>([]);
  const [flexibleTasksLoading, setFlexibleTasksLoading] = useState(true);
  const [flexibleTasksError, setFlexibleTasksError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setFlexibleTasksLoading(true);
      setFlexibleTasksError(null);

      const { data, error } = await supabase
        .from("flexible_tasks")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (error) {
        setFlexibleTasksError("Couldn't load your flexible tasks.");
        setFlexibleTasksLoading(false);
        return;
      }

      setFlexibleTasksState(((data ?? []) as FlexibleTaskRow[]).map(flexibleTaskFromRow));
      setFlexibleTasksLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  const getFlexibleTaskById = useCallback(
    (id: string) => flexibleTasks.find((t) => t.id === id),
    [flexibleTasks],
  );

  const createFlexibleTask = useCallback(
    async (
      input: Omit<FlexibleTask, "id" | "schedulingStatus" | "createdAt" | "updatedAt">,
    ): Promise<FlexibleTask | null> => {
      const row = flexibleTaskToRowPatch(input);
      const { data, error } = await supabase
        .from("flexible_tasks")
        .insert({ ...row, user_id: userId })
        .select("*")
        .single();

      if (error || !data) {
        onError("Couldn't save that task. Please try again.");
        return null;
      }

      const created = flexibleTaskFromRow(data as FlexibleTaskRow);
      setFlexibleTasksState((cur) => [...cur, created]);
      return created;
    },
    [supabase, userId, onError],
  );

  const updateFlexibleTask = useCallback(
    async (id: string, patch: Partial<FlexibleTask>): Promise<boolean> => {
      const prev = flexibleTasks;
      setFlexibleTasksState((cur) => cur.map((t) => (t.id === id ? { ...t, ...patch } : t)));

      const rowPatch = flexibleTaskToRowPatch(patch);
      const { error } = await supabase.from("flexible_tasks").update(rowPatch).eq("id", id);

      if (error) {
        setFlexibleTasksState(prev);
        onError("Couldn't save your changes. Please try again.");
        return false;
      }
      return true;
    },
    [flexibleTasks, supabase, onError],
  );

  const deleteFlexibleTask = useCallback(
    async (id: string): Promise<boolean> => {
      const prev = flexibleTasks;
      setFlexibleTasksState((cur) => cur.filter((t) => t.id !== id));

      const { error } = await supabase.from("flexible_tasks").delete().eq("id", id);

      if (error) {
        setFlexibleTasksState(prev);
        onError("Couldn't delete that task. Please try again.");
        return false;
      }
      return true;
    },
    [flexibleTasks, supabase, onError],
  );

  const removeFlexibleTasksByCategory = useCallback((categoryId: string) => {
    setFlexibleTasksState((cur) => cur.filter((t) => t.categoryId !== categoryId));
  }, []);

  const setFlexibleTasks = useCallback((tasks: FlexibleTask[]) => {
    setFlexibleTasksState(tasks);
  }, []);

  return {
    flexibleTasks,
    flexibleTasksLoading,
    flexibleTasksError,
    getFlexibleTaskById,
    createFlexibleTask,
    updateFlexibleTask,
    deleteFlexibleTask,
    removeFlexibleTasksByCategory,
    setFlexibleTasks,
  };
}
