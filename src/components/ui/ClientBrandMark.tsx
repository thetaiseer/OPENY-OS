'use client';

/**
 * Square brand mark: client logo image or first-letter fallback on accent.
 */
export function ClientBrandMark({
  name,
  logoUrl,
  size = 40,
  className = '',
  roundedClassName = 'rounded-xl',
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
  className?: string;
  roundedClassName?: string;
}) {
  const initial = (name?.trim().charAt(0) || '?').toUpperCase();
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- R2/public URLs; not always optimizable
      <img
        src={logoUrl}
        alt=""
        className={`shrink-0 object-cover ${roundedClassName} ${className}`}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
      />
    );
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center font-bold text-white ${roundedClassName} ${className}`}
      style={{
        width: size,
        height: size,
        background: 'var(--accent)',
        fontSize: Math.max(12, Math.round(size * 0.38)),
      }}
      aria-hidden
    >
      {initial}
    </div>
  );
}
