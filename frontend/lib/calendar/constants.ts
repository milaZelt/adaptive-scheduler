export const START_HOUR = 6;
export const END_HOUR = 23;
export const ROW_HEIGHT = 52; // px per hour row in the time grid

// 14-day scheduling window starting today (today = day 0, same as the
// solver). Keep this in sync with the `deadline` check in
// supabase/migrations/0003_flexible_tasks.sql.
export const PLANNING_HORIZON_DAYS = 14;

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const DOW_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const PRESET_PALETTE: string[] = [
  "#EDDCD2",
  "#FFF1E6",
  "#FDE2E4",
  "#FAD2E1",
  "#C5DEDD",
  "#DBE7E4",
  "#F0EFEB",
  "#D6E2E9",
  "#BCD4E6",
  "#99C1DE",
];
