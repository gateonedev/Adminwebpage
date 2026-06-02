import { Logo } from '@/components/Logo';
import { LoginForm } from './LoginForm';

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

const errorMessages: Record<string, string> = {
  not_super_admin:   'Bu sayfa yalnızca süper yönetici hesapları içindir.',
  not_admin:         'Bu panel yalnızca yönetici hesapları içindir.',
  unknown_user:      'Hesabınız bulunamadı. Lütfen tekrar giriş yapın.',
  status_pending:    'Hesabınız henüz onaylanmadı.',
  status_rejected:   'Hesabınız reddedilmiş.',
  status_suspended:  'Hesabınız askıya alındı. Yöneticinizle iletişime geçin.',
};

export default async function LoginPage({ searchParams }: PageProps) {
  const { error } = await searchParams;
  const initialError = error ? errorMessages[error] ?? null : null;

  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-[1.1fr_1fr]">
      {/* Left: brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-surface border-r border-sep relative overflow-hidden">
        <Logo size="medium" />
        <div className="space-y-3 max-w-md">
          <h2 className="text-3xl font-semibold tracking-tight leading-tight">
            Yönetim paneli.
          </h2>
          <p className="text-textSec leading-relaxed">
            Siteleri, yönetici hesaplarını ve sakinleri tek bir yerden yönetin.
            Site yöneticileri kendi sitelerini, süper yöneticiler tüm sistemi
            yönetir.
          </p>
        </div>
        <div className="text-xs text-textMuted font-mono tracking-widest uppercase">
          Gate One · Smart Access
        </div>
      </div>

      {/* Right: form */}
      <div className="flex flex-col justify-center px-6 py-12 lg:px-16">
        <div className="lg:hidden mb-12 flex items-center justify-center">
          <Logo size="small" />
        </div>
        <div className="mx-auto w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Giriş yap</h1>
          <p className="mt-1.5 text-sm text-textSec leading-relaxed">
            Yönetici e-postanız ile devam edin.
          </p>
          <div className="mt-8">
            <LoginForm initialError={initialError} />
          </div>
        </div>
      </div>
    </div>
  );
}
