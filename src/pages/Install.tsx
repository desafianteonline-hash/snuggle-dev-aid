import { useState, useEffect } from 'react';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import PlatformBrand from '@/components/PlatformBrand';
import { Shield, Download, Smartphone, Share2, Plus, ArrowLeft, CheckCircle2, Copy, ExternalLink, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const Install = () => {
  const { settings } = usePlatformSettings();
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [apkUrl, setApkUrl] = useState<string | null>(null);

  // Use published URL to avoid Lovable auth redirect
  const publishedOrigin = 'https://snuggle-dev-aid.lovable.app';
  const appUrl = `${publishedOrigin}/patrol`;

  const isAndroid = /android/i.test(navigator.userAgent);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  // Check if APK exists in storage
  useEffect(() => {
    const checkApk = async () => {
      const { data } = await supabase.storage.from('apk').list('', { limit: 1, search: '.apk' });
      if (data && data.length > 0) {
        const apkFile = data.find(f => f.name.endsWith('.apk'));
        if (apkFile) {
          const { data: urlData } = supabase.storage.from('apk').getPublicUrl(apkFile.name);
          setApkUrl(urlData.publicUrl);
        }
      }
    };
    checkApk();
  }, []);

  // Listen for PWA install prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      toast.success('App instalado com sucesso!');
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } catch {
      toast.error('Erro ao instalar');
    }
    setInstalling(false);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${settings.platform_name} - App do Patrulheiro`,
          text: 'Instale o app de patrulhamento pelo link abaixo:',
          url: appUrl,
        });
      } catch {}
    } else {
      await navigator.clipboard.writeText(appUrl);
      toast.success('Link copiado!');
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(appUrl);
    toast.success('Link copiado para a área de transferência!');
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

      <div className="flex-1 overflow-auto p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full mx-auto space-y-6 text-center"
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
            <h1 className="text-2xl font-bold">Instalar App do Patrulheiro</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Compartilhe e instale o aplicativo no celular dos patrulheiros
            </p>
          </div>

          {/* Install Button - Main CTA */}
          {isInstalled ? (
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="rounded-xl border border-primary/30 bg-primary/10 p-4 flex items-center gap-3"
            >
              <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm font-bold text-primary">App já instalado!</p>
                <p className="text-xs text-muted-foreground">O aplicativo está instalado neste dispositivo</p>
              </div>
            </motion.div>
          ) : deferredPrompt ? (
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="space-y-2"
            >
              <Button
                size="lg"
                className="w-full gap-2 h-14 text-base font-bold"
                onClick={handleInstallClick}
                disabled={installing}
              >
                <Download className="h-5 w-5" />
                {installing ? 'Instalando...' : 'Instalar App Agora'}
              </Button>
              <p className="text-[10px] text-muted-foreground">
                Clique para instalar diretamente no dispositivo
              </p>
            </motion.div>
          ) : (
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 text-left">
              <p className="text-xs text-muted-foreground">
                {isIOS
                  ? '📱 No iPhone, use o Safari e toque em Compartilhar → "Adicionar à Tela de Início"'
                  : isAndroid
                  ? '📱 No Android, use o Chrome e toque no menu ⋮ → "Instalar app"'
                  : '📱 Para instalar, abra este link no celular do patrulheiro usando Chrome (Android) ou Safari (iPhone)'}
              </p>
            </div>
          )}

          {/* APK Download */}
          {apkUrl && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-xl border-2 border-primary bg-primary/5 p-5 space-y-3"
            >
              <div className="flex items-center gap-2 justify-center">
                <Package className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-bold text-primary">App Nativo Android</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Versão nativa com <strong>rastreamento em segundo plano</strong> — funciona mesmo com o celular bloqueado
              </p>
              <Button
                size="lg"
                className="w-full gap-2 h-14 text-base font-bold"
                onClick={() => window.open(apkUrl, '_blank')}
              >
                <Download className="h-5 w-5" />
                Baixar APK Nativo
              </Button>
              <p className="text-[10px] text-muted-foreground">
                ⚡ Recomendado para patrulheiros Android
              </p>
            </motion.div>
          )}

          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Escaneie para instalar</p>
            <div className="flex justify-center">
              <div className="bg-white p-3 rounded-xl">
                <QRCodeSVG value={appUrl} size={180} level="H" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">Aponte a câmera do celular para o QR Code acima</p>
          </div>

          {/* Link & Share */}
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Link do app</p>
              <div className="flex items-center gap-2">
                <p className="text-xs font-mono break-all text-foreground flex-1 text-left">{appUrl}</p>
                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={handleCopy}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1 gap-2" onClick={handleShare}>
                <Share2 className="h-4 w-4" />
                Compartilhar
              </Button>
              <Button variant="outline" className="flex-1 gap-2" onClick={handleCopy}>
                <Copy className="h-4 w-4" />
                Copiar link
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-4 text-left">
            <h2 className="text-sm font-bold text-center text-muted-foreground">Instruções de instalação</h2>
            
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" />
                Android (Chrome)
              </h3>
              <ol className="text-xs text-muted-foreground space-y-3 pl-1">
                {[
                  'Abra o link acima no **Google Chrome**',
                  'Toque no menu **⋮** (três pontos) no canto superior',
                  'Selecione **"Instalar app"** ou **"Adicionar à tela inicial"**',
                  'Confirme. O app aparecerá na tela inicial como ícone',
                ].map((step, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold flex-shrink-0">
                      {i + 1}
                    </span>
                    <span dangerouslySetInnerHTML={{ __html: step.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" />
                iPhone (Safari)
              </h3>
              <ol className="text-xs text-muted-foreground space-y-3 pl-1">
                {[
                  'Abra o link acima no **Safari**',
                  'Toque no botão de **compartilhar** (quadrado com seta)',
                  'Role e toque em **"Adicionar à Tela de Início"**',
                  'Confirme tocando em **"Adicionar"**',
                ].map((step, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold flex-shrink-0">
                      {i + 1}
                    </span>
                    <span dangerouslySetInnerHTML={{ __html: step.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                  </li>
                ))}
              </ol>
            </div>

            {/* Warning */}
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-destructive">
                <Shield className="h-4 w-4" />
                Importante
              </h3>
              <ul className="text-xs text-muted-foreground space-y-2 pl-1">
                <li className="flex gap-2">
                  <span className="text-destructive font-bold">•</span>
                  <span>Cada patrulheiro precisa ter uma <strong>conta cadastrada pelo administrador</strong> no painel Admin → Equipe</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-destructive font-bold">•</span>
                  <span>Forneça o <strong>email e senha</strong> ao patrulheiro junto com o link</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-destructive font-bold">•</span>
                  <span>Sem credenciais, o patrulheiro <strong>não conseguirá acessar</strong> o app</span>
                </li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Install;
