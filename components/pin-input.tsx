'use client';
import { useRef } from 'react';

export function PinInput({
  value,
  onChange,
  length = 4,
}: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function setDigit(i: number, d: string) {
    const digit = d.replace(/\D/g, '').slice(-1);
    const arr = value.split('');
    arr[i] = digit;
    while (arr.length < length) arr.push('');
    const next = arr.join('').slice(0, length);
    onChange(next);
    if (digit && i < length - 1) refs.current[i + 1]?.focus();
  }

  function onKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !value[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  }

  return (
    <div className="grid grid-cols-4 gap-2.5">
      {Array.from({ length }).map((_, i) => {
        const filled = !!value[i];
        return (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={value[i] ?? ''}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => onKey(i, e)}
            className={`w-full text-center font-mono text-[22px] font-medium py-4 border-[1.5px] rounded-md outline-none transition ${
              filled
                ? 'border-verde bg-verde-tint text-bosque'
                : 'border-line bg-white text-bosque focus:border-verde focus:ring-4 focus:ring-verde/10'
            }`}
            autoComplete="off"
          />
        );
      })}
    </div>
  );
}
