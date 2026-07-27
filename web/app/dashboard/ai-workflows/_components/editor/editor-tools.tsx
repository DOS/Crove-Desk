"use client"

import { useEffect, useRef, useState } from "react"

import {
  FlowDownloadFormat,
  FlowDownloadService,
} from "@flowgram.ai/export-plugin"
import { WorkflowNodePanelService } from "@flowgram.ai/free-node-panel-plugin"
import {
  type InteractiveType,
  getAntiOverlapPosition,
  useClientContext,
  usePlayground,
  usePlaygroundTools,
  useRefresh,
  useService,
  WorkflowDocument,
  WorkflowDragService,
  WorkflowLinesManager,
  WorkflowSelectService,
  type WorkflowNodeEntity,
  type WorkflowNodeJSON,
} from "@flowgram.ai/free-layout-editor"
import { MinimapRender } from "@flowgram.ai/minimap-plugin"
import {
  AlertTriangleIcon,
  CheckIcon,
  DownloadIcon,
  FocusIcon,
  GitBranchIcon,
  HandIcon,
  LayoutDashboardIcon,
  LockIcon,
  MousePointer2Icon,
  MessageSquareTextIcon,
  PlusIcon,
  Redo2Icon,
  Undo2Icon,
  UnlockIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { AIWorkflowValidationResult } from "@/lib/api/admin"

const INTERACTIVE_TYPE_KEY = "workflow_prefer_interactive_type"

export function EditorTools({
  onValidate,
  onValidation,
}: {
  onValidate: () => Promise<AIWorkflowValidationResult>
  onValidation: (result: AIWorkflowValidationResult) => void
}) {
  const tools = usePlaygroundTools({ maxZoom: 2, minZoom: 0.25 })
  const playground = usePlayground()
  const refresh = useRefresh()
  const { history } = useClientContext()
  const document = useService(WorkflowDocument)
  const linesManager = useService(WorkflowLinesManager)
  const selection = useService(WorkflowSelectService)
  const dragService = useService(WorkflowDragService)
  const nodePanel = useService(WorkflowNodePanelService)
  const downloadService = useService(FlowDownloadService)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const [minimapVisible, setMinimapVisible] = useState(true)
  const [validating, setValidating] = useState(false)
  const [interactiveType, setInteractiveType] =
    useState<InteractiveType>("PAD" as InteractiveType)
  const [historyState, setHistoryState] = useState({
    undo: history.canUndo(),
    redo: history.canRedo(),
  })

  useEffect(() => {
    const preferred = readPreferredInteractiveType()
    setInteractiveType(preferred)
    tools.setInteractiveType(preferred)
  }, [tools])

  useEffect(() => {
    const disposable = history.undoRedoService.onChange(() =>
      setHistoryState({ undo: history.canUndo(), redo: history.canRedo() })
    )
    return () => disposable.dispose()
  }, [history])

  useEffect(() => {
    const disposable = playground.config.onReadonlyOrDisabledChange(refresh)
    return () => disposable.dispose()
  }, [playground, refresh])

  async function addNode() {
    const rect = addButtonRef.current?.getBoundingClientRect()
    if (!rect) return
    const position = playground.config.getPosFromMouseEvent({
      clientX: rect.left + 64,
      clientY: rect.top - 7,
    })
    await nodePanel.callNodePanel({
      position,
      enableMultiAdd: true,
      onSelect: async (result) => {
        if (!result) return
        const rect = playground.node.getBoundingClientRect()
        const center = playground.config.getPosFromMouseEvent({
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
        })
        const existingBounds = document
          .getAllNodes()
          .map((item) => item.transform.bounds)
        const position =
          existingBounds.length > 0
            ? {
                x:
                  Math.max(...existingBounds.map((bounds) => bounds.right)) +
                  200,
                y: Math.min(...existingBounds.map((bounds) => bounds.top)),
              }
            : center
        const node: WorkflowNodeEntity = document.createWorkflowNodeByType(
          result.nodeType,
          getAntiOverlapPosition(document, position),
          result.nodeJSON ?? ({} as WorkflowNodeJSON)
        )
        selection.selectNode(node)
        await new Promise<void>((resolve) =>
          window.requestAnimationFrame(() => resolve())
        )
        tools.fitView(false)
      },
      onClose: () => undefined,
    })
  }

  async function validate(purpose: "problem" | "test" = "problem") {
    setValidating(true)
    try {
      const result = await onValidate()
      onValidation(result)
      if (purpose === "test" && result.valid) {
        toast.success(
          "预运行检查已通过；实际工作流会由已关联 Agent 的会话触发"
        )
      }
      return result
    } finally {
      setValidating(false)
    }
  }

  async function createComment(event: React.MouseEvent<HTMLButtonElement>) {
    const position = playground.config.getPosFromMouseEvent(event)
    const node = document.createWorkflowNodeByType(
      "comment",
      { x: position.x, y: position.y - 75 },
      {
        id: `comment_${Date.now()}`,
        type: "comment",
        data: {
          size: { width: 240, height: 150 },
          note: "",
        },
      } as WorkflowNodeJSON
    )
    await new Promise<void>((resolve) =>
      window.requestAnimationFrame(() => resolve())
    )
    selection.selectNode(node)
    if (event.detail !== 0) {
      dragService.startDragSelectedNodes(event)
    }
  }

  async function download(format: FlowDownloadFormat) {
    await downloadService.download({ format })
    toast.success(`已导出 ${format.toUpperCase()}`)
  }

  const readonly = playground.config.readonly

  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-30 flex min-w-[360px] gap-2">
      <div className="pointer-events-auto flex h-10 items-center gap-0.5 rounded-[10px] border border-[rgba(68,83,130,0.25)] bg-white px-1 shadow-[0_2px_6px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.02)]">
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger
              render={
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon-sm" aria-label="交互模式" />
                  }
                />
              }
            >
              {interactiveType === ("MOUSE" as InteractiveType) ? (
                <MousePointer2Icon />
              ) : (
                <HandIcon />
              )}
            </TooltipTrigger>
            <TooltipContent>
              {interactiveType === ("MOUSE" as InteractiveType)
                ? "鼠标友好模式"
                : "触控板友好模式"}
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent side="top" align="start" className="w-[420px] p-3">
            <div className="mb-3 text-base font-semibold">交互模式</div>
            <div className="grid grid-cols-2 gap-2">
              <InteractionOption
                selected={interactiveType === ("MOUSE" as InteractiveType)}
                icon={<MousePointer2Icon />}
                title="鼠标友好"
                description="按住鼠标左键拖动画布，滚轮缩放。"
                onClick={() =>
                  changeInteractiveType(
                    "MOUSE" as InteractiveType,
                    tools.setInteractiveType,
                    setInteractiveType
                  )
                }
              />
              <InteractionOption
                selected={interactiveType === ("PAD" as InteractiveType)}
                icon={<HandIcon />}
                title="触控板友好"
                description="双指移动画布，双指捏合缩放。"
                onClick={() =>
                  changeInteractiveType(
                    "PAD" as InteractiveType,
                    tools.setInteractiveType,
                    setInteractiveType
                  )
                }
              />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <ToolButton
          label="自动布局"
          disabled={readonly}
          onClick={() =>
            void tools.autoLayout({
              enableAnimation: true,
              animationDuration: 1000,
              layoutConfig: { rankdir: "LR", nodesep: 100, ranksep: 100 },
            })
          }
        >
          <LayoutDashboardIcon />
        </ToolButton>
        <ToolButton label="切换线型" onClick={() => linesManager.switchLineType()}>
          <GitBranchIcon />
        </ToolButton>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="w-[50px] rounded-lg border border-[rgba(68,83,130,0.25)] px-1 py-1 text-xs hover:bg-muted"
              />
            }
          >
            {Math.floor(tools.zoom * 100)}%
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start">
            <DropdownMenuItem onClick={() => tools.zoomin()}>
              放大
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => tools.zoomout()}>
              缩小
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {[0.5, 1, 1.5, 2].map((zoom) => (
              <DropdownMenuItem
                key={zoom}
                onClick={() => playground.config.updateZoom(zoom)}
              >
                缩放至 {zoom * 100}%
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <ToolButton label="适应画布" onClick={() => tools.fitView()}>
          <FocusIcon />
        </ToolButton>
        <ToolButton
          label="缩略图"
          active={minimapVisible}
          onClick={() => setMinimapVisible((value) => !value)}
        >
          <LayoutDashboardIcon />
        </ToolButton>
        {minimapVisible ? (
          <div className="absolute bottom-[60px] left-0 w-[198px] overflow-hidden rounded-lg border bg-white shadow-sm">
            <MinimapRender
              panelStyles={{}}
              containerStyles={{
                pointerEvents: "auto",
                position: "relative",
                inset: "unset",
              }}
              inactiveStyle={{
                opacity: 1,
                scale: 1,
                translateX: 0,
                translateY: 0,
              }}
            />
          </div>
        ) : null}
        <ToolButton
          label={readonly ? "切换为可编辑" : "切换为只读"}
          onClick={() => {
            playground.config.readonly = !playground.config.readonly
          }}
        >
          {readonly ? <LockIcon /> : <UnlockIcon />}
        </ToolButton>
        <ToolButton
          label="添加注释"
          disabled={readonly}
          onClick={(event) => void createComment(event)}
        >
          <MessageSquareTextIcon />
        </ToolButton>
        <ToolButton
          label="撤销"
          disabled={!historyState.undo || readonly}
          onClick={() => void history.undo()}
        >
          <Undo2Icon />
        </ToolButton>
        <ToolButton
          label="重做"
          disabled={!historyState.redo || readonly}
          onClick={() => void history.redo()}
        >
          <Redo2Icon />
        </ToolButton>
        <ToolButton
          label="问题"
          disabled={validating}
          onClick={() => void validate("problem")}
        >
          <AlertTriangleIcon />
        </ToolButton>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger
              render={
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon-sm" aria-label="下载" />
                  }
                />
              }
            >
              <DownloadIcon />
            </TooltipTrigger>
            <TooltipContent>下载</TooltipContent>
          </Tooltip>
          <DropdownMenuContent side="top" align="start">
            {Object.values(FlowDownloadFormat).map((format) => (
              <DropdownMenuItem
                key={format}
                disabled={readonly}
                onClick={() => void download(format)}
              >
                {format.toUpperCase()}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="mx-1 h-4 w-px bg-border" />
        <Button
          ref={addButtonRef}
          size="sm"
          className="h-8 rounded-lg border-0 bg-[rgba(171,181,255,0.3)] text-[#4e40e5] shadow-none hover:bg-[rgba(171,181,255,0.45)]"
          disabled={readonly}
          onClick={() => void addNode()}
        >
          <PlusIcon />
          添加节点
        </Button>
        <div className="mx-1 h-4 w-px bg-border" />
        <Button
          size="sm"
          className="h-8 rounded-lg bg-[rgba(171,181,255,0.3)] text-[#4e40e5] shadow-none hover:bg-[rgba(171,181,255,0.45)]"
          disabled={readonly || validating}
          onClick={() => void validate("test")}
        >
          <CheckIcon />
          测试运行
        </Button>
      </div>
    </div>
  )
}

function InteractionOption({
  selected,
  icon,
  title,
  description,
  onClick,
}: {
  selected: boolean
  icon: React.ReactNode
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`rounded-lg border p-3 text-left ${
        selected ? "border-[#4e40e5] bg-[#f5f3ff]" : "hover:bg-muted/50"
      }`}
      onClick={onClick}
    >
      <span className={selected ? "text-[#4e40e5]" : "text-muted-foreground"}>
        {icon}
      </span>
      <span className="mt-2 block text-sm font-semibold">{title}</span>
      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
        {description}
      </span>
    </button>
  )
}

function ToolButton({
  label,
  disabled,
  active,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  active?: boolean
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className={active ? "bg-muted" : undefined}
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function readPreferredInteractiveType() {
  const stored = window.localStorage.getItem(INTERACTIVE_TYPE_KEY)
  if (stored === "MOUSE" || stored === "PAD") {
    return stored as InteractiveType
  }
  return /Macintosh|MacIntel|MacPPC|Mac68K|iPad/.test(navigator.userAgent)
    ? ("PAD" as InteractiveType)
    : ("MOUSE" as InteractiveType)
}

function changeInteractiveType(
  value: InteractiveType,
  update: (value: InteractiveType) => void,
  setValue: (value: InteractiveType) => void
) {
  window.localStorage.setItem(INTERACTIVE_TYPE_KEY, value)
  update(value)
  setValue(value)
}
