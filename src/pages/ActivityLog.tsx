import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PlatformBrand from '@/components/PlatformBrand';
import ThemeToggle from '@/components/ThemeToggle';
import { Shield, LogOut, ArrowLeft, Search, Filter, Clock, User, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ActivityLog {
  id: string;
  user_id: string;
  user_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Criou',
  update: 'Atualizou',
  delete: 'Removeu',
  login: 'Fez login',
  logout: 'Fez logout',
};

const ENTITY_LABELS: Record<string, string> = {
  user: 'Usuário',
  geofence: 'Cerca Virtual',
  settings: 'Configurações',
  branding: 'Identidade Visual',
  theme: 'Tema',
  location: 'Localização',
  watch_point: 'Ponto de Vigia',
};

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-500/15 text-green-400',
  update: 'bg-blue-500/15 text-blue-400',
  delete: 'bg-red-500/15 text-red-400',
  login: 'bg-purple-500/15 text-purple-400',
  logout: 'bg-orange-500/15 text-orange-400',
};

const ActivityLogPage = () => {
  const navigate = useNavigate();
  const { user, role, loading, signOut } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEntity, setFilterEntity] = useState('all');
  const [filterAction, setFilterAction] = useState('all');

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      let query = supabase
        .from('activity_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200) as any;

      if (filterEntity !== 'all') {
        query = query.eq('entity_type', filterEntity);
      }
      if (filterAction !== 'all') {
        query = query.eq('action', filterAction);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs((data as ActivityLog[]) || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
    setLoadingLogs(false);
  }, [filterEntity, filterAction]);

  useEffect(() => {
    if (role === 'admin') fetchLogs();
  }, [role, fetchLogs]);

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Shield className="h-8 w-8 animate-pulse text-primary" />
    </div>
  );

  if (!user || role !== 'admin') return <Navigate to="/" replace />;

  const filteredLogs = logs.filter(log => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (log.user_email || '').toLowerCase().includes(s) ||
      (log.entity_name || '').toLowerCase().includes(s) ||
      (ACTION_LABELS[log.action] || log.action).toLowerCase().includes(s) ||
      (ENTITY_LABELS[log.entity_type] || log.entity_type).toLowerCase().includes(s)
    );
  });

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-2 bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <PlatformBrand />
          <span className="text-xs text-muted-foreground font-sans">Log de Atividades</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:block">{user?.email}</span>
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Log de Atividades</h1>
            <span className="text-xs text-muted-foreground ml-2">({filteredLogs.length} registros)</span>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por email, nome..."
                className="pl-9 bg-card border-border"
              />
            </div>
            <Select value={filterEntity} onValueChange={setFilterEntity}>
              <SelectTrigger className="w-[160px] bg-card border-border">
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-[140px] bg-card border-border">
                <SelectValue placeholder="Ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas ações</SelectItem>
                {Object.entries(ACTION_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Log list */}
          {loadingLogs ? (
            <div className="flex justify-center py-12">
              <Shield className="h-6 w-6 animate-pulse text-primary" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma atividade registrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log, i) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.5) }}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ACTION_COLORS[log.action] || 'bg-muted text-muted-foreground'}`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          <span className="text-muted-foreground">{ENTITY_LABELS[log.entity_type] || log.entity_type}</span>
                          {log.entity_name && (
                            <span className="text-foreground ml-1">"{log.entity_name}"</span>
                          )}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {log.user_email || log.user_id.slice(0, 8)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <p className="text-[11px] text-muted-foreground/70 mt-1 truncate max-w-md">
                            {JSON.stringify(log.details)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityLogPage;
