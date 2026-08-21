"use client";

import { useCallback, useEffect, useState } from "react";
import type { Category } from "@/lib/calendar/types";
import { DEFAULT_CATEGORIES } from "@/lib/calendar/categories";
import { categoryFromRow, type CategoryRow } from "@/lib/calendar/supabaseMappers";
import { createClient } from "@/lib/supabase/client";

export interface UseCategoriesResult {
  categories: Category[];
  categoriesLoading: boolean;
  categoriesError: string | null;
  getCategory: (id: string) => Category | undefined;
  toggleCategory: (id: string) => void;
  addCategory: (name: string, color: string) => void;
  renameCategory: (id: string, name: string) => void;
  recolorCategory: (id: string, color: string) => void;
  /** Returns the deleted category's id so callers (e.g. useEvents) can cascade. */
  deleteCategory: (id: string) => string;
}

export function useCategories(
  userId: string,
  onError: (message: string) => void,
): UseCategoriesResult {
  const [supabase] = useState(() => createClient());
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setCategoriesLoading(true);
      setCategoriesError(null);

      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (error) {
        setCategoriesError("Couldn't load your calendars.");
        setCategoriesLoading(false);
        return;
      }

      if (data && data.length === 0) {
        // First login for this user - seed their default calendar set.
        const seedRows = DEFAULT_CATEGORIES.map((c) => ({
          user_id: userId,
          name: c.name,
          color: c.color,
          checked: c.checked,
        }));
        const { data: seeded, error: seedError } = await supabase
          .from("categories")
          .insert(seedRows)
          .select("*");

        if (cancelled) return;

        if (seedError || !seeded) {
          setCategoriesError("Couldn't set up your default calendars.");
          setCategoriesLoading(false);
          return;
        }

        setCategories((seeded as CategoryRow[]).map(categoryFromRow));
        setCategoriesLoading(false);
        return;
      }

      setCategories(((data ?? []) as CategoryRow[]).map(categoryFromRow));
      setCategoriesLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  const getCategory = useCallback(
    (id: string) => categories.find((c) => c.id === id),
    [categories],
  );

  const toggleCategory = useCallback(
    (id: string) => {
      const prev = categories;
      const target = prev.find((c) => c.id === id);
      if (!target) return;
      setCategories((cur) => cur.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c)));

      supabase
        .from("categories")
        .update({ checked: !target.checked })
        .eq("id", id)
        .then(({ error }) => {
          if (error) {
            setCategories(prev);
            onError("Couldn't update that calendar. Please try again.");
          }
        });
    },
    [categories, supabase, onError],
  );

  const addCategory = useCallback(
    (name: string, color: string) => {
      const prev = categories;
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: Category = { id: tempId, name, color, checked: true, isGoogleImport: false };
      setCategories((cur) => [...cur, optimistic]);

      supabase
        .from("categories")
        .insert({ user_id: userId, name, color, checked: true })
        .select("*")
        .single()
        .then(({ data, error }) => {
          if (error || !data) {
            setCategories(prev);
            onError("Couldn't add that calendar. Please try again.");
            return;
          }
          const real = categoryFromRow(data as CategoryRow);
          setCategories((cur) => cur.map((c) => (c.id === tempId ? real : c)));
        });
    },
    [categories, supabase, userId, onError],
  );

  const renameCategory = useCallback(
    (id: string, name: string) => {
      const prev = categories;
      setCategories((cur) => cur.map((c) => (c.id === id ? { ...c, name } : c)));

      supabase
        .from("categories")
        .update({ name })
        .eq("id", id)
        .then(({ error }) => {
          if (error) {
            setCategories(prev);
            onError("Couldn't rename that calendar. Please try again.");
          }
        });
    },
    [categories, supabase, onError],
  );

  const recolorCategory = useCallback(
    (id: string, color: string) => {
      const prev = categories;
      setCategories((cur) => cur.map((c) => (c.id === id ? { ...c, color } : c)));

      supabase
        .from("categories")
        .update({ color })
        .eq("id", id)
        .then(({ error }) => {
          if (error) {
            setCategories(prev);
            onError("Couldn't recolor that calendar. Please try again.");
          }
        });
    },
    [categories, supabase, onError],
  );

  const deleteCategory = useCallback(
    (id: string): string => {
      const prev = categories;
      setCategories((cur) => cur.filter((c) => c.id !== id));

      supabase
        .from("categories")
        .delete()
        .eq("id", id)
        .then(({ error }) => {
          if (error) {
            setCategories(prev);
            onError("Couldn't delete that calendar. Please try again.");
          }
        });

      return id;
    },
    [categories, supabase, onError],
  );

  return {
    categories,
    categoriesLoading,
    categoriesError,
    getCategory,
    toggleCategory,
    addCategory,
    renameCategory,
    recolorCategory,
    deleteCategory,
  };
}
