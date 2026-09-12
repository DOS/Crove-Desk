import type { WhatsAppOAuthConnectResult } from "@/lib/api/admin"

// Contract between the Meta OAuth landing page and the channel form. The landing
// page runs in a popup opened by the form, so the exchanged credentials travel
// back over postMessage with the origin pinned to this app.
export const WHATSAPP_OAUTH_MESSAGE = "crove:whatsapp-oauth"

export const WHATSAPP_OAUTH_CALLBACK_PATH = "/dashboard/channels/whatsapp-callback"

export const WHATSAPP_OAUTH_STATE_PREFIX = "crove_whatsapp_connect"

export type WhatsAppOAuthMessage = {
  type: typeof WHATSAPP_OAUTH_MESSAGE
  payload: WhatsAppOAuthConnectResult
}

export function isWhatsAppOAuthMessage(data: unknown): data is WhatsAppOAuthMessage {
  if (typeof data !== "object" || data === null) {
    return false
  }
  const candidate = data as Partial<WhatsAppOAuthMessage>
  return (
    candidate.type === WHATSAPP_OAUTH_MESSAGE &&
    typeof candidate.payload === "object" &&
    candidate.payload !== null
  )
}

// The webhook routes require a bound channel id: an unbound URL would let anyone
// confirm a Meta webhook subscription they do not own.
export function whatsAppWebhookPath(channelId: string | undefined) {
  const bound = channelId?.trim()
  return bound ? `/api/third/whatsapp/webhook/${bound}` : ""
}
