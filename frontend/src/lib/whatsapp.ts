/**
 * WhatsApp links. The demo store's phone numbers are placeholders, so in demo mode we
 * open WhatsApp's "choose a chat" screen with the text ready, instead of messaging a
 * number that might belong to a real person.
 */
const DEMO_MODE = true;

export function whatsappShareUrl(text: string, phone?: string | null): string {
  const encoded = encodeURIComponent(text);
  if (!DEMO_MODE && phone) {
    const digits = phone.replace(/\D/g, '').replace(/^0/, '92');
    return `https://wa.me/${digits}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
