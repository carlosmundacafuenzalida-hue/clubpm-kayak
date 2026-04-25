'use client';
import { useState } from 'react';
import { formatRut, isValidRut, cleanRut } from '@/lib/rut';

export function RutInput({
  value,
  onChange,
  placeholder = '12.345.678-9',
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [touched, setTouched] = useState(false);
  const isValid = !value || isValidRut(value);
  const showError = touched && value && !isValid;

  return (
    <div className="w-full">
      <input
        type="text"
        inputMode="text"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          // permitimos al usuario tipear; mostramos formateado al salir
          onChange(e.target.value);
        }}
        onBlur={() => {
          setTouched(true);
          if (value && isValidRut(value)) {
            onChange(formatRut(value));
          }
        }}
        className={`w-full px-4 py-3 border-[1.5px] rounded-md font-mono text-[15px] outline-none transition bg-white ${
          showError
            ? 'border-rojo focus:ring-4 focus:ring-rojo/10'
            : 'border-line focus:border-verde focus:ring-4 focus:ring-verde/10'
        } ${className}`}
      />
      {showError && (
        <p className="text-rojo text-xs mt-1.5 font-medium">RUT inválido</p>
      )}
    </div>
  );
}
