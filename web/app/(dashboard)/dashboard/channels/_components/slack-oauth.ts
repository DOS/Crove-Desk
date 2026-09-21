import type { SlackOAuthConnectResult } from "@/lib/api/admin"

// Contract between the Slack OAuth landing page and the channel form. The
// landing page runs in a popup opened by the form, so the exchanged bot
// credentials travel back over postMessage with the origin pinned to this app.
export const SLACK_OAUTH_MESSAGE = "crove:slack-oauth"

export const SLACK_OAUTH_CALLBACK_PATH = "/dashboard/channels/slack-callback"

export const SLACK_OAUTH_STATE_PREFIX = "crove_slack_connect"

export type SlackOAuthMessage = {
  type: typeof SLACK_OAUTH_MESSAGE
  payload: SlackOAuthConnectResult
}

export function isSlackOAuthMessage(data: unknown): data is SlackOAuthMessage {
  if (typeof data !== "object" || data === null) {
    return false
  }
  const candidate = data as Partial<SlackOAuthMessage>
  return (
    candidate.type === SLACK_OAUTH_MESSAGE &&
    typeof candidate.payload === "object" &&
    candidate.payload !== null
  )
}
