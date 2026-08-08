"use client";

import { useCallback, useState } from "react";
import type { Category } from "@/lib/calendar/types";
import { DEFAULT_CATEGORIES } from "@/lib/calendar/categories";

let idCounter = 100;

export interface UseCategoriesResult {
  categories: Category[];
  getCategory: (id: string) => Category | undefined;
  toggleCategory: (id: string) => void;
  addCategory: (name: string, color: string) => Category;
  renameCategory: (id: string, name: string) => void;
  recolorCategory: (id: string, color: string) => void;
  /** Returns the deleted category's id so callers (e.g. useEvents) can cascade. */
  deleteCategory: (id: string) => string;
}

export function useCategories(
  initial: Category[] = DEFAULT_CATEGORIES,
): UseCategoriesResult {
  const [categories, setCategories] = useState<Category[]>(initial);

  const getCategory = useCallback(
    (id: string) => categories.find((c) => c.id === id),
    [categories],
  );

  const toggleCategory = useCallback((id: string) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c)),
    );
  }, []);

  const addCategory = useCallback((name: string, color: string): Category => {
    const newCategory: Category = {
      id: `cat-${idCounter++}`,
      name,
      color,
      checked: true,
    };
    setCategories((prev) => [...prev, newCategory]);
    return newCategory;
  }, []);

  const renameCategory = useCallback((id: string, name: string) => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
  }, []);

  const recolorCategory = useCallback((id: string, color: string) => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, color } : c)));
  }, []);

  const deleteCategory = useCallback((id: string): string => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    return id;
  }, []);

  return {
    categories,
    getCategory,
    toggleCategory,
    addCategory,
    renameCategory,
    recolorCategory,
    deleteCategory,
  };
}
