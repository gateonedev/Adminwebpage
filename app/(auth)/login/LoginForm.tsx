'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { assertAdminOrSignOut } from './actions';

interface Props {
  initialError: string | null;
}

export function LoginForm({ initialError }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(initialError);
  const [pending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError('E-posta veya şifre hatalı.');
      return;
    }

    startTransition(async () => {
      const result = await assertAdminOrSignOut();
      if (!result.ok) {
        setError(result.message);
        await supabase.auth.signOut();
        return;
      }
      router.replace('/dashboard');
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <Field label="E-posta" htmlFor="email">
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ornek@gateone.app"
        />
      </Field>
      <Field label="Şifre" htmlFor="password">
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </Field>

      {error && (
        <div className="rounded-[10px] border border-danger/40 bg-dangerDim px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <Button type="submit" loading={pending} className="w-full mt-2">
        Giriş yap
      </Button>
    </form>
  );
}
