import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePlatformSettings, THEME_PRESETS } from '@/hooks/usePlatformSettings';
import { supabase } from '@/integrations/supabase/client';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PlatformBrand from '@/components/PlatformBrand';
import ThemeToggle from '@/components/ThemeToggle';
const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};
import {
  Shield, LogOut, UserPlus, Trash2, Users, Eye, EyeOff, Pencil, X, Check, Phone, Car,
  Settings, Upload, Image, Palette, MapPin, AlertTriangle, FileText, Gauge, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { logActivity } from '@/hooks/useActivityLog';
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

  // Theme state
  const [selectedPreset, setSelectedPreset] = useState('default');
  const [customPrimary, setCustomPrimary] = useState('');
  const [customBackground, setCustomBackground] = useState('');
  const [customCard, setCustomCard] = useState('');
  const [customAccent, setCustomAccent] = useState('');
  const [savingTheme, setSavingTheme] = useState(false);

  // Location state
  const [companyLat, setCompanyLat] = useState('');
  const [companyLng, setCompanyLng] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);
  const [companyCep, setCompanyCep] = useState('');
  const [companyNumero, setCompanyNumero] = useState('');
  const [searchingCep, setSearchingCep] = useState(false);

  // Operational settings
  const [maxSpeedLimit, setMaxSpeedLimit] = useState(60);
  const [patrolInterval, setPatrolInterval] = useState(15);
  const [idleTimeout, setIdleTimeout] = useState(30);
  const [minAccuracy, setMinAccuracy] = useState(50);
  const [savingOperational, setSavingOperational] = useState(false);

  const formatCep = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  };

  const handleCepSearch = async () => {
    const cepDigits = companyCep.replace(/\D/g, '');
    if (cepDigits.length !== 8) {
      toast.error('CEP deve ter 8 dígitos');
      return;
    }
    setSearchingCep(true);
    try {
      const viaCepRes = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
      const viaCepData = await viaCepRes.json();
      if (viaCepData.erro) {
        toast.error('CEP não encontrado');
        setSearchingCep(false);
        return;
      }
      const { logradouro, bairro, localidade, uf } = viaCepData;
      const numero = companyNumero.trim();
      const fullAddress = [logradouro, numero, bairro, `${localidade} - ${uf}`].filter(Boolean).join(', ');
      setCompanyAddress(fullAddress);

      // Geocode via Nominatim
      const searchQuery = numero && logradouro
        ? `${logradouro}, ${numero}, ${localidade}, ${uf}, Brazil`
        : `${logradouro || bairro}, ${localidade}, ${uf}, Brazil`;
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1&countrycodes=br`);
      const geoData = await geoRes.json();
      if (geoData.length > 0) {
        setCompanyLat(geoData[0].lat);
        setCompanyLng(geoData[0].lon);
        toast.success('Endereço encontrado! Coordenadas preenchidas.');
      } else {
        toast.warning('Endereço encontrado mas coordenadas não localizadas. Preencha manualmente.');
      }
    } catch {
      toast.error('Erro ao buscar CEP');
    }
    setSearchingCep(false);
  };

  // Sync branding form with loaded settings
  useEffect(() => {
    if (settings.id) {
      setBrandName(settings.platform_name);
      setBrandAccent(settings.platform_name_accent);
      setBrandPageTitle(settings.page_title);
      setSelectedPreset(settings.theme_preset || 'default');
      setCustomPrimary(settings.primary_color || '142 70% 45%');
      setCustomBackground(settings.background_color || '220 20% 7%');
      setCustomCard(settings.card_color || '220 18% 10%');
      setCustomAccent(settings.accent_color || '142 50% 30%');
      setCompanyLat(settings.company_latitude != null ? String(settings.company_latitude) : '');
      setCompanyLng(settings.company_longitude != null ? String(settings.company_longitude) : '');
      setCompanyAddress(settings.company_address || '');
      setMaxSpeedLimit(settings.max_speed_limit ?? 60);
      setPatrolInterval(settings.patrol_interval_seconds ?? 15);
      setIdleTimeout(settings.idle_timeout_minutes ?? 30);
      setMinAccuracy(settings.min_accuracy_meters ?? 50);
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
      logActivity({ action: 'create', entityType: 'user', entityName: name || email, details: { role: selectedRole, email } });
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
      logActivity({ action: 'delete', entityType: 'user', entityId: userId, entityName: users.find(u => u.id === userId)?.email });
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
    const targetName = editName.trim() || u.profile_name || u.patroller_name || u.email;
    const confirmed = window.confirm(`Deseja salvar as alterações de ${targetName}?`);
    if (!confirmed) return;

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
      logActivity({ action: 'update', entityType: 'user', entityId: u.id, entityName: editName.trim(), details: { phone: editPhone } });
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
    const confirmed = window.confirm('Deseja salvar as alterações de personalização da plataforma?');
    if (!confirmed) return;

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
      logActivity({ action: 'update', entityType: 'branding', entityName: brandName.trim() });
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

  const handleSelectPreset = (presetKey: string) => {
    setSelectedPreset(presetKey);
    const preset = THEME_PRESETS[presetKey];
    if (preset) {
      setCustomPrimary(preset.primary);
      setCustomBackground(preset.background);
      setCustomCard(preset.card);
      setCustomAccent(preset.accent);
    }
  };

  const handleSaveTheme = async () => {
    if (!settings.id) return;
    const confirmed = window.confirm('Deseja aplicar e salvar este tema?');
    if (!confirmed) return;

    setSavingTheme(true);
    try {
      const { error } = await supabase
        .from('platform_settings')
        .update({
          theme_preset: selectedPreset,
          primary_color: customPrimary,
          background_color: customBackground,
          card_color: customCard,
          accent_color: customAccent,
        })
        .eq('id', settings.id);
      if (error) throw error;
      toast.success('Tema salvo! Recarregando...');
      logActivity({ action: 'update', entityType: 'theme', entityName: selectedPreset });
    } catch (err: any) {
      toast.error('Erro ao salvar tema: ' + (err?.message || 'Erro'));
    }
    setSavingTheme(false);
  };

  // Helper to convert HSL string to a preview color
  const hslToStyle = (hsl: string) => `hsl(${hsl})`;

  const handleSaveLocation = async () => {
    if (!settings.id) return;
    const confirmed = window.confirm('Deseja salvar a localização da empresa?');
    if (!confirmed) return;

    setSavingLocation(true);
    try {
      const lat = companyLat.trim() ? parseFloat(companyLat) : null;
      const lng = companyLng.trim() ? parseFloat(companyLng) : null;
      if (companyLat.trim() && (isNaN(lat!) || lat! < -90 || lat! > 90)) {
        toast.error('Latitude inválida (-90 a 90)');
        setSavingLocation(false);
        return;
      }
      if (companyLng.trim() && (isNaN(lng!) || lng! < -180 || lng! > 180)) {
        toast.error('Longitude inválida (-180 a 180)');
        setSavingLocation(false);
        return;
      }
      const { error } = await supabase
        .from('platform_settings')
        .update({
          company_latitude: lat,
          company_longitude: lng,
          company_address: companyAddress.trim() || null,
        })
        .eq('id', settings.id);
      if (error) throw error;
      toast.success('Localização da empresa salva!');
      logActivity({ action: 'update', entityType: 'location', details: { lat: companyLat, lng: companyLng, address: companyAddress } });
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err?.message || 'Erro'));
    }
    setSavingLocation(false);
  };

  const handleSaveOperational = async () => {
    if (!settings.id) return;
    const confirmed = window.confirm('Deseja salvar as configurações operacionais?');
    if (!confirmed) return;

    setSavingOperational(true);
    try {
      const { error } = await supabase
        .from('platform_settings')
        .update({
          max_speed_limit: maxSpeedLimit,
          patrol_interval_seconds: patrolInterval,
          idle_timeout_minutes: idleTimeout,
          min_accuracy_meters: minAccuracy,
        } as any)
        .eq('id', settings.id);
      if (error) throw error;
      toast.success('Configurações operacionais salvas!');
      logActivity({ action: 'update', entityType: 'operational_settings', details: { maxSpeedLimit, patrolInterval, idleTimeout, minAccuracy } });
      refetchSettings();
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err?.message || 'Erro'));
    }
    setSavingOperational(false);
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
          <Button variant="outline" size="sm" onClick={() => window.location.href = '/activity-log'} className="text-xs gap-1">
            <FileText className="h-3 w-3" /> Log de Atividades
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/install', '_blank')} className="text-xs gap-1">
            <Upload className="h-3 w-3" /> Compartilhar App
          </Button>
          <span className="text-xs text-muted-foreground hidden sm:block">{user?.email}</span>
          <ThemeToggle />
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
              <TabsTrigger value="theme" className="gap-1.5">
                <Palette className="h-3.5 w-3.5" /> Tema
              </TabsTrigger>
              <TabsTrigger value="location" className="gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Localização
              </TabsTrigger>
              <TabsTrigger value="operational" className="gap-1.5">
                <Gauge className="h-3.5 w-3.5" /> Operacional
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

              {/* Alert for patrollers without user_id link */}
              {(() => {
                const unlinked = nonAdminUsers.filter(u => u.role === 'patroller' && !u.patroller_id);
                if (unlinked.length === 0) return null;
                return (
                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-destructive">
                        {unlinked.length} patrulheiro{unlinked.length > 1 ? 's' : ''} sem vínculo
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {unlinked.length > 1 ? 'Estes patrulheiros não possuem' : 'Este patrulheiro não possui'} registro vinculado. 
                        Não aparecerão no mapa mesmo fazendo login. Recrie o usuário para corrigir.
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {unlinked.map(u => (
                          <span key={u.id} className="inline-flex items-center rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive">
                            {u.profile_name || u.email || u.id.slice(0, 8)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                );
              })()}

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
                      <Input value={phone} onChange={e => setPhone(formatPhone(e.target.value))} className="bg-secondary border-border" placeholder="(00) 00000-0000" maxLength={15} />
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
                            <Input value={editPhone} onChange={e => setEditPhone(formatPhone(e.target.value))} placeholder="(00) 00000-0000" className="bg-secondary border-border h-9 text-sm" maxLength={15} />
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
                              {u.role === 'patroller' && !u.patroller_id && (
                                <p className="text-[10px] text-destructive flex items-center gap-1 mt-0.5">
                                  <AlertTriangle className="h-3 w-3" /> Sem vínculo — não aparecerá no mapa
                                </p>
                              )}
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
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive text-xs">
                                Remover logo
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-card border-border">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover Logo</AlertDialogTitle>
                                <AlertDialogDescription>Tem certeza que deseja remover o logo da plataforma?</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => removeBrandingFile('logo')} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive text-xs">
                                Remover favicon
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-card border-border">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover Favicon</AlertDialogTitle>
                                <AlertDialogDescription>Tem certeza que deseja remover o favicon da plataforma?</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => removeBrandingFile('favicon')} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
                    <Input value={brandPageTitle} onChange={e => setBrandPageTitle(e.target.value)} className="bg-secondary border-border" placeholder="CODSEG GPS - Monitoramento" />
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

            {/* ===== THEME TAB ===== */}
            <TabsContent value="theme" className="space-y-6">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border bg-card p-6 space-y-6">

                {/* Presets */}
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Temas Predefinidos</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(THEME_PRESETS).map(([key, preset]) => (
                      <button
                        key={key}
                        onClick={() => handleSelectPreset(key)}
                        className={`rounded-lg border p-3 text-left transition-all ${
                          selectedPreset === key
                            ? 'border-primary ring-1 ring-primary'
                            : 'border-border hover:border-muted-foreground/30'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex gap-1">
                            <div className="h-4 w-4 rounded-full border border-border/50" style={{ background: hslToStyle(preset.primary) }} />
                            <div className="h-4 w-4 rounded-full border border-border/50" style={{ background: hslToStyle(preset.background) }} />
                            <div className="h-4 w-4 rounded-full border border-border/50" style={{ background: hslToStyle(preset.accent) }} />
                          </div>
                        </div>
                        <p className="text-xs font-medium">{preset.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Colors */}
                <div className="border-t border-border pt-6 space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Cores Personalizadas</h3>
                  <p className="text-xs text-muted-foreground">Formato HSL: &quot;matiz saturação% luminosidade%&quot; (ex: 142 70% 45%)</p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ background: hslToStyle(customPrimary) }} />
                        Cor Primária
                      </Label>
                      <Input value={customPrimary} onChange={e => setCustomPrimary(e.target.value)} className="bg-secondary border-border" placeholder="142 70% 45%" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ background: hslToStyle(customAccent) }} />
                        Cor de Destaque
                      </Label>
                      <Input value={customAccent} onChange={e => setCustomAccent(e.target.value)} className="bg-secondary border-border" placeholder="142 50% 30%" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ background: hslToStyle(customBackground) }} />
                        Fundo
                      </Label>
                      <Input value={customBackground} onChange={e => setCustomBackground(e.target.value)} className="bg-secondary border-border" placeholder="220 20% 7%" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ background: hslToStyle(customCard) }} />
                        Cartões
                      </Label>
                      <Input value={customCard} onChange={e => setCustomCard(e.target.value)} className="bg-secondary border-border" placeholder="220 18% 10%" />
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="p-4" style={{ background: hslToStyle(customBackground) }}>
                      <div className="rounded-lg p-3 mb-2" style={{ background: hslToStyle(customCard) }}>
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded-full" style={{ background: hslToStyle(customPrimary) }} />
                          <span className="text-xs font-bold" style={{ color: hslToStyle('210 20% 92%') }}>
                            {brandName}<span style={{ color: hslToStyle(customPrimary) }}>{brandAccent}</span>
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className="rounded px-3 py-1.5 text-xs font-semibold" style={{ background: hslToStyle(customPrimary), color: hslToStyle(customBackground) }}>
                          Botão
                        </div>
                        <div className="rounded px-3 py-1.5 text-xs" style={{ background: hslToStyle(customAccent), color: hslToStyle('210 20% 92%') }}>
                          Destaque
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button onClick={handleSaveTheme} className="w-full font-semibold" disabled={savingTheme}>
                    {savingTheme ? 'Salvando...' : 'Aplicar Tema'}
                  </Button>
                </div>
              </motion.div>
            </TabsContent>

            {/* ===== LOCATION TAB ===== */}
            <TabsContent value="location" className="space-y-6">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border bg-card p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1">Localização da Empresa</h3>
                  <p className="text-xs text-muted-foreground">Defina a localização da sede/base para calcular o patrulheiro mais próximo.</p>
                </div>

                <div className="space-y-4">
                  {/* CEP + Número */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1 space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">CEP</Label>
                      <Input
                        value={companyCep}
                        onChange={e => setCompanyCep(formatCep(e.target.value))}
                        className="bg-secondary border-border"
                        placeholder="01001-000"
                        maxLength={9}
                      />
                    </div>
                    <div className="col-span-1 space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Número</Label>
                      <Input
                        value={companyNumero}
                        onChange={e => setCompanyNumero(e.target.value)}
                        className="bg-secondary border-border"
                        placeholder="123"
                      />
                    </div>
                    <div className="col-span-1 flex items-end">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={handleCepSearch}
                        disabled={searchingCep}
                      >
                        {searchingCep ? 'Buscando...' : 'Buscar CEP'}
                      </Button>
                    </div>
                  </div>

                  <div className="relative flex items-center gap-3">
                    <div className="flex-1 border-t border-border" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">ou preencha manualmente</span>
                    <div className="flex-1 border-t border-border" />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Endereço (referência)</Label>
                    <Input
                      value={companyAddress}
                      onChange={e => setCompanyAddress(e.target.value)}
                      className="bg-secondary border-border"
                      placeholder="Ex: Rua da Encruzilhada, 123 - Recife"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Latitude</Label>
                      <Input
                        type="number"
                        step="any"
                        value={companyLat}
                        onChange={e => setCompanyLat(e.target.value)}
                        className="bg-secondary border-border"
                        placeholder="-23.5505"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Longitude</Label>
                      <Input
                        type="number"
                        step="any"
                        value={companyLng}
                        onChange={e => setCompanyLng(e.target.value)}
                        className="bg-secondary border-border"
                        placeholder="-46.6333"
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-secondary/50 p-3 text-xs text-muted-foreground space-y-1">
                    <p className="font-medium">💡 Como obter as coordenadas:</p>
                    <p>1. Abra o Google Maps no computador</p>
                    <p>2. Clique com botão direito no local desejado</p>
                    <p>3. Clique nas coordenadas que aparecem para copiar</p>
                    <p>4. Cole a latitude e longitude nos campos acima</p>
                  </div>

                  {companyLat && companyLng && (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Localização definida</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {companyLat}, {companyLng}
                        </p>
                        {companyAddress && (
                          <p className="text-xs text-muted-foreground">{companyAddress}</p>
                        )}
                      </div>
                    </div>
                  )}

                  <Button onClick={handleSaveLocation} className="w-full font-semibold" disabled={savingLocation}>
                    {savingLocation ? 'Salvando...' : 'Salvar Localização'}
                  </Button>
                </div>
              </motion.div>
            </TabsContent>

            {/* ===== OPERATIONAL TAB ===== */}
            <TabsContent value="operational" className="space-y-6">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border bg-card p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1">Configurações Operacionais</h3>
                  <p className="text-xs text-muted-foreground">Defina os parâmetros operacionais da plataforma. Essas configurações afetam relatórios e alertas.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Gauge className="h-3.5 w-3.5" />
                      Velocidade Máxima Permitida (km/h)
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={200}
                      value={maxSpeedLimit}
                      onChange={e => setMaxSpeedLimit(parseInt(e.target.value) || 60)}
                      className="bg-secondary border-border"
                    />
                    <p className="text-[10px] text-muted-foreground">Patrulheiros que excederem serão destacados nos relatórios.</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" />
                      Intervalo de Rastreamento GPS (segundos)
                    </Label>
                    <Input
                      type="number"
                      min={5}
                      max={300}
                      value={patrolInterval}
                      onChange={e => setPatrolInterval(parseInt(e.target.value) || 15)}
                      className="bg-secondary border-border"
                    />
                    <p className="text-[10px] text-muted-foreground">Frequência de envio de localização pelo app do patrulheiro.</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Tempo para Inatividade (minutos)
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={120}
                      value={idleTimeout}
                      onChange={e => setIdleTimeout(parseInt(e.target.value) || 30)}
                      className="bg-secondary border-border"
                    />
                    <p className="text-[10px] text-muted-foreground">Tempo sem enviar localização até marcar o patrulheiro como inativo.</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" />
                      Precisão Mínima do GPS (metros)
                    </Label>
                    <Input
                      type="number"
                      min={5}
                      max={500}
                      value={minAccuracy}
                      onChange={e => setMinAccuracy(parseInt(e.target.value) || 50)}
                      className="bg-secondary border-border"
                    />
                    <p className="text-[10px] text-muted-foreground">Registros com precisão acima desse valor serão descartados.</p>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-secondary/50 p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium">📋 Resumo das configurações atuais:</p>
                  <p>• Limite de velocidade: <span className="font-semibold text-foreground">{maxSpeedLimit} km/h</span></p>
                  <p>• Intervalo GPS: <span className="font-semibold text-foreground">{patrolInterval}s</span></p>
                  <p>• Timeout inatividade: <span className="font-semibold text-foreground">{idleTimeout} min</span></p>
                  <p>• Precisão mínima: <span className="font-semibold text-foreground">{minAccuracy}m</span></p>
                </div>

                <Button onClick={handleSaveOperational} className="w-full font-semibold" disabled={savingOperational}>
                  {savingOperational ? 'Salvando...' : 'Salvar Configurações Operacionais'}
                </Button>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Admin;
