import { RefreshCw, ServerOff } from 'lucide-react'
import { GlassButton } from './GlassButton'
import { GlassSurface } from './GlassSurface'

export function EstadoApiNoDisponible({ detalle }: { detalle?: string }) {
  return (
    <GlassSurface fuerte className="mx-auto mt-5 max-w-xl rounded-glass p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="rounded-2xl bg-rose-50 p-3 text-rose-600"><ServerOff size={22} /></span>
        <div className="min-w-0"><h2 className="font-display text-lg font-semibold text-concreto-oscuro">No se pudo cargar la ficha</h2><p className="mt-1 font-body text-sm leading-6 text-concreto">El servicio de datos no está disponible en este momento. Iniciá la API y PostgreSQL, luego reintentá.</p>{detalle && <p className="mt-2 break-words font-data text-xs text-rose-700">{detalle}</p>}<GlassButton type="button" variante="primario" onClick={() => window.location.reload()} className="mt-4 text-xs"><RefreshCw size={14} />Reintentar</GlassButton></div>
      </div>
    </GlassSurface>
  )
}
