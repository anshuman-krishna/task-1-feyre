import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";
import { Sidebar } from "@/components/layout/sidebar";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const me = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarHue: user.avatarHue,
  };

  return (
    <AppShell sidebar={<Sidebar />} user={me}>
      {children}
    </AppShell>
  );
}
