import { Shield } from 'lucide-react';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';

interface Props {
  className?: string;
  size?: 'sm' | 'md';
}

const PlatformBrand = ({ className = '', size = 'sm' }: Props) => {
  const { settings } = usePlatformSettings();

  const iconSize = size === 'md' ? 'h-6 w-6' : 'h-5 w-5';
  const textSize = size === 'md' ? 'text-base' : 'text-sm';
  const logoSize = size === 'md' ? 'h-7' : 'h-5';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {settings.logo_url ? (
        <img src={settings.logo_url} alt="Logo" className={`${logoSize} object-contain`} />
      ) : (
        <Shield className={`${iconSize} text-primary`} />
      )}
      <h1 className={`${textSize} font-bold tracking-wider font-mono`}>
        {settings.platform_name}
        <span className="text-primary">{settings.platform_name_accent}</span>
      </h1>
    </div>
  );
};

export default PlatformBrand;
