import { Eye, EyeOff } from 'lucide-react'
import { useId, useState } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'

// Campo de formulario sobre glass (styles.md §9). Label + input con la clase
// .glass-field. Reenvía cualquier prop nativa del input (type, value, etc.).
// Si type="password", agrega automáticamente el ícono de mostrar/ocultar
// (ojo, lucide-react) sin que cada pantalla tenga que implementarlo — el
// input real alterna entre password/text, el autocompletado del navegador no
// se ve afectado porque nunca se le retira el atributo `type` en sí, solo se
// cambia su valor.
type GlassFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode
  contenedorClassName?: string
}

export function GlassField({
  label,
  id,
  type,
  contenedorClassName = '',
  className = '',
  ...rest
}: GlassFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const esContrasena = type === 'password'
  const [revelada, setRevelada] = useState(false)

  return (
    <div className={contenedorClassName}>
      <label
        htmlFor={inputId}
        className="mb-1.5 block font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto"
      >
        {label}
      </label>
      {esContrasena ? (
        <div className="relative">
          <input
            id={inputId}
            type={revelada ? 'text' : 'password'}
            className={`glass-field pr-11 ${className}`.trim()}
            {...rest}
          />
          <button
            type="button"
            onClick={() => setRevelada((r) => !r)}
            aria-label={revelada ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={revelada}
            className="absolute right-3.5 top-1/2 flex -translate-y-1/2 items-center text-concreto transition-colors hover:text-verde-institucional"
          >
            {revelada ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        </div>
      ) : (
        <input id={inputId} type={type} className={`glass-field ${className}`.trim()} {...rest} />
      )}
    </div>
  )
}
