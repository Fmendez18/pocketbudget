"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button type="button" data-testid="logout" className="btn btn-ghost" onClick={handleLogout} disabled={busy}>
      {busy ? "Logging out…" : "Log out"}
    </button>
  );
}
