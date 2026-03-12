import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, LogOut, UserPlus, Trash2, Users, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface UserRecord {
  id: string;
  email: string;
  role: string;
  patroller_name?: string;
}

const Admin = () => {
  const { user, role, loading, signOut } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<'patroller' | 'operator'>('patroller');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');

  useEffect(() => {
    if (role === 'admin') fetchUsers();
  }, [role]);

  async function fetchUsers() {
    // Get all user roles
    const { data: roles } = await supabase.from('user_roles').select('*');
    const { data: patrollers } = await supabase.from('patrollers').select('*');

    if (!roles) return;

    const userList: UserRecord[] = roles.map(r => {
      const patroller = patrollers?.find(p => p.user_id === r.user_id);
      return {
        id: r.user_id,
        email: '', // We can't access auth.users from client
        role: r.role,
        patroller_name: patroller?.name,
      };
    });
    setUsers(userList);
  }

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Shield className="h-8 w-8 animate-pulse text-primary" />
    </div>
  );

  if (!user || role !== 'admin') return <Navigate to="/" replace />;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const response = await supabase.functions.invoke('create-user', {
        body: {
          email,
          password,
          role: selectedRole,
          name: selectedRole === 'patroller' ? name : undefined,
          phone: selectedRole === 'patroller' ? phone : undefined,
          vehicle_plate: selectedRole === 'patroller' ? vehiclePlate : undefined,
        },
      });

      if (response.error) {
        toast.error('Erro ao criar usuário: ' + response.error.message);
      } else if (response.data?.error) {
        toast.error('Erro: ' + response.data.error);
      } else {
        toast.success(`${selectedRole === 'patroller' ? 'Patrulheiro' : 'Operador'} criado com sucesso!`);
        setDialogOpen(false);
        resetForm();
        fetchUsers();
      }
    } catch (err) {
      toast.error('Erro inesperado');
    }

    setCreating(false);
  };

  function resetForm() {
    setEmail('');
    setPassword('');
    setName('');
    setPhone('');
    setVehiclePlate('');
    setSelectedRole('patroller');
    setShowPassword(false);
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-2 bg-card">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="text-sm font-bold tracking-wider font-mono">
            PATROL<span className="text-primary">TRACK</span>
            <span className="ml-2 text-xs text-muted-foreground font-sans">Admin</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => window.location.href = '/dashboard'} className="text-xs">
            Ver Mapa
          </Button>
          <span className="text-xs text-muted-foreground hidden sm:block">{user?.email}</span>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total', count: users.length, icon: Users },
              { label: 'Patrulheiros', count: users.filter(u => u.role === 'patroller').length, icon: Shield },
              { label: 'Operadores', count: users.filter(u => u.role === 'operator').length, icon: Eye },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="rounded-xl border border-border bg-card p-4"
              >
                <stat.icon className="h-5 w-5 text-primary mb-2" />
                <p className="text-2xl font-bold">{stat.count}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Create User Button */}
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="w-full font-semibold">
                <UserPlus className="h-4 w-4 mr-2" />
                Criar Novo Usuário
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle>Novo Usuário</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tipo</Label>
                  <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as 'patroller' | 'operator')}>
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="patroller">Patrulheiro</SelectItem>
                      <SelectItem value="operator">Operador de Monitoramento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="bg-secondary border-border"
                    placeholder="email@empresa.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Senha</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="pr-10 bg-secondary border-border"
                      placeholder="Mínimo 6 caracteres"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {selectedRole === 'patroller' && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nome do Patrulheiro</Label>
                      <Input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="bg-secondary border-border"
                        placeholder="Nome completo"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Telefone</Label>
                        <Input
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          className="bg-secondary border-border"
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Placa</Label>
                        <Input
                          value={vehiclePlate}
                          onChange={e => setVehiclePlate(e.target.value)}
                          className="bg-secondary border-border"
                          placeholder="ABC-1234"
                        />
                      </div>
                    </div>
                  </>
                )}

                <Button type="submit" className="w-full font-semibold" disabled={creating}>
                  {creating ? 'Criando...' : 'Criar Usuário'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* User List */}
          <div className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Usuários Cadastrados</h2>
            {users.filter(u => u.role !== 'admin').map((u, i) => (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    u.role === 'patroller' ? 'bg-primary/10 text-primary' : 'bg-accent text-accent-foreground'
                  }`}>
                    {u.role === 'patroller' ? 'P' : 'O'}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{u.patroller_name || u.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.role === 'patroller' ? 'Patrulheiro' : 'Operador'}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}

            {users.filter(u => u.role !== 'admin').length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum usuário cadastrado</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;
