import { useState } from 'react'

// Estado local ("borrador") editable que se resincroniza a `valor` cada vez
// que ese valor cambia desde afuera (ej. tras un refetch posterior a guardar
// una edición inline) — SIN useEffect: el ajuste ocurre durante el propio
// render (ver "Adjusting state when a prop changes" en
// https://react.dev/learn/you-might-not-need-an-effect), el patrón que
// recomienda React para esto. Evita el lint react-hooks/set-state-in-effect
// (llamar a setState dentro de un efecto dispara un render en cascada
// innecesario) sin necesitar remontar el componente por key.
export function useSyncedState<T>(valor: T): [T, (v: T) => void] {
  const [previo, setPrevio] = useState(valor)
  const [estado, setEstado] = useState(valor)
  if (!Object.is(previo, valor)) {
    setPrevio(valor)
    setEstado(valor)
  }
  return [estado, setEstado]
}
