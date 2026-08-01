/**
 * Concordancia de número en los textos de la interfaz.
 *
 * «1 modelos» o «te quedan 1 espacios» delatan una plantilla sin terminar, y
 * en una aplicación que el usuario consulta constantemente ese detalle se nota.
 */
export function plural(count: number, singular: string, plural_: string): string {
  return count === 1 ? singular : plural_;
}

export function models(count: number): string {
  return `${count} ${plural(count, 'modelo', 'modelos')}`;
}

export function slots(count: number, slotLabel: string): string {
  return `${count} ${plural(count, 'espacio', 'espacios')} de ${slotLabel}`;
}
