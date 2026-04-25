/**
 * BrandMark: símbolo simplificado del Club PM Kayak.
 * Pensado para tamaños pequeños donde el logo completo no es legible.
 * El logo completo (con dibujo y texto) se usa SOLO en login/landing.
 */
export function BrandMark({ size = 32, withRing = true }: { size?: number; withRing?: boolean }) {
  return (
    <div
      className="relative flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {withRing && (
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: '#0D3D20', boxShadow: '0 0 0 2px #F5C842' }}
        />
      )}
      <svg
        viewBox="0 0 32 32"
        width={size * 0.7}
        height={size * 0.7}
        fill="none"
        className="relative"
        aria-label="Club PM Kayak"
      >
        {/* Río — onda azul */}
        <path d="M2 22 Q8 18, 14 22 T26 22 T30 22" stroke="#A8D8E8" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M2 26 Q8 22, 14 26 T26 26 T30 26" stroke="#A8D8E8" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.6"/>
        {/* Kayak naranjo */}
        <path
          d="M8 14 Q16 11, 24 14 Q24 18, 16 19 Q8 18, 8 14 Z"
          fill="#F5C842"
          stroke="#C49A1A"
          strokeWidth="0.8"
        />
        {/* Remero */}
        <circle cx="16" cy="13" r="1.6" fill="#2E86AB" />
        <path d="M11 12 L16 13.5 L21 12" stroke="#2E86AB" strokeWidth="1.2" strokeLinecap="round" />
        {/* Montaña — pequeña arriba */}
        <path d="M9 9 L13 4 L17 8 L21 3 L25 9 Z" fill="#5CAA6F" opacity="0.85"/>
      </svg>
    </div>
  );
}

/**
 * BrandWordmark: logo de texto "CLUBPM kayak" estilo del logo original.
 */
export function BrandWordmark({ light = true }: { light?: boolean }) {
  return (
    <span className={`font-display text-[18px] font-semibold tracking-tight ${light ? 'text-white' : 'text-bosque'}`}>
      <span className="text-kayak italic">CLUB</span>
      <span>PM </span>
      <em className="text-kayak font-medium">kayak</em>
    </span>
  );
}
