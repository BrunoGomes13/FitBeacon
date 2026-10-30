import { zodResolver } from '@hookform/resolvers/zod';
import { Activity, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../auth/AuthProvider';
import { FormField } from '../components/shared';
import { Button } from '../components/ui/button';
import { ApiError } from '../lib/api';

const loginSchema = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe sua senha.'),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [message, setMessage] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const submit = async ({ email, password }: LoginValues): Promise<void> => {
    setMessage(null);
    try {
      await signIn(email, password);
      const state = location.state as { from?: { pathname?: string } } | null;
      navigate(state?.from?.pathname ?? '/', { replace: true });
    } catch (error) {
      setMessage(error instanceof Error
        ? error.message
        : error instanceof ApiError ? error.message : 'Não foi possível entrar.');
    }
  };

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="panel w-full max-w-md p-7 sm:p-9">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-md bg-primary text-primary-foreground"><Activity aria-hidden="true" size={22} /></span>
          <div>
            <p className="m-0 text-lg font-semibold">FitBeacon</p>
            <p className="m-0 text-xs text-muted">Painel administrativo</p>
          </div>
        </div>
        <h1 className="m-0 text-2xl font-semibold">Acesse sua conta</h1>
        <p className="mb-6 mt-2 text-sm text-muted">Entre com as credenciais de administrador da academia.</p>
        {message ? <p className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger" role="alert">{message}</p> : null}
        <form className="grid gap-4" onSubmit={handleSubmit(submit)} noValidate>
          <FormField error={errors.email?.message} htmlFor="login-email" label="E-mail">
            <input autoComplete="username" className="field" id="login-email" type="email" {...register('email')} />
          </FormField>
          <FormField error={errors.password?.message} htmlFor="login-password" label="Senha">
            <input autoComplete="current-password" className="field" id="login-password" type="password" {...register('password')} />
          </FormField>
          <Button className="mt-2 w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Entrando…' : <>Entrar <ArrowRight aria-hidden="true" size={17} /></>}
          </Button>
        </form>
        <p className="mb-0 mt-6 text-center text-xs text-muted">Contas de aluno não têm acesso ao painel administrativo.</p>
      </section>
    </main>
  );
}
