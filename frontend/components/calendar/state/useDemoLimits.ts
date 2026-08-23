"use client";

import { useCallback, useState } from "react";
import type { CalendarEvent, FlexibleTask } from "@/lib/calendar/types";

const DEMO_MAX_ADDED_ITEMS = 5;

function removeFromSet(set: Set<string>, id: string): Set<string> {
  if (!set.has(id)) return set;
  const next = new Set(set);
  next.delete(id);
  return next;
}

interface UseDemoLimitsParams {
  isDemo: boolean;
  createEventReal: (input: Omit<CalendarEvent, "id">) => Promise<CalendarEvent | null>;
  deleteEventReal: (id: string) => Promise<boolean>;
  createFlexibleTaskReal: (
    input: Omit<FlexibleTask, "id" | "schedulingStatus" | "createdAt" | "updatedAt">,
  ) => Promise<FlexibleTask | null>;
  reportSystemError: (text: string) => void;
}

export interface UseDemoLimitsResult {
  createEvent: (input: Omit<CalendarEvent, "id">) => Promise<CalendarEvent | null>;
  deleteEvent: (id: string) => Promise<boolean>;
  createFlexibleTask: (
    input: Omit<FlexibleTask, "id" | "schedulingStatus" | "createdAt" | "updatedAt">,
  ) => Promise<FlexibleTask | null>;
  /** deleteFlexibleTaskCascade lives in AppStateContext, since it also
   *  needs scheduledSessionsApi which this hook doesn't know about. It
   *  calls this once the delete succeeds, so a demo task frees its slot
   *  just like an event does. */
  untrackTask: (id: string) => void;
}

/**
 * Caps how much a demo session can add on top of the pre-seeded content: 5
 * events and 5 tasks, tracked separately, so one kind never eats into the
 * other's limit. Deleting a tracked item frees its slot back up. Does
 * nothing (no cap, no tracking) when `isDemo` is false.
 */
export function useDemoLimits({
  isDemo,
  createEventReal,
  deleteEventReal,
  createFlexibleTaskReal,
  reportSystemError,
}: UseDemoLimitsParams): UseDemoLimitsResult {
  const [addedEventIds, setAddedEventIds] = useState<Set<string>>(new Set());
  const [addedTaskIds, setAddedTaskIds] = useState<Set<string>>(new Set());

  const createEvent = useCallback(
    async (input: Omit<CalendarEvent, "id">): Promise<CalendarEvent | null> => {
      if (isDemo && addedEventIds.size >= DEMO_MAX_ADDED_ITEMS) {
        reportSystemError(`Demo is limited to ${DEMO_MAX_ADDED_ITEMS} added events - sign in for unlimited.`);
        return null;
      }
      const created = await createEventReal(input);
      if (created && isDemo) setAddedEventIds((cur) => new Set(cur).add(created.id));
      return created;
    },
    [isDemo, addedEventIds, createEventReal, reportSystemError],
  );

  const deleteEvent = useCallback(
    async (id: string): Promise<boolean> => {
      const success = await deleteEventReal(id);
      if (success && isDemo) setAddedEventIds((cur) => removeFromSet(cur, id));
      return success;
    },
    [deleteEventReal, isDemo],
  );

  const createFlexibleTask = useCallback(
    async (
      input: Omit<FlexibleTask, "id" | "schedulingStatus" | "createdAt" | "updatedAt">,
    ): Promise<FlexibleTask | null> => {
      if (isDemo && addedTaskIds.size >= DEMO_MAX_ADDED_ITEMS) {
        reportSystemError(`Demo is limited to ${DEMO_MAX_ADDED_ITEMS} added tasks - sign in for unlimited.`);
        return null;
      }
      const created = await createFlexibleTaskReal(input);
      if (created && isDemo) setAddedTaskIds((cur) => new Set(cur).add(created.id));
      return created;
    },
    [isDemo, addedTaskIds, createFlexibleTaskReal, reportSystemError],
  );

  const untrackTask = useCallback(
    (id: string) => {
      if (isDemo) setAddedTaskIds((cur) => removeFromSet(cur, id));
    },
    [isDemo],
  );

  return { createEvent, deleteEvent, createFlexibleTask, untrackTask };
}
