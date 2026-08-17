"use client"

import { useCallback, useEffect, useRef } from "react"

import type { AIWorkflowDefinition, AIWorkflowNodeSpec } from "@/lib/api/admin"

const MESSAGE_SOURCE = "agent-desk"
const EMPTY_NODE_SPECS: AIWorkflowNodeSpec[] = []

function definitionsEqual(
  left: AIWorkflowDefinition,
  right: AIWorkflowDefinition
) {
  return JSON.stringify(left) === JSON.stringify(right)
}

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
  nodeSpecs = EMPTY_NODE_SPECS,
  onDefinitionChange,
  readonly = false,
}: {
  documentKey: string
  definition: AIWorkflowDefinition
  nodeSpecs?: AIWorkflowNodeSpec[]
  onDefinitionChange: (definition: AIWorkflowDefinition) => void
  readonly?: boolean
}) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const definitionRef = useRef(definition)

  useEffect(() => {
    definitionRef.current = definition
  }, [definition])

  const loadDocument = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage(
      {
        source: MESSAGE_SOURCE,
        type: "workflow:load",
        documentKey,
        document: definitionRef.current,
        nodeSpecs,
        readonly,
      },
      window.location.origin
    )
  }, [documentKey, nodeSpecs, readonly])

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
        if (definitionsEqual(event.data.document, definitionRef.current)) {
          return
        }
        definitionRef.current = event.data.document
        onDefinitionChange(event.data.document)
      }
    }
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [loadDocument, onDefinitionChange])

  useEffect(() => {
    loadDocument()
  }, [loadDocument])

  return (
    <iframe
      ref={frameRef}
      src="/flowgram-editor/index.html"
      title="FlowGram 工作流编辑器"
      className="h-full min-h-[560px] w-full border-0 bg-white"
    />
  )
}
