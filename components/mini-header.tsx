import { BrandMark, BrandWordmark } from './brand';

/**
 * Header minimalista para vistas públicas (sin sesión, sin navegación).
 */
export function MiniHeader() {
  return (
    <header className="bg-bosque text-white border-b border-kayak/20">
      <div className="max-w-[1100px] mx-auto px-6 py-4 flex items-center justify-center gap-3">
        <BrandMark size={36} />
        <BrandWordmark />
      </div>
    </header>
  );
}
