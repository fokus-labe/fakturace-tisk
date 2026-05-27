import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex flex-1 min-w-0">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <Header email={user.email ?? null} />
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 max-w-6xl w-full mx-auto min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
