import { requireAdmin } from '@/lib/auth/requireAdmin';
import { Sidebar } from '@/components/chrome/Sidebar';
import { Topbar } from '@/components/chrome/Topbar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin();

  return (
    <div className="min-h-[100dvh] flex">
      <Sidebar role={me.role} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar email={me.email} fullName={me.full_name} role={me.role} />
        <main className="flex-1 px-6 lg:px-8 py-8">
          <div className="mx-auto max-w-6xl w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
