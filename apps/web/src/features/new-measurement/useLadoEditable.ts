import { useSyncedState } from '../../hooks/useSyncedState'
import type { LadoFilaEspejo } from './filaEspejo'
import { useAgregarFilaFicha, useEditarFilaFicha } from './queries'

type Lado = 'izquierdo' | 'derecho'

// Coordina, para UN lado (izquierdo o derecho) de UN eje, el borrador local
// de T/H y decide si cada edición dispara un PATCH (la fila ya existe como
// scan_record) o un POST (todavía no existe: el backend exige T Y H juntos
// para crearla — ver AgregarFilaDto — así que un POST solo se dispara cuando
// ambos ya están presentes en el borrador). UNA sola instancia por lado
// (llamado desde FilaEspejoRow, no desde cada celda) — así las 2 celdas
// editables de ese lado comparten el mismo borrador en vez de 2 copias
// aisladas que nunca se enterarían la una de la otra.
//
// Extraído de TablaFichaEspejo.tsx para reusarlo tal cual en
// ModalCompararCoche.tsx (misma edición inline de T/H, acotada a un solo
// coche en vez de las 24 filas de la ficha completa).
export function useLadoEditable(
  fichaId: string,
  eje: number,
  lado: Lado,
  datos: LadoFilaEspejo,
) {
  const agregar = useAgregarFilaFicha(fichaId)
  const editar = useEditarFilaFicha(fichaId)

  const [tValue, setTValue] = useSyncedState(datos.tValue)
  const [hValue, setHValue] = useSyncedState(datos.hValue)

  function intentarCrear(t: number | null, h: number | null) {
    if (datos.recordId || t === null || h === null) return
    agregar.mutate({ ejeNumero: eje, lado, tValue: t, hValue: h })
  }

  function guardarT(n: number) {
    setTValue(n)
    if (datos.recordId)
      editar.mutate({ recordId: datos.recordId, cambios: { tValue: n } })
    else intentarCrear(n, hValue)
  }
  function guardarH(n: number) {
    setHValue(n)
    if (datos.recordId)
      editar.mutate({ recordId: datos.recordId, cambios: { hValue: n } })
    else intentarCrear(tValue, n)
  }

  const pendiente =
    !datos.recordId &&
    (tValue !== null || hValue !== null) &&
    (tValue === null || hValue === null)

  return { tValue, hValue, guardarT, guardarH, pendiente }
}
