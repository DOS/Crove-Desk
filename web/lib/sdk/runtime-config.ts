import type { SupportChatRuntimeConfig } from "@/lib/sdk/config-types"

export function readSupportChatRuntimeConfig(): SupportChatRuntimeConfig {
  if (typeof window === "undefined") {
    return {
      channelId: "",
      baseUrl: "",
      apiBaseUrl: "",
    }
  }

  // The query string is the bootstrap source rather than a convenience fallback:
  // chat-shell calls bootstrap() on mount without waiting for the agent-desk:init
  // postMessage, so these values are what the first API calls actually run with.
  // externalId and userToken therefore cannot simply be dropped from the frame URL
  // to keep them out of browser history and proxy logs - the widget would fall back
  // to its own localStorage guest id and quietly attach an integrating site's
  // returning visitor to a different customer.
  const query = new URLSearchParams(window.location.search)
  const fallback: SupportChatRuntimeConfig = {
    channelId:
      query.get("channelId") ??
      process.env.NEXT_PUBLIC_OPEN_IM_CHANNEL_ID?.trim() ??
      "",
    baseUrl:
      query.get("baseUrl") ??
      process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ??
      window.location.origin,
    apiBaseUrl:
      query.get("apiBaseUrl") ??
      process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ??
      undefined,
    externalId: query.get("externalId") ?? undefined,
    externalName: query.get("externalName") ?? undefined,
    userToken: query.get("userToken") ?? undefined,
    title: query.get("title") ?? undefined,
    subtitle: query.get("subtitle") ?? undefined,
    position: (query.get("position") as "left" | "right" | null) ?? undefined,
    themeColor: query.get("themeColor") ?? undefined,
    width: query.get("width") ?? undefined,
  }

  if (window.__CS_AI_AGENT_WIDGET_CONFIG__) {
    return window.__CS_AI_AGENT_WIDGET_CONFIG__
  }
  if (window.AgentDeskConfig) {
    const { getUserToken: _getUserToken, ...hostConfig } = window.AgentDeskConfig
    return {
      ...fallback,
      ...hostConfig,
    }
  }
  return fallback
}

export function setSupportChatRuntimeConfig(config: SupportChatRuntimeConfig) {
  if (typeof window === "undefined") {
    return
  }
  window.__CS_AI_AGENT_WIDGET_CONFIG__ = config
}
