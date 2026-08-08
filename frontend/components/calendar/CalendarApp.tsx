"use client";

import { useState } from "react";
import {
  type CategoryId,
  categories,
  defaultActiveCategories,
} from "@/lib/calendar/data";
import { addDays, addMonths } from "@/lib/calendar/date";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import CalendarMain from "./CalendarMain";
import RightSidebar from "./RightSidebar";
import styles from "./CalendarApp.module.css";

export type View = "day" | "week" | "month";

export default function CalendarApp() {
  const [today] = useState(() => new Date());
  const [view, setView] = useState<View>("week");
  const [currentDate, setCurrentDate] = useState(today);
  const [activeCategories, setActiveCategories] = useState<Set<CategoryId>>(
    () => new Set(defaultActiveCategories),
  );

  const toggleCategory = (id: CategoryId) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const navigate = (direction: 1 | -1) => {
    setCurrentDate((prev) => {
      if (view === "day") return addDays(prev, direction);
      if (view === "week") return addDays(prev, direction * 7);
      return addMonths(prev, direction);
    });
  };

  const goToday = () => setCurrentDate(today);

  return (
    <div className={styles.app}>
      <TopBar view={view} onViewChange={setView} />
      <div className={styles.layout}>
        <Sidebar
          categories={categories}
          activeCategories={activeCategories}
          onToggle={toggleCategory}
        />
        <CalendarMain
          view={view}
          currentDate={currentDate}
          today={today}
          activeCategories={activeCategories}
          onToday={goToday}
          onNavigate={navigate}
        />
        <RightSidebar />
      </div>
    </div>
  );
}
