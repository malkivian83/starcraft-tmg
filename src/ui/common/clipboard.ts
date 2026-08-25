/** Copia texto usando Clipboard API y un fallback para contextos no seguros. */
export async function copyToClipboard(value: string): Promise<void> {
  let clipboardError: unknown;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch (error) {
      clipboardError = error;
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw clipboardError instanceof Error ? clipboardError : new Error('No se pudo copiar el texto.');
}
