import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BudgetDashboard from "@/components/BudgetDashboard";

export const metadata = { title: "My budget — PocketBudget" };

export default async function AppPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <BudgetDashboard />;
}
