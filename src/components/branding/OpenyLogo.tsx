'use client';

import { useTheme } from '@/lib/theme-context';
import { OPENY_LOGO_DARK_URL, OPENY_LOGO_LIGHT_URL } from '@/lib/openy-brand';

type OpenyLogoProps = {
  className?: string;
  width?: number;
  height?: number;
  alt?: string;
  forceVariant?: 'light' | 'dark';
};

export default function OpenyLogo({
  className,
  width = 116,
  height = 32,
  alt = 'OPENY',
  forceVariant,
}: OpenyLogoProps) {
  const { theme } = useTheme();
  const variant = forceVariant ?? (theme === 'dark' ? 'dark' : 'light');
  const src = variant === 'dark' ? OPENY_LOGO_DARK_URL : OPENY_LOGO_LIGHT_URL;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      width={width}
      height={height}
      style={{
        width,
        height,
        objectFit: 'contain',
      }}
    />
  );
}
