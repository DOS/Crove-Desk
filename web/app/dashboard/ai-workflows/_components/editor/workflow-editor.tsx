"use client"

import { useState } from "react"

import {
  EditorRenderer,
  FreeLayoutEditorProvider,
} from "@flowgram.ai/free-layout-editor"
import { DockedPanelLayer } from "@flowgram.ai/panel-manager-plugin"
import { AlertCircleIcon, CheckCircle2Icon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type {
  AIWorkflowDefinition,
  AIWorkflowNodeSpec,
  AIWorkflowValidationResult,
} from "@/lib/api/admin"

import { EditorTools } from "./editor-tools"
import { EditorCanvasEvents } from "./editor-canvas-events"
import { WorkflowEditorContextProvider } from "./editor-context"
import { useWorkflowEditorProps } from "./editor-provider"

export function WorkflowEditor({
  definition,
  nodeSpecs,
  onDefinitionChange,
  onValidate,
}: {
  definition: AIWorkflowDefinition
  nodeSpecs: AIWorkflowNodeSpec[]
  onDefinitionChange: (definition: AIWorkflowDefinition) => void
  onValidate: () => Promise<AIWorkflowValidationResult>
}) {
  const [validation, setValidation] =
    useState<AIWorkflowValidationResult | null>(null)
  const props = useWorkflowEditorProps({
    definition,
    nodeSpecs,
    onDefinitionChange,
  })

  return (
    <WorkflowEditorContextProvider value={{ nodeSpecs, readonly: false }}>
      <div className="relative h-full min-h-[560px] overflow-hidden bg-slate-50">
        <FreeLayoutEditorProvider {...props}>
          <DockedPanelLayer>
            <EditorRenderer className="h-full w-full" />
            <EditorCanvasEvents />
            <EditorTools
              onValidate={onValidate}
              onValidation={setValidation}
            />
          </DockedPanelLayer>
          {validation ? (
            <ProblemPanel
              validation={validation}
              onClose={() => setValidation(null)}
            />
          ) : null}
        </FreeLayoutEditorProvider>
      </div>
    </WorkflowEditorContextProvider>
  )
}

function ProblemPanel({
  validation,
  onClose,
}: {
  validation: AIWorkflowValidationResult
  onClose: () => void
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-40 h-[210px] border-t border-[rgba(82,100,154,0.13)] bg-[#fbfbfb] shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
      <div className="flex h-[50px] items-center justify-between px-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          问题
          {validation.valid ? (
            <CheckCircle2Icon className="size-4 text-emerald-600" />
          ) : (
            <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] leading-none text-white">
              {validation.errors.length}
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <XIcon />
        </Button>
      </div>
      <div className="h-[160px] overflow-y-auto px-3 pb-3">
        {validation.valid ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            未发现问题
          </div>
        ) : (
          <div className="space-y-1">
            {validation.errors.map((error, index) => (
              <div
                key={`${error.field}-${index}`}
                className="flex items-start gap-2 rounded border border-border px-3 py-2 text-sm"
              >
                <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {error.field}
                  </div>
                  <div className="mt-0.5">{error.message}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function WorkflowReadonlyCanvas({
  definition,
  nodeSpecs = [],
}: {
  definition: AIWorkflowDefinition
  nodeSpecs?: AIWorkflowNodeSpec[]
}) {
  const resolvedSpecs =
    nodeSpecs.length > 0
      ? nodeSpecs
      : Array.from(new Set(definition.nodes.map((node) => node.type))).map(
          (type) => ({
            type,
            title:
              String(
                definition.nodes.find((node) => node.type === type)?.data?.title
              ) || type,
            description: "工作流节点",
            icon: type === "start" ? "PlayCircleIcon" : type === "end" ? "FlagIcon" : "GitBranchIcon",
            riskLevel: "low" as const,
            interruptible: false,
            requiresConfirmationPredecessor: false,
          })
        )
  const props = useWorkflowEditorProps({
    definition,
    nodeSpecs: resolvedSpecs,
    readonly: true,
  })
  return (
    <WorkflowEditorContextProvider value={{ nodeSpecs: resolvedSpecs, readonly: true }}>
      <FreeLayoutEditorProvider {...props}>
        <EditorRenderer className="h-full w-full" />
      </FreeLayoutEditorProvider>
    </WorkflowEditorContextProvider>
  )
}
