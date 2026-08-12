import type { Category } from "./types";

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "classes", name: "Classes", color: "#EDDCD2", checked: true, isGoogleImport: false },
  { id: "study", name: "Study Time", color: "#BCD4E6", checked: true, isGoogleImport: false },
  { id: "sleep", name: "Sleep", color: "#C5DEDD", checked: true, isGoogleImport: false },
  { id: "friends", name: "Friends", color: "#DBE7E4", checked: false, isGoogleImport: false },
  { id: "events", name: "Events", color: "#FFF1E6", checked: true, isGoogleImport: false },
];
