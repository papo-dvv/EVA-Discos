import { GlassModal } from './GlassModal'

type AyudaPagina = {
  titulo: string
  descripcion: string
  acciones: string[]
}

const AYUDA_POR_RUTA: Array<{ ruta: string; ayuda: AyudaPagina }> = [
  { ruta: '/mediciones/historico', ayuda: { titulo: 'Histórico de mediciones', descripcion: 'Consulta las mediciones confirmadas de la flota y revisa cómo evolucionaron los discos.', acciones: ['Filtra los registros para encontrar un tren o periodo.', 'Abre o edita una medición cuando necesites revisar sus datos.'] } },
  { ruta: '/mediciones/tabla', ayuda: { titulo: 'Tabla de mediciones', descripcion: 'Muestra la información de mediciones en un formato compacto para comparar valores.', acciones: ['Usa los filtros para acotar la tabla.', 'Revisa T, H, Rd y el estado calculado de cada disco.'] } },
  { ruta: '/mediciones', ayuda: { titulo: 'Mediciones', descripcion: 'Desde aquí puedes registrar nuevas mediciones y consultar el trabajo ya realizado.', acciones: ['Selecciona un tren para iniciar o continuar una ficha.', 'Consulta el histórico cuando necesites verificar registros anteriores.'] } },
  { ruta: '/nuevas-mediciones', ayuda: { titulo: 'Nueva medición', descripcion: 'Completa y valida una ficha de medición antes de incorporarla al historial.', acciones: ['Carga un archivo CSV o ingresa los valores manualmente.', 'Corrige las observaciones y confirma solo cuando la ficha esté completa.'] } },
  { ruta: '/fleet', ayuda: { titulo: 'Flota', descripcion: 'Explora la composición de los trenes y el estado de sus coches, bogies, ejes y discos.', acciones: ['Abre un tren para ver su distribución.', 'Selecciona un disco para consultar su detalle.'] } },
  { ruta: '/trazabilidad', ayuda: { titulo: 'Trazabilidad', descripcion: 'Sigue la evolución del desgaste y las mediciones de cada elemento de la flota.', acciones: ['Filtra por tren, coche o periodo.', 'Compara la tendencia para detectar comportamientos atípicos.'] } },
  { ruta: '/proyeccion', ayuda: { titulo: 'Proyección', descripcion: 'Anticipa cambios y reperfilados a partir del desgaste registrado y el kilometraje proyectado.', acciones: ['Cambia el horizonte para revisar los próximos meses.', 'Abre un elemento prioritario para ver el detalle del pronóstico.'] } },
  { ruta: '/historial', ayuda: { titulo: 'Historial', descripcion: 'Consulta los eventos y movimientos registrados por el sistema para fines de seguimiento y auditoría.', acciones: ['Filtra por fecha o tipo de evento.', 'Abre un evento para consultar toda su información.'] } },
  { ruta: '/operaciones', ayuda: { titulo: 'Operaciones', descripcion: 'Gestiona retiros, cambios de disco y trabajos pendientes de reperfilado.', acciones: ['Elige la operación que vas a ejecutar.', 'Verifica los elementos seleccionados antes de confirmar.'] } },
  { ruta: '/inventario', ayuda: { titulo: 'Inventario', descripcion: 'Controla los ejes y discos ubicados en almacén, taller o en servicio.', acciones: ['Cambia de pestaña para consultar cada ubicación.', 'Registra, edita o consulta el detalle de una pieza.'] } },
  { ruta: '/configuracion', ayuda: { titulo: 'Configuración', descripcion: 'Administra los parámetros y opciones que determinan el funcionamiento de EVA.', acciones: ['Revisa el alcance de cada parámetro antes de modificarlo.', 'Guarda los cambios para aplicarlos al sistema.'] } },
  { ruta: '/migracion', ayuda: { titulo: 'Migración de datos', descripcion: 'Importa mediciones históricas desde un archivo compatible y valida su contenido.', acciones: ['Carga el archivo para generar una vista previa.', 'Resuelve las observaciones antes de confirmar la migración.'] } },
  { ruta: '/', ayuda: { titulo: 'Dashboard', descripcion: 'Resume el estado operativo de los discos y concentra los indicadores que requieren atención.', acciones: ['Cambia el fabricante para comparar sus indicadores.', 'Abre una tarjeta o gráfico para profundizar en el módulo relacionado.'] } },
]

function obtenerAyuda(pathname: string): AyudaPagina {
  return AYUDA_POR_RUTA.find(({ ruta }) => ruta === '/' ? pathname === '/' : pathname === ruta || pathname.startsWith(`${ruta}/`))?.ayuda
    ?? { titulo: 'Ayuda de EVA', descripcion: 'Esta vista forma parte del sistema de trazabilidad de discos de freno.', acciones: ['Consulta los controles disponibles para explorar o actualizar la información.'] }
}

export function AyudaPaginaModal({ pathname, onCerrar }: { pathname: string; onCerrar: () => void }) {
  const ayuda = obtenerAyuda(pathname)
  return (
    <GlassModal titulo={`Acerca de ${ayuda.titulo}`} onCerrar={onCerrar} ancho={500}>
      <p className="mt-3 font-body text-sm leading-6 text-concreto">{ayuda.descripcion}</p>
      <div className="mt-5 rounded-[22px] border border-white/60 bg-white/35 p-4">
        <p className="font-body text-xs font-bold uppercase tracking-[0.12em] text-verde-oscuro">Qué puedes hacer aquí</p>
        <ul className="mt-3 space-y-2 font-body text-sm leading-5 text-concreto-oscuro">
          {ayuda.acciones.map((accion) => <li key={accion} className="flex gap-2"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-verde-claro" />{accion}</li>)}
        </ul>
      </div>
      <button type="button" onClick={onCerrar} className="glass-button-primary mt-5 w-full px-5 py-2.5 font-body text-sm font-semibold">Entendido</button>
    </GlassModal>
  )
}
