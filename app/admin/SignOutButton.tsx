"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  };

  return (
    <button type="button" className="btn btn-secondary" onClick={signOut} disabled={busy}>
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
