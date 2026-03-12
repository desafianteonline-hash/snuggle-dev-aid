import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import PlatformBrand from '@/components/PlatformBrand';
import { Shield, Download, Smartphone, Share2, Plus, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const Install = () => {
  const { settings } = usePlatformSettings();
  const navigate = useNavigate();

  const appUrl = `${window.location.origin}/patrol`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${settings.platform_name} - App do Patrulheiro`,
          text: 'Acesse o app de patrulhamento pelo link abaixo:',
          url: appUrl,
        });
      } catch {}
    } else {
      await navigator.clipboard.writeText(appUrl);
      alert('Link copiado para a área de transferência!');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-4 py-3 bg-card flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PlatformBrand size="sm" />
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full space-y-8 text-center"
        >
          {/* Logo */}
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 overflow-hidden">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-12 w-12 object-contain" />
            ) : (
              <Shield className="h-10 w-10 text-primary" />
            )}
          </div>

          <div>
            <h1 className="text-2xl font-bold">App do Patrulheiro</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Instale o aplicativo de rastreamento no celular do patrulheiro
            </p>
          </div>

          {/* Instructions */}
          <div className="space-y-4 text-left">
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" />
                Como instalar no Android
              </h2>
              <ol className="text-xs text-muted-foreground space-y-3 pl-1">
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold flex-shrink-0">1</span>
                  <span>Abra o link abaixo no <strong>Google Chrome</strong> do celular do patrulheiro</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold flex-shrink-0">2</span>
                  <span>Toque no menu <strong>⋮</strong> (três pontos) no canto superior direito</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold flex-shrink-0">3</span>
                  <span>Selecione <strong>"Adicionar à tela inicial"</strong> ou <strong>"Instalar app"</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold flex-shrink-0">4</span>
                  <span>Confirme a instalação. O app aparecerá como ícone na tela inicial</span>
                </li>
              </ol>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" />
                Como instalar no iPhone
              </h2>
              <ol className="text-xs text-muted-foreground space-y-3 pl-1">
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold flex-shrink-0">1</span>
                  <span>Abra o link abaixo no <strong>Safari</strong> do iPhone</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold flex-shrink-0">2</span>
                  <span>Toque no botão de <strong>compartilhar</strong> <Share2 className="h-3 w-3 inline" /> na barra inferior</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold flex-shrink-0">3</span>
                  <span>Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong> <Plus className="h-3 w-3 inline" /></span>
                </li>
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold flex-shrink-0">4</span>
                  <span>Confirme tocando em <strong>"Adicionar"</strong></span>
                </li>
              </ol>
            </div>
          </div>

          {/* Link & actions */}
          <div className="space-y-3">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Link do app</p>
              <p className="text-xs font-mono break-all text-foreground">{appUrl}</p>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1 gap-2" onClick={handleShare}>
                <Share2 className="h-4 w-4" />
                Compartilhar link
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => navigator.clipboard.writeText(appUrl).then(() => alert('Link copiado!'))}
              >
                <Download className="h-4 w-4" />
                Copiar link
              </Button>
            </div>

            <p className="text-[10px] text-muted-foreground">
              O patrulheiro precisará fazer login com as credenciais cadastradas pelo administrador
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Install;
