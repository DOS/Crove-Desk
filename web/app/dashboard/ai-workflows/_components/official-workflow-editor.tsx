"use client"

import { useEffect, useRef } from "react"

import type { AIWorkflowDefinition } from "@/lib/api/admin"

const MESSAGE_SOURCE = "agent-desk"

type EditorMessage =
  | {
      source: typeof MESSAGE_SOURCE
      type: "workflow:ready"
    }
  | {
      source: typeof MESSAGE_SOURCE
      type: "workflow:change"
      document: AIWorkflowDefinition
    }

export function OfficialWorkflowEditor({
  documentKey,
  definition,
  onDefinitionChange,
  readonly = false,
}: {
  documentKey: string
  definition: AIWorkflowDefinition
  onDefinitionChange: (definition: AIWorkflowDefinition) => void
  readonly?: boolean
}) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const definitionRef = useRef(definition)

  definitionRef.current = definition

  function loadDocument() {
    frameRef.current?.contentWindow?.postMessage(
      {
        source: MESSAGE_SOURCE,
        type: "workflow:load",
        documentKey,
        document: definitionRef.current,
        readonly,
      },
      window.location.origin
    )
  }

  useEffect(() => {
    const handleMessage = (event: MessageEvent<EditorMessage>) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== frameRef.current?.contentWindow ||
        event.data?.source !== MESSAGE_SOURCE
      ) {
        return
      }
      if (event.data.type === "workflow:ready") {
        loadDocument()
      } else if (event.data.type === "workflow:change") {
        onDefinitionChange(event.data.document)
      }
    }
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [documentKey, onDefinitionChange, readonly])

  useEffect(() => {
    loadDocument()
  }, [documentKey, readonly])

  return (
    <iframe
      ref={frameRef}
      src="/flowgram-editor/index.html"
      title="FlowGram 工作流编辑器"
      className="h-full min-h-[560px] w-full border-0 bg-white"
    />
  )
}
