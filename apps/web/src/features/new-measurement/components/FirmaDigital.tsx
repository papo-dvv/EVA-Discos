import { useEffect, useRef, useState } from 'react'
import SignaturePad from 'signature_pad'
import { Eraser, PenLine } from 'lucide-react'
import { GlassButton } from '../../../components/GlassButton'
import { GlassModal } from '../../../components/GlassModal'

type Props = {
  etiqueta: string
  valor: string
  onGuardar: (firma: string) => void
}

// Se usa signature_pad directo (sin wrapper React) para conservar compatibilidad
// con React 19 y con el bundler actual. El valor persistido es un PNG base64.
export function FirmaDigital({ etiqueta, valor, onGuardar }: Props) {
  const [abierta, setAbierta] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const firmaRef = useRef<SignaturePad | null>(null)

  useEffect(() => {
    if (!abierta || !canvasRef.current) return
    const firma = new SignaturePad(canvasRef.current, { penColor: '#172028', minWidth: 0.8, maxWidth: 2.2 })
    firmaRef.current = firma
    if (valor.startsWith('data:image/')) firma.fromDataURL(valor)
    return () => {
      firma.off()
      firmaRef.current = null
    }
  }, [abierta, valor])

  function guardar() {
    const firma = firmaRef.current
    if (!firma || firma.isEmpty()) return
    onGuardar(firma.toDataURL('image/png'))
    setAbierta(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className="glass-field flex min-h-8 w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs text-concreto-oscuro"
      >
        {valor.startsWith('data:image/') ? (
          <img src={valor} alt="Firma capturada" className="h-7 max-w-[7rem] object-contain object-left" />
        ) : (
          <span className="truncate">Firma</span>
        )}
        <PenLine size={14} className="shrink-0 text-verde-oscuro" aria-hidden />
      </button>

      {abierta && (
        <GlassModal titulo={`Firma digital — ${etiqueta}`} onCerrar={() => setAbierta(false)} ancho={620}>
          <div className="overflow-hidden rounded-lg border border-concreto/20 bg-white">
            <canvas ref={canvasRef} width={560} height={180} className="block h-[11.25rem] w-full touch-none" />
          </div>
          <div className="mt-4 flex justify-between gap-3">
            <GlassButton type="button" variante="secundario" onClick={() => firmaRef.current?.clear()} className="px-3 py-2" aria-label="Limpiar firma">
              <Eraser size={16} aria-hidden />
            </GlassButton>
            <div className="flex gap-2">
              <GlassButton type="button" variante="secundario" onClick={() => setAbierta(false)}>Cancelar</GlassButton>
              <GlassButton type="button" onClick={guardar}>Guardar firma</GlassButton>
            </div>
          </div>
        </GlassModal>
      )}
    </>
  )
}
