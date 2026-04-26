'use client';

import Image from 'next/image';
import { useTheme } from '@/context/theme-context';
import {
  OPENY_LOGO_DARK_URL,
  OPENY_LOGO_LIGHT_URL,
  openyMarketingLogoDimensions,
} from '@/lib/openy-brand';

const DEFAULT_LOGO = openyMarketingLogoDimensions(36);

type OpenyLogoProps = {
  className?: string;
  width?: number;
  height?: number;
  alt?: string;
  forceVariant?: 'light' | 'dark';
};

export default function OpenyLogo({
  className,
  width = DEFAULT_LOGO.width,
  height = DEFAULT_LOGO.height,
  alt = 'OPENY MARKETING AGENCY',
  forceVariant,
}: OpenyLogoProps) {
  const { theme } = useTheme();
  const variant = forceVariant ?? (theme === 'dark' ? 'dark' : 'light');
  const src = variant === 'dark' ? OPENY_LOGO_DARK_URL : OPENY_LOGO_LIGHT_URL;

  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      width={width}
      height={height}
      unoptimized
      loading="lazy"
      priority={false}
      sizes={`${width}px`}
      style={{ width, height, maxWidth: '100%', objectFit: 'contain' }}
    />
  );
}
