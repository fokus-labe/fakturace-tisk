"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface HeaderProps {
  email: string | null;
}

export function Header({ email }: HeaderProps) {
  const router = useRouter();
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <header className="flex h-14 items-center justify-between border-b px-6">
      <div className="text-sm text-muted-foreground">{email ?? ""}</div>
      <Button variant="ghost" size="sm" onClick={signOut}>
        <LogOut className="size-4 mr-2" />
        Odhlásit
      </Button>
    </header>
  );
}
