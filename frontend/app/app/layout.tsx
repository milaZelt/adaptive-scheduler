import { verifySession } from "@/lib/supabase/dal";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await verifySession();
  return <>{children}</>;
}
