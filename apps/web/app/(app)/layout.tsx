import { getSessionUser, listTanks, isDemoMode } from "@/lib/data";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, tanks] = await Promise.all([getSessionUser(), listTanks()]);
  return (
    <AppShell
      user={{ email: user.email, full_name: user.full_name }}
      tanks={tanks}
      demo={isDemoMode()}
    >
      {children}
    </AppShell>
  );
}
