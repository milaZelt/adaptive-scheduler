import { verifySession } from "@/lib/supabase/dal";
import CalendarApp from "@/components/calendar/CalendarApp";

export default async function AppPage() {
  const user = await verifySession();
  return <CalendarApp userId={user.id} />;
}
