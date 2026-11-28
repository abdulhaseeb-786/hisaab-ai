/** Copy text to the clipboard. HisaabAI never sends messages itself; the shopkeeper decides where to paste. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers and insecure origins: fall back to a hidden textarea.
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}

/** Drafts mark headings as *bold*; on screen they are shown bold, when copied the stars are removed. */
export function plainDraft(text: string): string {
  return text.replace(/\*([^*\n]+)\*/g, '$1');
}
