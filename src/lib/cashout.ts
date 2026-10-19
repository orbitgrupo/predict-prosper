export interface PositionOption {
  option_name: string;
  total_amount: number | string;
}

/** Probabilidad actual de una opción según el dinero acumulado (parimutuel). */
export function optionProbability(optionName: string, options: PositionOption[]): number {
  const total = options.reduce((s, o) => s + Number(o.total_amount), 0);
  if (total <= 0) return options.length > 0 ? 1 / options.length : 0;
  const opt = options.find((o) => o.option_name === optionName);
  return opt ? Number(opt.total_amount) / total : 0;
}

/**
 * Acciones de una posición (estilo Polymarket): cada $1 de pago potencial = 1 acción.
 * Si tu apuesta de $100 puede ganar $200, tienes 200 acciones.
 */
export function sharesOf(amount: number, potentialPayout: number | null): number {
  return potentialPayout != null && potentialPayout > 0 ? potentialPayout : amount * 2;
}

/** Precio promedio de entrada por acción, en centavos (ej. 89.75 = 89.75¢). */
export function entryPriceCents(amount: number, potentialPayout: number | null): number {
  const shares = sharesOf(amount, potentialPayout);
  return shares > 0 ? (amount / shares) * 100 : 50;
}

/**
 * Valor en vivo de una posición (estilo Polymarket): acciones × precio actual.
 * - Tu equipo va ganando (precio alto) -> el valor sube.
 * - Tu equipo va perdiendo (precio bajo) -> el valor baja (débito).
 * Piso: 1% de lo apostado.
 */
export function calcPositionValue(
  amount: number,
  potentialPayout: number | null,
  probability: number,
): number {
  const raw = sharesOf(amount, potentialPayout) * probability;
  const floored = Math.max(raw, amount * 0.01);
  return Math.round(floored * 100) / 100;
}
