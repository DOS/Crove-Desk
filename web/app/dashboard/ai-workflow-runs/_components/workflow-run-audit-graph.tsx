"use client"

import { useMemo, useState } from "react"

import { AlertTriangleIcon, CheckCircle2Icon, TimerIcon } from "lucide-react"

import { JsonTreeViewer } from "@/components/json-tree-viewer"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { AIWorkflowNodeRun, AIWorkflowRun } from "@/lib/api/admin"
import { cn } from "@/lib/utils"

import { OfficialWorkflowEditor } from "../../ai-workflows/_components/official-workflow-editor"

export function WorkflowRunAuditGraph({ run }: { run: AIWorkflowRun }) {
  const nodeRuns = useMemo(() => run.nodes ?? [], [run.nodes])
  const firstNodeId = nodeRuns[0]?.nodeId ?? run.definition?.nodes?.[0]?.id ?? ""
  const [selectedNodeId, setSelectedNodeId] = useState(firstNodeId)
  const selectedNodeRun = nodeRuns.find((item) => item.nodeId === selectedNodeId) ?? nodeRuns[0]
  const executedNodeIds = useMemo(() => new Set(nodeRuns.map((item) => item.nodeId)), [nodeRuns])

  return (
    <div className="grid min-h-[520px] grid-cols-[minmax(0,1fr)_320px] overflow-hidden border">
      <div className="relative min-w-0">
        <OfficialWorkflowEditor
          documentKey={`run-${run.id}`}
          definition={run.definition ?? { nodes: [], edges: [] }}
          onDefinitionChange={() => undefined}
          readonly
        />
        <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2Icon className="size-3" />
            已执行 {executedNodeIds.size}
          </Badge>
          {run.errorMessage ? (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangleIcon className="size-3" />
              异常
            </Badge>
          ) : null}
        </div>
      </div>
      <aside className="flex min-h-0 flex-col border-l bg-background">
        <div className="border-b p-3">
          <div className="text-sm font-medium">节点轨迹</div>
          <div className="mt-1 text-xs text-muted-foreground">点击查看输入、输出和错误信息</div>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-2 p-3">
            {nodeRuns.map((node) => (
              <button
                key={node.id || node.nodeId}
                type="button"
                className={cn(
                  "w-full rounded-md border p-2 text-left text-xs hover:bg-muted",
                  selectedNodeId === node.nodeId ? "border-primary bg-primary/5" : "bg-background"
                )}
                onClick={() => setSelectedNodeId(node.nodeId)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{node.nodeId}</span>
                  <Badge variant={node.errorMessage ? "destructive" : "secondary"}>{node.statusName}</Badge>
                </div>
                <div className="mt-1 flex items-center gap-1 text-muted-foreground">
                  <TimerIcon className="size-3" />
                  {node.durationMs ?? 0}ms
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
        <div className="max-h-72 overflow-auto border-t p-3">
          <NodeRunPreview nodeRun={selectedNodeRun} />
        </div>
      </aside>
    </div>
  )
}

function NodeRunPreview({ nodeRun }: { nodeRun?: AIWorkflowNodeRun }) {
  if (!nodeRun) {
    return <div className="text-xs text-muted-foreground">暂无节点执行记录。</div>
  }
  return (
    <div className="space-y-3 text-xs">
      {nodeRun.errorMessage ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-destructive">
          {nodeRun.errorMessage}
        </div>
      ) : null}
      <PreviewBlock title="输入" value={nodeRun.inputPreview} />
      <PreviewBlock title="输出" value={nodeRun.outputPreview} />
    </div>
  )
}

function PreviewBlock({ title, value }: { title: string; value?: string }) {
  return (
    <div>
      <div className="mb-1 font-medium">{title}</div>
      {value ? <JsonTreeViewer value={parsePreview(value)} /> : <div className="text-muted-foreground">无</div>}
    </div>
  )
}

function parsePreview(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}
