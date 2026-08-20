// Relación oficial ALSTOM T06-T44, espejo de flota.md. Devuelve el número de
// coche físico esperado para el par (tren, tipo de coche); null si no aplica.
export type TipoCocheOficial = 'MA1' | 'MB1' | 'MB3' | 'REM' | 'MB2' | 'MA2';

export function numeroCocheOficial(
  trenNumero: number,
  tipoCoche: string | null,
): number | null {
  if (!Number.isInteger(trenNumero) || trenNumero < 6 || trenNumero > 44) {
    return null;
  }

  const tipo = tipoCoche as TipoCocheOficial | null;
  const baseMotorizados = 101 + (trenNumero - 6) * 4;
  const baseRemolques = 401 + (trenNumero - 6);
  const baseMb3 = 501 + (trenNumero - 6);

  switch (tipo) {
    case 'MA1':
      return baseMotorizados;
    case 'MB1':
      return baseMotorizados + 1;
    case 'MB3':
      return baseMb3;
    case 'REM':
      return baseRemolques;
    case 'MB2':
      return baseMotorizados + 2;
    case 'MA2':
      return baseMotorizados + 3;
    default:
      return null;
  }
}
