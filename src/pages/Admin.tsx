import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { supabase } from '@/integrations/supabase/client';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PlatformBrand from '@/components/PlatformBrand';
import {
  Shield, LogOut, UserPlus, Trash2, Users, Eye, EyeOff, Pencil, X, Check, Phone, Car,
  Settings, Upload, Image,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface UserRecord {
  id: string;
  email: string;
  role: string;
  patroller_id: string | null;
  patroller_name: string | null;
  phone: string | null;
  vehicle_plate: string | null;
  profile_name: string | null;
}

const Admin = () => {
  const { user, role, loading, signOut } = useAuth();
  const { settings, refetch: refetchSettings } = usePlatformSettings();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Create form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<'patroller' | 'operator'>('patroller');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');

  // Edit form
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPlate, setEditPlate] = useState('');
  const [saving, setSaving] = useState(false);

  // Branding form
  const [brandName, setBrandName] = useState('');
  const [brandAccent, setBrandAccent] = useState('');
  const [brandPageTitle, setBrandPageTitle] = useState('');
  const [savingBrand, setSavingBrand] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  // Sync branding form with loaded settings
  useEffect(() => {
    if (settings.id) {
      setBrandName(settings.platform_name);
      setBrandAccent(settings.platform_name_accent);
      setBrandPageTitle(settings.page_title);
    }
  }, [settings]);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { action: 'get_users' },
      });
      if (error) throw error;
      if (data?.users) setUsers(data.users);
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
    }
    setLoadingUsers(false);
  }, []);

  useEffect(() => {
    if (role === 'admin') fetchUsers();
  }, [role, fetchUsers]);

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
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          action: 'create', email, password, role: selectedRole,
          name: name || undefined,
          phone: phone || undefined,
          vehicle_plate: selectedRole === 'patroller' ? vehiclePlate : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${selectedRole === 'patroller' ? 'Patrulheiro' : 'Operador'} criado com sucesso!`);
      setDialogOpen(false);
      resetForm();
      fetchUsers();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'Erro inesperado'));
    }
    setCreating(false);
  };

  const handleDelete = async (userId: string) => {
    setDeletingId(userId);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { action: 'delete', user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Usuário removido com sucesso');
      fetchUsers();
    } catch (err: any) {
      toast.error('Erro ao remover: ' + (err?.message || 'Erro inesperado'));
    }
    setDeletingId(null);
  };

  const startEdit = (u: UserRecord) => {
    setEditingId(u.id);
    setEditName(u.role === 'patroller' ? (u.patroller_name || '') : (u.profile_name || ''));
    setEditPhone(u.phone || '');
    setEditPlate(u.vehicle_plate || '');
  };

  const handleSaveEdit = async (u: UserRecord) => {
    setSaving(true);
    try {
      if (u.role === 'patroller' && u.patroller_id) {
        const { error } = await supabase
          .from('patrollers')
          .update({ name: editName.trim(), phone: editPhone.trim() || null, vehicle_plate: editPlate.trim() || null })
          .eq('id', u.patroller_id);
        if (error) throw error;
      }
      // Also update/upsert profile for all user types
      const { error: profileErr } = await supabase
        .from('profiles')
        .upsert({
          user_id: u.id,
          name: editName.trim() || null,
          phone: editPhone.trim() || null,
        }, { onConflict: 'user_id' });
      if (profileErr) throw profileErr;

      toast.success('Usuário atualizado');
      setEditingId(null);
      fetchUsers();
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err?.message || 'Erro inesperado'));
    }
    setSaving(false);
  };

  function resetForm() {
    setEmail(''); setPassword(''); setName(''); setPhone(''); setVehiclePlate('');
    setSelectedRole('patroller'); setShowPassword(false);
  }

  // --- Branding handlers ---
  const handleSaveBranding = async () => {
    if (!settings.id) return;
    setSavingBrand(true);
    try {
      const { error } = await supabase
        .from('platform_settings')
        .update({
          platform_name: brandName.trim(),
          platform_name_accent: brandAccent.trim(),
          page_title: brandPageTitle.trim(),
        })
        .eq('id', settings.id);
      if (error) throw error;
      toast.success('Personalização salva!');
      refetchSettings();
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err?.message || 'Erro'));
    }
    setSavingBrand(false);
  };

  const uploadFile = async (file: File, type: 'logo' | 'favicon') => {
    const setter = type === 'logo' ? setUploadingLogo : setUploadingFavicon;
    setter(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${type}.${ext}`;

      // Upload to storage
      const { error: upErr } = await supabase.storage
        .from('branding')
        .upload(path, file, { upsert: true, cacheControl: '0' });
      if (upErr) throw upErr;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('branding')
        .getPublicUrl(path);

      const publicUrl = urlData.publicUrl + '?t=' + Date.now(); // cache bust

      // Update settings
      const { error: updateErr } = await supabase
        .from('platform_settings')
        .update(type === 'logo' ? { logo_url: publicUrl } : { favicon_url: publicUrl })
        .eq('id', settings.id);
      if (updateErr) throw updateErr;

      toast.success(`${type === 'logo' ? 'Logo' : 'Favicon'} atualizado!`);
      refetchSettings();
    } catch (err: any) {
      toast.error('Erro no upload: ' + (err?.message || 'Erro'));
    }
    setter(false);
  };

  const removeBrandingFile = async (type: 'logo' | 'favicon') => {
    try {
      const { error } = await supabase
        .from('platform_settings')
        .update(type === 'logo' ? { logo_url: null } : { favicon_url: null })
        .eq('id', settings.id);
      if (error) throw error;
      toast.success(`${type === 'logo' ? 'Logo' : 'Favicon'} removido`);
      refetchSettings();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'Erro'));
    }
  };

  const nonAdminUsers = users.filter(u => u.role !== 'admin');

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-2 bg-card">
        <div className="flex items-center gap-3">
          <PlatformBrand />
          <span className="text-xs text-muted-foreground font-sans">Admin</span>
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
        <div className="max-w-3xl mx-auto">
          <Tabs defaultValue="team" className="space-y-6">
            <TabsList className="bg-secondary">
              <TabsTrigger value="team" className="gap-1.5">
                <Users className="h-3.5 w-3.5" /> Equipe
              </TabsTrigger>
              <TabsTrigger value="branding" className="gap-1.5">
                <Settings className="h-3.5 w-3.5" /> Personalização
              </TabsTrigger>
            </TabsList>

            {/* ===== TEAM TAB ===== */}
            <TabsContent value="team" className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Total', count: nonAdminUsers.length, icon: Users },
                  { label: 'Patrulheiros', count: nonAdminUsers.filter(u => u.role === 'patroller').length, icon: Shield },
                  { label: 'Operadores', count: nonAdminUsers.filter(u => u.role === 'operator').length, icon: Eye },
                ].map((stat, i) => (
                  <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                    className="rounded-xl border border-border bg-card p-4">
                    <stat.icon className="h-5 w-5 text-primary mb-2" />
                    <p className="text-2xl font-bold">{stat.count}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Create User */}
              <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button className="w-full font-semibold">
                    <UserPlus className="h-4 w-4 mr-2" /> Criar Novo Usuário
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader>
                    <DialogTitle>Novo Usuário</DialogTitle>
                    <DialogDescription>Preencha os dados para criar um novo usuário no sistema.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreate} className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tipo</Label>
                      <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as 'patroller' | 'operator')}>
                        <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="patroller">Patrulheiro</SelectItem>
                          <SelectItem value="operator">Operador de Monitoramento</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
                      <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="bg-secondary border-border" placeholder="email@empresa.com" required />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Senha</Label>
                      <div className="relative">
                        <Input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className="pr-10 bg-secondary border-border" placeholder="Mínimo 6 caracteres" required minLength={6} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nome</Label>
                      <Input value={name} onChange={e => setName(e.target.value)} className="bg-secondary border-border" placeholder="Nome completo" required />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Telefone</Label>
                      <Input value={phone} onChange={e => setPhone(e.target.value)} className="bg-secondary border-border" placeholder="(00) 00000-0000" />
                    </div>
                    {selectedRole === 'patroller' && (
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Placa do Veículo</Label>
                        <Input value={vehiclePlate} onChange={e => setVehiclePlate(e.target.value)} className="bg-secondary border-border" placeholder="ABC-1234" />
                      </div>
                    )}
                    <Button type="submit" className="w-full font-semibold" disabled={creating}>
                      {creating ? 'Criando...' : 'Criar Usuário'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>

              {/* User List */}
              <div className="space-y-2">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Usuários Cadastrados ({nonAdminUsers.length})
                </h2>
                {loadingUsers ? (
                  <div className="flex justify-center py-8"><Shield className="h-6 w-6 animate-pulse text-primary" /></div>
                ) : nonAdminUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhum usuário cadastrado</p>
                  </div>
                ) : (
                  nonAdminUsers.map((u, i) => (
                    <motion.div key={u.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                      className="rounded-lg border border-border bg-card p-4">
                      {editingId === u.id ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => handleSaveEdit(u)} disabled={saving || !editName.trim()}><Check className="h-3.5 w-3.5" /></Button>
                            </div>
                          </div>
                          <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nome" className="bg-secondary border-border h-9 text-sm" />
                          <div className={`grid gap-2 ${u.role === 'patroller' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="Telefone" className="bg-secondary border-border h-9 text-sm" />
                            {u.role === 'patroller' && (
                              <Input value={editPlate} onChange={e => setEditPlate(e.target.value)} placeholder="Placa" className="bg-secondary border-border h-9 text-sm" />
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold ${u.role === 'patroller' ? 'bg-primary/10 text-primary' : 'bg-accent text-accent-foreground'}`}>
                              {u.role === 'patroller' ? 'P' : 'O'}
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {u.patroller_name || u.profile_name || u.email || u.id.slice(0, 8)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {u.role === 'patroller' ? 'Patrulheiro' : 'Operador'}
                                {u.email && <span className="ml-1 opacity-60">· {u.email}</span>}
                              </p>
                              {(u.phone || u.vehicle_plate) && (
                                <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                                  {u.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {u.phone}</span>}
                                  {u.vehicle_plate && <span className="flex items-center gap-1"><Car className="h-3 w-3" /> {u.vehicle_plate}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(u)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-card border-border">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remover Usuário</AlertDialogTitle>
                                  <AlertDialogDescription>Tem certeza que deseja remover {u.patroller_name || u.profile_name || u.email}? Esta ação não pode ser desfeita.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(u.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    {deletingId === u.id ? 'Removendo...' : 'Remover'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* ===== BRANDING TAB ===== */}
            <TabsContent value="branding" className="space-y-6">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border bg-card p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Identidade Visual</h3>

                  {/* Logo */}
                  <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Logo da Plataforma</Label>
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 rounded-lg border border-border bg-secondary flex items-center justify-center overflow-hidden">
                        {settings.logo_url ? (
                          <img src={settings.logo_url} alt="Logo" className="h-full w-full object-contain p-1" />
                        ) : (
                          <Image className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f, 'logo'); }} />
                        <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                          <Upload className="h-3.5 w-3.5 mr-1.5" />
                          {uploadingLogo ? 'Enviando...' : 'Upload Logo'}
                        </Button>
                        {settings.logo_url && (
                          <Button variant="ghost" size="sm" className="text-destructive text-xs" onClick={() => removeBrandingFile('logo')}>
                            Remover logo
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Favicon */}
                  <div className="space-y-3 mt-6">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Favicon</Label>
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg border border-border bg-secondary flex items-center justify-center overflow-hidden">
                        {settings.favicon_url ? (
                          <img src={settings.favicon_url} alt="Favicon" className="h-full w-full object-contain p-0.5" />
                        ) : (
                          <Shield className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <input ref={faviconInputRef} type="file" accept="image/*" className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f, 'favicon'); }} />
                        <Button variant="outline" size="sm" onClick={() => faviconInputRef.current?.click()} disabled={uploadingFavicon}>
                          <Upload className="h-3.5 w-3.5 mr-1.5" />
                          {uploadingFavicon ? 'Enviando...' : 'Upload Favicon'}
                        </Button>
                        {settings.favicon_url && (
                          <Button variant="ghost" size="sm" className="text-destructive text-xs" onClick={() => removeBrandingFile('favicon')}>
                            Remover favicon
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border pt-6 space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Textos</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nome Principal</Label>
                      <Input value={brandName} onChange={e => setBrandName(e.target.value)} className="bg-secondary border-border" placeholder="PATROL" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nome Destaque</Label>
                      <Input value={brandAccent} onChange={e => setBrandAccent(e.target.value)} className="bg-secondary border-border" placeholder="TRACK" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Título da Página (aba do navegador)</Label>
                    <Input value={brandPageTitle} onChange={e => setBrandPageTitle(e.target.value)} className="bg-secondary border-border" placeholder="PatrolTrack - Monitoramento" />
                  </div>

                  {/* Preview */}
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="text-xs text-muted-foreground mb-2">Pré-visualização:</p>
                    <div className="flex items-center gap-2">
                      {settings.logo_url ? (
                        <img src={settings.logo_url} alt="Logo" className="h-5 object-contain" />
                      ) : (
                        <Shield className="h-5 w-5 text-primary" />
                      )}
                      <span className="text-sm font-bold tracking-wider font-mono">
                        {brandName}<span className="text-primary">{brandAccent}</span>
                      </span>
                    </div>
                  </div>

                  <Button onClick={handleSaveBranding} className="w-full font-semibold" disabled={savingBrand}>
                    {savingBrand ? 'Salvando...' : 'Salvar Personalização'}
                  </Button>
                </div>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Admin;
