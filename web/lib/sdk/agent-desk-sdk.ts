import type {
  AgentDeskConfig,
  AgentDeskWidget,
  SupportChatRuntimeConfig,
} from "./config-types"

type NormalizedAgentDeskConfig = AgentDeskConfig & {
  baseUrl: string
  channelId: string
  language: string
  position: "left" | "right"
  themeColor: string
  width: string
}

type WidgetState = {
  button: HTMLButtonElement | null
  frame: HTMLIFrameElement | null
  frameLoaded: boolean
  frameReady: boolean
  initSent: boolean
  isOpen: boolean
  isMaximized: boolean
  configLoading: boolean
  frameHideTimer: number | null
  frameDestroyTimer: number | null
  config: NormalizedAgentDeskConfig | null
  frameConfig: SupportChatRuntimeConfig | null
  frameUrl: URL | null
  animationDuration: number
  listenerBound?: boolean
}

type WidgetConfigResponse = {
  success?: boolean
  data?: Partial<Pick<
    AgentDeskConfig,
    "title" | "subtitle" | "themeColor" | "position" | "width"
  >>
}

type PublicConfigResponse = {
  success?: boolean
  data?: {
    language?: string
  }
}

function normalizeWidgetLanguage(language: string | undefined) {
  return String(language || "").toLowerCase().startsWith("en") ? "en-US" : "zh-CN"
}

function getDefaultWidgetTitle(config?: NormalizedAgentDeskConfig | null) {
  return normalizeWidgetLanguage(config?.language) === "en-US" ? "Support" : "\u5728\u7ebf\u5ba2\u670d"
}

function getLauncherText(config?: NormalizedAgentDeskConfig | null) {
  return normalizeWidgetLanguage(config?.language) === "en-US" ? "Support" : "\u5ba2\u670d"
}

type FrameMessage =
  | { type: "agent-desk:init"; payload: SupportChatRuntimeConfig }
  | { type: "agent-desk:open" }
  | { type: "agent-desk:minimize" }
  | { type: "agent-desk:maximized"; payload: { isMaximized: boolean } }

(function () {
  const DEFAULT_CONFIG: Pick<
    NormalizedAgentDeskConfig,
    "language" | "position" | "themeColor" | "width"
  > = {
    language: "zh-CN",
    position: "right",
    themeColor: "#0f6cbd",
    width: "380px",
  }

  const existingState = window.__CS_AI_AGENT_WIDGET_STATE__ as WidgetState | undefined
  const state: WidgetState =
    existingState || {
      button: null,
      frame: null,
      frameLoaded: false,
      frameReady: false,
      initSent: false,
      isOpen: false,
      isMaximized: false,
      configLoading: false,
      frameHideTimer: null,
      frameDestroyTimer: null,
      config: null,
      frameConfig: null,
      frameUrl: null,
      animationDuration: 260,
    }
  if (!existingState) {
    window.__CS_AI_AGENT_WIDGET_STATE__ = state
  }

  function normalizeConfig(config?: AgentDeskConfig): NormalizedAgentDeskConfig {
    const merged: Record<string, unknown> = { ...DEFAULT_CONFIG, ...(config || {}) }
    merged.baseUrl = String(merged.baseUrl || window.location.origin).replace(/\/$/, "")
    if (merged.apiBaseUrl) {
      merged.apiBaseUrl = String(merged.apiBaseUrl).replace(/\/$/, "")
    } else {
      delete merged.apiBaseUrl
    }
    merged.channelId = String(merged.channelId || "")
    merged.language = normalizeWidgetLanguage(String(merged.language || "zh-CN"))
    if (merged.externalId) {
      merged.externalId = String(merged.externalId)
    }
    if (typeof merged.getUserToken !== "function") {
      delete merged.getUserToken
    }
    return merged as NormalizedAgentDeskConfig
  }

  function resolveWidgetBaseUrl(config: NormalizedAgentDeskConfig) {
    const currentScript = document.currentScript as HTMLScriptElement | null
    if (currentScript?.src) {
      return currentScript.src.replace(/\/sdk\/agent-desk-sdk\.min\.js(?:\?.*)?$/, "")
    }
    return String(config.widgetBaseUrl || config.baseUrl || window.location.origin).replace(/\/$/, "")
  }

  function createFrameUrl(config: NormalizedAgentDeskConfig, userToken: string) {
    const widgetBaseUrl = resolveWidgetBaseUrl(config)
    const frameUrl = new URL(`${widgetBaseUrl}/support/chat/`)
    frameUrl.searchParams.set("channelId", config.channelId)
    frameUrl.searchParams.set("baseUrl", config.baseUrl)
    if (config.apiBaseUrl) frameUrl.searchParams.set("apiBaseUrl", config.apiBaseUrl)
    if (config.externalId) frameUrl.searchParams.set("externalId", config.externalId)
    if (config.externalName) frameUrl.searchParams.set("externalName", config.externalName)
    if (userToken) frameUrl.searchParams.set("userToken", userToken)
    return frameUrl
  }

  function createFrameConfig(
    config: NormalizedAgentDeskConfig,
    userToken: string
  ): SupportChatRuntimeConfig {
    const { getUserToken: _getUserToken, ...payload } = config
    if (userToken) {
      return { ...payload, userToken }
    }
    return payload
  }

  function resolveUserToken() {
    const config = state.config
    if (typeof config?.getUserToken !== "function") {
      return Promise.resolve("")
    }
    try {
      return Promise.resolve(config.getUserToken()).then((token) =>
        String(token || "").trim()
      )
    } catch (error) {
      return Promise.reject(error)
    }
  }

  function prepareFrameUrl() {
    return resolveUserToken().then((userToken) => {
      if (!state.config) {
        throw new Error("channelId is required")
      }
      state.frameUrl = createFrameUrl(state.config, userToken)
      state.frameConfig = createFrameConfig(state.config, userToken)
      return state.frameUrl
    })
  }

  function mergeWidgetConfig(
    config: NormalizedAgentDeskConfig,
    remoteConfig?: WidgetConfigResponse["data"]
  ) {
    if (!remoteConfig) {
      return config
    }
    const merged: NormalizedAgentDeskConfig = { ...config }
    const remoteKeys = ["title", "subtitle", "themeColor", "position", "width"] as const
    remoteKeys.forEach((key) => {
      const value = remoteConfig[key]
      if (value !== undefined && value !== null) {
        ;(merged[key] as typeof value) = value
      }
    })
    return merged
  }

  function fetchWidgetConfig(config: NormalizedAgentDeskConfig) {
    const baseUrl = String(config.apiBaseUrl || config.baseUrl || "").replace(/\/$/, "")
    if (!baseUrl || !config.channelId || typeof fetch !== "function") {
      return Promise.resolve(config)
    }
    const url = `${baseUrl}/api/channel/config?channelId=${encodeURIComponent(config.channelId)}`
    return fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        "X-Channel-Id": config.channelId,
      },
    })
      .then((response) => response.json() as Promise<WidgetConfigResponse>)
      .then((payload) => {
        if (!payload || payload.success === false) {
          return config
        }
        return mergeWidgetConfig(config, payload.data || {})
      })
      .catch(() => config)
  }

  function fetchPublicConfig(config: NormalizedAgentDeskConfig) {
    const baseUrl = String(config.apiBaseUrl || config.baseUrl || "").replace(/\/$/, "")
    if (!baseUrl || typeof fetch !== "function") {
      return Promise.resolve(config)
    }
    return fetch(`${baseUrl}/api/config`, {
      method: "GET",
      cache: "no-store",
    })
      .then((response) => response.json() as Promise<PublicConfigResponse>)
      .then((payload) => {
        if (!payload || payload.success === false) {
          return config
        }
        return normalizeConfig({
          ...config,
          language: payload.data?.language || config.language,
        })
      })
      .catch(() => config)
  }

  function clearFrameTimers() {
    if (state.frameHideTimer) {
      window.clearTimeout(state.frameHideTimer)
      state.frameHideTimer = null
    }
    if (state.frameDestroyTimer) {
      window.clearTimeout(state.frameDestroyTimer)
      state.frameDestroyTimer = null
    }
  }

  function applyFrameLayout() {
    const frame = state.frame
    const config = state.config
    if (!frame || !config) {
      return
    }

    frame.style.position = "fixed"
    frame.style.border = "0"
    frame.style.overflow = "hidden"
    frame.style.background = "#fff"
    frame.style.zIndex = "2147483000"
    frame.style.boxShadow = "0 28px 80px rgba(15, 35, 65, 0.28)"
    frame.style.willChange = "top,right,bottom,left,width,height,opacity,transform,border-radius"
    frame.style.transition =
      "top 260ms cubic-bezier(0.22, 1, 0.36, 1), right 260ms cubic-bezier(0.22, 1, 0.36, 1), bottom 260ms cubic-bezier(0.22, 1, 0.36, 1), left 260ms cubic-bezier(0.22, 1, 0.36, 1), width 260ms cubic-bezier(0.22, 1, 0.36, 1), height 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease, transform 260ms cubic-bezier(0.22, 1, 0.36, 1), border-radius 260ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 260ms ease"
    frame.style.transformOrigin =
      config.position === "left" ? "left bottom" : "right bottom"

    if (state.isMaximized) {
      frame.style.top = "max(12px, env(safe-area-inset-top))"
      frame.style.right = "max(12px, env(safe-area-inset-right))"
      frame.style.bottom = "max(12px, env(safe-area-inset-bottom))"
      frame.style.left = "max(12px, env(safe-area-inset-left))"
      frame.style.width =
        "calc(100vw - max(12px, env(safe-area-inset-left)) - max(12px, env(safe-area-inset-right)))"
      frame.style.maxWidth = "none"
      frame.style.height =
        "calc(100dvh - max(12px, env(safe-area-inset-top)) - max(12px, env(safe-area-inset-bottom)))"
      frame.style.borderRadius = "16px"
      return
    }

    frame.style.top = ""
    frame.style.bottom = "max(88px, calc(72px + env(safe-area-inset-bottom)))"
    frame.style.right = config.position === "left" ? "" : "max(12px, env(safe-area-inset-right))"
    frame.style.left = config.position === "left" ? "max(12px, env(safe-area-inset-left))" : ""
    frame.style.width = config.width || "380px"
    frame.style.maxWidth =
      "calc(100vw - max(12px, env(safe-area-inset-left)) - max(12px, env(safe-area-inset-right)))"
    frame.style.height =
      "min(760px, calc(100dvh - max(104px, calc(88px + env(safe-area-inset-bottom))) - max(12px, env(safe-area-inset-top))))"
    frame.style.borderRadius = "18px"
  }

  function postToFrame(message: FrameMessage) {
    if (!state.frame?.contentWindow || !state.frameUrl) {
      return
    }
    try {
      state.frame.contentWindow.postMessage(message, state.frameUrl.origin)
    } catch (error) {
      console.error("[agent-desk-widget] postMessage failed", error)
    }
  }

  function flushFrameState() {
    if (!state.frame || !state.frameLoaded || !state.frameReady || !state.config) {
      return
    }

    if (!state.initSent) {
      state.initSent = true
      postToFrame({
        type: "agent-desk:init",
        payload: state.frameConfig || createFrameConfig(state.config, ""),
      })
    }

    postToFrame({ type: state.isOpen ? "agent-desk:open" : "agent-desk:minimize" })
    postToFrame({
      type: "agent-desk:maximized",
      payload: { isMaximized: state.isMaximized },
    })
  }

  function syncFrameVisibility() {
    const frame = state.frame
    if (!frame) {
      return
    }
    clearFrameTimers()
    applyFrameLayout()
    frame.style.display = "block"

    if (state.isOpen) {
      frame.style.visibility = "visible"
      frame.style.pointerEvents = "auto"
      state.frameHideTimer = window.setTimeout(() => {
        if (!state.frame) {
          return
        }
        state.frame.style.opacity = "1"
        state.frame.style.transform = "translate3d(0, 0, 0) scale(1)"
      }, 16)
      flushFrameState()
      return
    }

    frame.style.pointerEvents = "none"
    frame.style.opacity = "0"
    frame.style.transform = state.isMaximized
      ? "translate3d(0, 10px, 0) scale(0.985)"
      : "translate3d(0, 16px, 0) scale(0.96)"
    state.frameHideTimer = window.setTimeout(() => {
      if (!state.frame || state.isOpen) {
        return
      }
      state.frame.style.visibility = "hidden"
    }, state.animationDuration)
    flushFrameState()
  }

  function destroyFrame() {
    if (!state.frame) {
      return
    }
    clearFrameTimers()
    state.frame.style.pointerEvents = "none"
    state.frame.style.opacity = "0"
    state.frame.style.transform = "translate3d(0, 18px, 0) scale(0.94)"
    state.frame.style.visibility = "hidden"
    state.frameDestroyTimer = window.setTimeout(() => {
      if (!state.frame) {
        return
      }
      if (state.frame.parentNode) {
        state.frame.parentNode.removeChild(state.frame)
      }
      state.frame = null
      state.frameLoaded = false
      state.frameReady = false
      state.initSent = false
      state.isOpen = false
      state.isMaximized = false
      clearFrameTimers()
    }, state.animationDuration)
  }

  function createFrame() {
    if (state.frame) {
      return state.frame
    }
    if (!state.frameUrl || !state.config) {
      return null
    }

    state.frame = document.createElement("iframe")
    state.frame.dataset.agentDeskWidget = "frame"
    state.frame.title = state.config.title || getDefaultWidgetTitle(state.config)
    state.frame.src = state.frameUrl.toString()
    applyFrameLayout()
    state.frame.style.display = "block"
    state.frame.style.visibility = "hidden"
    state.frame.style.pointerEvents = "none"
    state.frame.style.opacity = "0"
    state.frame.style.transform = "translate3d(0, 18px, 0) scale(0.96)"
    state.frame.addEventListener("load", () => {
      state.frameLoaded = true
      syncFrameVisibility()
    })

    document.body.appendChild(state.frame)
    return state.frame
  }

  function handleWindowMessage(event: MessageEvent) {
    if (!state.frame || event.source !== state.frame.contentWindow) {
      return
    }

    const data = (event.data || {}) as { type?: string }
    if (data.type === "agent-desk:ready") {
      state.frameReady = true
      flushFrameState()
      return
    }

    if (data.type === "agent-desk:request-minimize") {
      state.isOpen = false
      syncFrameVisibility()
      return
    }

    if (data.type === "agent-desk:request-close") {
      destroyFrame()
      return
    }

    if (data.type === "agent-desk:request-toggle-maximize") {
      state.isMaximized = !state.isMaximized
      syncFrameVisibility()
    }
  }

  function createLauncher() {
    if (state.button) {
      return state.button
    }

    const config = state.config
    if (!config) {
      return null
    }
    const button = document.createElement("button")
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    const iconPaths = [
      "M3 11a9 9 0 1 1 18 0",
      "M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
      "M21 11h-3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2z",
      "M21 16v2a4 4 0 0 1-4 4h-5",
    ]
    const text = document.createElement("span")
    button.type = "button"
    button.dataset.agentDeskWidget = "launcher"
    button.setAttribute("aria-label", config.title || getDefaultWidgetTitle(config))
    icon.setAttribute("viewBox", "0 0 24 24")
    icon.setAttribute("fill", "none")
    icon.setAttribute("stroke", "currentColor")
    icon.setAttribute("stroke-width", "2")
    icon.setAttribute("stroke-linecap", "round")
    icon.setAttribute("stroke-linejoin", "round")
    icon.setAttribute("aria-hidden", "true")
    icon.style.width = "24px"
    icon.style.height = "24px"
    icon.style.flex = "0 0 auto"
    iconPaths.forEach((pathData) => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
      path.setAttribute("d", pathData)
      icon.appendChild(path)
    })
    text.textContent = getLauncherText(config)
    text.style.display = "block"
    button.style.position = "fixed"
    button.style.bottom = "24px"
    button.style.right = config.position === "left" ? "" : "24px"
    button.style.left = config.position === "left" ? "24px" : ""
    button.style.zIndex = "2147483000"
    button.style.display = "inline-flex"
    button.style.flexDirection = "column"
    button.style.alignItems = "center"
    button.style.justifyContent = "center"
    button.style.gap = "4px"
    button.style.width = "64px"
    button.style.height = "64px"
    button.style.border = "0"
    button.style.borderRadius = "999px"
    button.style.padding = "0"
    button.style.background = config.themeColor || "#0f6cbd"
    button.style.color = "#fff"
    button.style.font = "600 13px/1 sans-serif"
    button.style.boxShadow = "0 18px 40px rgba(15, 35, 65, 0.24)"
    button.style.cursor = "pointer"
    button.appendChild(icon)
    button.appendChild(text)

    button.addEventListener("click", () => {
      if (state.isOpen) {
        state.isOpen = false
        syncFrameVisibility()
        return
      }

      void openWidget()
    })

    document.body.appendChild(button)
    state.button = button
    return button
  }

  function mount(config?: AgentDeskConfig) {
    const rawConfig = config || window.AgentDeskConfig || { channelId: "" }
    state.config = normalizeConfig(rawConfig)
    const widgetBaseUrl = resolveWidgetBaseUrl(state.config)
    if (!rawConfig.baseUrl) {
      state.config.baseUrl = widgetBaseUrl
    }
    if (!state.config.channelId) {
      console.error("[agent-desk-widget] channelId is required")
      return
    }

    state.configLoading = true
    fetchPublicConfig(state.config)
      .then((nextConfig) => fetchWidgetConfig(nextConfig))
      .then((nextConfig) => {
        state.configLoading = false
        state.config = normalizeConfig(nextConfig)
        if (state.button?.parentNode) {
          state.button.parentNode.removeChild(state.button)
          state.button = null
        }
        createLauncher()
      })
  }

  function destroy() {
    clearFrameTimers()
    if (state.frame?.parentNode) {
      state.frame.parentNode.removeChild(state.frame)
    }
    if (state.button?.parentNode) {
      state.button.parentNode.removeChild(state.button)
    }
    state.button = null
    state.frame = null
    state.frameLoaded = false
    state.frameReady = false
    state.initSent = false
    state.isOpen = false
    state.isMaximized = false
    state.configLoading = false
    state.frameConfig = null
    state.frameUrl = null
  }

  function openWidget() {
    return prepareFrameUrl()
      .then(() => {
        if (!state.frame) {
          createFrame()
        }
        if (!state.frame) {
          return
        }
        state.isOpen = true
        syncFrameVisibility()
      })
      .catch((error) => {
        console.error("[agent-desk-widget] open failed", error)
      })
  }

  window.AgentDeskWidget = {
    mount,
    destroy,
    open: () => openWidget(),
    close: () => {
      state.isOpen = false
      syncFrameVisibility()
    },
    getChatUrl: () => {
      if (!state.config) {
        mount(window.AgentDeskConfig || { channelId: "" })
      }
      if (!state.config?.channelId) {
        return Promise.reject(new Error("channelId is required"))
      }
      return prepareFrameUrl().then((frameUrl) => frameUrl.toString())
    },
  } satisfies AgentDeskWidget

  if (!state.listenerBound) {
    window.addEventListener("message", handleWindowMessage)
    state.listenerBound = true
  }

  if (window.AgentDeskConfig) {
    mount(window.AgentDeskConfig)
  }
})()
