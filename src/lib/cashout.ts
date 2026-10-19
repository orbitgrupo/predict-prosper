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
 * Valor en vivo de una posición:
 * - Tu equipo va ganando (probabilidad alta) -> el valor sube.
 * - Tu equipo va perdiendo (probabilidad baja) -> el valor baja (débito).
 * Tope: el pago potencial registrado. Piso: 1% de lo apostado.
 */
export function calcPositionValue(
  amount: number,
  potentialPayout: number | null,
  probability: number,
): number {
  const raw = amount * 2 * probability;
  const cap = potentialPayout != null && potentialPayout > 0 ? potentialPayout : amount * 2;
  const capped = Math.min(raw, cap);
  const floored = Math.max(capped, amount * 0.01);
  return Math.round(floored * 100) / 100;
}
