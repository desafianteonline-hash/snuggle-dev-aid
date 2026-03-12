import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Mail, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error('Erro: ' + error.message);
    } else {
      setSent(true);
      toast.success('Email de recuperação enviado!');
    }
    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold font-mono">Recuperar Senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {sent ? 'Verifique seu email' : 'Informe seu email para receber o link'}
          </p>
        </div>

        {!sent ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="pl-10 bg-secondary border-border"
                  placeholder="seu@email.com"
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full font-semibold" disabled={submitting}>
              {submitting ? 'Enviando...' : 'Enviar Link de Recuperação'}
            </Button>
          </form>
        ) : (
          <div className="rounded-xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
            Um link de recuperação foi enviado para <strong className="text-foreground">{email}</strong>. Verifique sua caixa de entrada e spam.
          </div>
        )}

        <Link to="/login" className="mt-6 flex items-center justify-center gap-1 text-xs text-primary hover:underline">
          <ArrowLeft className="h-3 w-3" />
          Voltar ao login
        </Link>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
