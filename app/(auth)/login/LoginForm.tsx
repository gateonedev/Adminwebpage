'use client';

import { useActionState } from 'react';
import { Field, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { login } from './actions';

interface Props {
  initialError: string | null;
}

export function LoginForm({ initialError }: Props) {
  const [state, formAction, pending] = useActionState(login, {
    message: initialError,
  });
  const error = state.message;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field label="E-posta" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="ornek@gateone.app"
        />
      </Field>
      <Field label="Şifre" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
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
