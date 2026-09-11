/** Formats a CPF progressively as the user types: 000.000.000-00.
 *  Keeps only digits (max 11) and inserts dots/dash as they fill in, so
 *  backspacing works naturally (the value is always rebuilt from the digits). */
export function formatCpf(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length > 9)
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`;
  return d;
}
