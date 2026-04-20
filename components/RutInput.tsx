'use client'
import { normalizeRut } from '@/lib/rut'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function RutInput({ value, onChange, placeholder = '12.345.678-9', className }: Props) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      className={className}
      onChange={e => onChange(normalizeRut(e.target.value))}
    />
  )
}
