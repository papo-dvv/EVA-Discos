import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { GlassSurface } from '../../../components/GlassSurface'
import { ScrollArea } from '../../../components/ScrollArea'
import { SegmentedControl } from '../../../components/SegmentedControl'
import type { SystemParamItem } from '../api'
import { useSystemParams } from '../queries'
import { claveFilaConEstado, useConfirmacionParametro } from '../useConfirmacionParametro'
import { AvisoAjusteConsenso } from './AvisoAjusteConsenso'
import { FilaParametro } from './FilaParametro'

export type ModuloParametros = 'mediciones' | 'tasa-desgaste' | 'trazabilidad' | 'proyeccion'
type Grupo = { nombre: string; claves: readonly string[] }

const GRUPOS: Record<ModuloParametros, Grupo> = {
  mediciones: {
    nombre: 'Mediciones',
    claves: ['rd_umbral_ok', 'rd_umbral_seguimiento', 'rd_umbral_critico', 'h_umbral_reperfilado', 'reperfilado_descuento_rd'],
  },
  'tasa-desgaste': { nombre: 'Tasa de desgaste', claves: ['km_mensual'] },
  trazabilidad: {
    nombre: 'Trazabilidad',
    claves: ['percentil_limite_inferior', 'percentil_limite_superior', 'percentil_extremo_inferior', 'percentil_extremo_superior', 'consenso_extremo_epsilon', 'amplitud_maxima_extremo', 'asimetria_umbral_simetrica', 'outlier_parametro', 'proyeccion_km_rango_max', 'proyeccion_km_rango_min'],
  },
  proyeccion: {
    nombre: 'Proyección',
    claves: ['proyeccion_h_umbral_reperfilado', 'proyeccion_rd_umbral_cambio', 'proyeccion_reperfilado_descuento_rd'],
  },
}

// Grupo adicional, SOLO visible en modo `soloTodos` (Configuración) — no
// tiene página propia que lo embeba con `modulo`, a diferencia de los 4 de
// arriba. Antes vivía como panel embebido en Mediciones; con Configuración
// centralizando todo, se retiró de ahí (ver Mediciones.tsx).
const GRUPO_SEMAFORO_MEDICIONES: Grupo = {
  nombre: 'Semáforo de mediciones (tarjetas)',
  claves: ['dias_semaforo_alerta', 'dias_semaforo_critico', 'dias_semaforo_prioridad'],
}

const CLAVES_PERMITEN_VACIO = new Set(['amplitud_maxima_extremo'])

function filasPorClaves(params: SystemParamItem[], claves: readonly string[]) {
  return claves.map((clave) => params.find((param) => param.clave === clave)).filter(
    (param): param is SystemParamItem => param !== undefined,
  )
}

// `soloTodos` = modo centralizado (página Configuración): siempre muestra
// todos los grupos, sin el toggle módulo/todos y sin "modulo" propio — ver
// Configuracion.tsx. El resto de páginas sigue pasando `modulo` como antes
// (panel embebido, foco en su propio grupo con opción de ver "Todos").
type Props = { modulo: ModuloParametros; soloTodos?: false } | { soloTodos: true; modulo?: undefined }

export function PanelParametros({ modulo, soloTodos = false }: Props) {
  const [vista, setVista] = useState<'modulo' | 'todos'>(soloTodos ? 'todos' : 'modulo')
  const queryClient = useQueryClient()
  const params = useSystemParams()
  const { actualizar, confirmando, setConfirmando, avisoAjuste, setAvisoAjuste, confirmar } = useConfirmacionParametro(() => {
    if (soloTodos) {
      queryClient.invalidateQueries({ queryKey: ['scan-records'] })
      queryClient.invalidateQueries({ queryKey: ['wear-rate'] })
      queryClient.invalidateQueries({ queryKey: ['traceability'] })
      queryClient.invalidateQueries({ queryKey: ['projection'] })
      return
    }
    const queryKey = modulo === 'tasa-desgaste'
      ? ['wear-rate']
      : modulo === 'trazabilidad'
        ? ['traceability']
        : modulo === 'proyeccion'
          ? ['projection']
          : ['scan-records']
    queryClient.invalidateQueries({ queryKey })
  })
  const editables = (params.data ?? []).filter(
    (param) => param.editable && param.clave !== 'outlier_metodo' && param.clave !== 'measurement_gap_umbral_meses',
  )
  const grupoActual = soloTodos || !modulo ? undefined : GRUPOS[modulo]
  const opcionesVista: { valor: 'modulo' | 'todos'; etiqueta: string }[] = grupoActual
    ? [
        { valor: 'modulo', etiqueta: grupoActual.nombre },
        { valor: 'todos', etiqueta: 'Todos' },
      ]
    : []
  const gruposCompletos = soloTodos ? [...Object.values(GRUPOS), GRUPO_SEMAFORO_MEDICIONES] : Object.values(GRUPOS)
  const gruposVisibles = !soloTodos && vista === 'modulo' && grupoActual
    ? [{ ...grupoActual, params: filasPorClaves(editables, grupoActual.claves) }]
    : gruposCompletos.map((grupo) => ({ ...grupo, params: filasPorClaves(editables, grupo.claves) }))
  const clavesAsignadas = new Set(gruposCompletos.flatMap((grupo) => grupo.claves))
  const otros = editables.filter((param) => !clavesAsignadas.has(param.clave))
  const mostrarEncabezadoGrupo = soloTodos || vista === 'todos'

  return (
    <>
      <GlassSurface fuerte className="rounded-glass p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-semibold text-concreto-oscuro">Parámetros</h3>
            <p className="mt-0.5 font-body text-xs text-concreto">
              {soloTodos ? 'Todos los parámetros configurables, agrupados por módulo.' : vista === 'modulo' ? `Configuración de ${grupoActual!.nombre}.` : 'Configuración agrupada por módulo.'}
            </p>
          </div>
          {!soloTodos && (
            <SegmentedControl ariaLabel="Parámetros del módulo actual o todos los módulos" opciones={opcionesVista} valor={vista} onCambiar={(v) => setVista(v)} />
          )}
        </div>

        {avisoAjuste && <AvisoAjusteConsenso clave={avisoAjuste.clave} ajustes={avisoAjuste.ajustes} onCerrar={() => setAvisoAjuste(null)} />}
        {params.isLoading ? (
          <p className="font-body text-sm text-concreto">Cargando…</p>
        ) : params.isError ? (
          <p role="alert" className="font-body text-sm text-[color:var(--color-estado-critico)]">No se pudieron cargar los parámetros.</p>
        ) : (
          <ScrollArea viewportClassName="max-h-[21rem]" className="-mr-1 pr-1">
            <div className="space-y-4">
              {gruposVisibles.filter((grupo) => grupo.params.length > 0).map((grupo) => (
                <section key={grupo.nombre} className="space-y-2.5">
                  {mostrarEncabezadoGrupo && <p className="font-body text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-concreto">{grupo.nombre}</p>}
                  {grupo.params.map((param: SystemParamItem) => (
                    <FilaParametro key={claveFilaConEstado(param, actualizar)} param={param} permitirVacio={CLAVES_PERMITEN_VACIO.has(param.clave)} onGuardar={(nuevo) => setConfirmando({ clave: param.clave, anterior: param.valor, nuevo })} />
                  ))}
                </section>
              ))}
              {mostrarEncabezadoGrupo && otros.length > 0 && (
                <section className="space-y-2.5">
                  <p className="font-body text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-concreto">Otros</p>
                  {otros.map((param) => (
                    <FilaParametro key={claveFilaConEstado(param, actualizar)} param={param} permitirVacio={CLAVES_PERMITEN_VACIO.has(param.clave)} onGuardar={(nuevo) => setConfirmando({ clave: param.clave, anterior: param.valor, nuevo })} />
                  ))}
                </section>
              )}
            </div>
          </ScrollArea>
        )}
      </GlassSurface>

      {confirmando && (
        <ConfirmDialog titulo="Confirmar cambio de parámetro" textoConfirmar="Sí, cambiar" onConfirm={confirmar} onCerrar={() => setConfirmando(null)} mensaje={<>¿Seguro que quieres cambiar <span className="font-data">{confirmando.clave}</span> de <b className="font-data">{confirmando.anterior}</b> a <b className="font-data">{confirmando.nuevo}</b>?</>} />
      )}
    </>
  )
}
