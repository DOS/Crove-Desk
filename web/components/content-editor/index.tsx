"use client"

import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"
import { useConfirm } from "@/components/confirm-provider"

import { htmlToMarkdown, markdownToHtml } from "./convert"
import { HtmlEditor } from "./html-editor"
import { MarkdownEditor } from "./markdown-editor"
import {
  CONTENT_MODE_OPTIONS,
  type ContentMode,
  type ContentValue,
  type UploadImageHandler,
} from "./types"
import { useI18n } from "@/i18n/provider"

type ContentEditorProps = {
  value: ContentValue
  onChange: (next: ContentValue) => void
  placeholder?: string
  disabled?: boolean
  onUploadImage?: UploadImageHandler
  height?: number | string
  allowedModes?: ReadonlyArray<ContentMode>
  scrollMode?: "editor" | "document"
  className?: string
}

function normalizeHeight(height?: number | string) {
  if (typeof height === "number") {
    return `${height}px`
  }
  if (typeof height === "string" && height.trim()) {
    return height
  }
  return "400px"
}

function getModeLabel(mode: ContentMode, t: (key: string) => string) {
  return mode === "markdown" ? t("editor.modeLabelMarkdown") : t("editor.modeLabelRichText")
}

function convertContent(mode: ContentMode, raw: string) {
  if (mode === "markdown") {
    return markdownToHtml(raw)
  }
  return htmlToMarkdown(raw)
}

export function ContentEditor({
  value,
  onChange,
  placeholder,
  disabled = false,
  onUploadImage,
  height,
  allowedModes = CONTENT_MODE_OPTIONS,
  scrollMode = "editor",
  className,
}: ContentEditorProps) {
  const t = useI18n()
  const confirm = useConfirm()
  const editorHeight = normalizeHeight(height)
  const [fullscreen, setFullscreen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const effectiveScrollMode = fullscreen ? "editor" : scrollMode
  const normalizedAllowedModes = allowedModes.length > 0 ? allowedModes : CONTENT_MODE_OPTIONS
  const activeMode = normalizedAllowedModes.includes(value.mode)
    ? value.mode
    : normalizedAllowedModes[0]

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!fullscreen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFullscreen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [fullscreen])

  const handleModeChange = useCallback(
    async (nextMode: ContentMode) => {
      if (
        disabled ||
        normalizedAllowedModes.length <= 1 ||
        nextMode === activeMode ||
        !normalizedAllowedModes.includes(nextMode)
      ) {
        return
      }
      const currentText = value.raw.trim()
      if (!currentText) {
        onChange({ mode: nextMode, raw: "" })
        return
      }

      if (activeMode === "markdown" && nextMode === "html") {
        onChange({ mode: nextMode, raw: convertContent(activeMode, value.raw) })
        return
      }

      const confirmed = await confirm({
        title: t("editor.modeSwitchTitle", { mode: getModeLabel(nextMode, t) }),
        description: t("editor.modeSwitchDescription"),
        confirmText: t("editor.modeSwitchAction"),
        cancelText: t("editor.modeSwitchCancel"),
      })
      if (!confirmed) {
        return
      }

      onChange({
        mode: nextMode,
        raw: convertContent(activeMode, value.raw),
      })
    },
    [activeMode, confirm, disabled, normalizedAllowedModes, onChange, t, value.raw]
  )

  useEffect(() => {
    if (value.mode !== activeMode) {
      onChange({ mode: activeMode, raw: value.raw })
    }
  }, [activeMode, onChange, value.mode, value.raw])

  const content = (
    <div
      className={cn(
        "w-full",
        effectiveScrollMode === "document" && "content-editor-document",
        !fullscreen && className,
        fullscreen && "fixed inset-0 z-[10000] overflow-hidden bg-background p-4"
      )}
    >
      {activeMode === "markdown" ? (
        <MarkdownEditor
          value={value.raw}
          onChange={(nextRaw) => onChange({ mode: "markdown", raw: nextRaw })}
          mode={activeMode}
          allowedModes={normalizedAllowedModes}
          onModeChange={handleModeChange}
          fullscreen={fullscreen}
          onToggleFullscreen={() => setFullscreen((current) => !current)}
          placeholder={placeholder}
          disabled={disabled}
          onUploadImage={onUploadImage}
          height={fullscreen ? "calc(100vh - 2rem)" : editorHeight}
          scrollMode={effectiveScrollMode}
        />
      ) : (
        <HtmlEditor
          value={value.raw}
          onChange={(nextRaw) => onChange({ mode: "html", raw: nextRaw })}
          mode={activeMode}
          allowedModes={normalizedAllowedModes}
          onModeChange={handleModeChange}
          fullscreen={fullscreen}
          onToggleFullscreen={() => setFullscreen((current) => !current)}
          placeholder={placeholder}
          disabled={disabled}
          onUploadImage={onUploadImage}
          height={fullscreen ? "calc(100vh - 2rem)" : editorHeight}
          scrollMode={effectiveScrollMode}
        />
      )}
    </div>
  )

  if (fullscreen && mounted) {
    return createPortal(content, document.body)
  }

  return content
}

export type { ContentMode, ContentValue, UploadImageHandler, UploadImageResult } from "./types"
