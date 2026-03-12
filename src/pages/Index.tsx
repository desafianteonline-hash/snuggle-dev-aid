import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Shield } from 'lucide-react';

const Index = () => {
  const { user, loading, role } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Shield className="h-8 w-8 animate-pulse text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Route based on role
  if (role === 'admin') return <Navigate to="/dashboard" replace />;
  if (role === 'patroller') return <Navigate to="/patrol" replace />;

  // No role assigned yet
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center space-y-4">
        <Shield className="h-12 w-12 text-primary mx-auto" />
        <h1 className="text-xl font-bold font-mono">PATROL<span className="text-primary">TRACK</span></h1>
        <p className="text-sm text-muted-foreground">
          Sua conta ainda não possui um perfil atribuído.<br />
          Contate o administrador do sistema.
        </p>
      </div>
    </div>
  );
};

export default Index;
