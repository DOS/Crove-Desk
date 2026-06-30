import { PlusIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useWorkflowBranchSelection } from "./workflow-branch-selection"
import {
  createConditionBranchID,
  isBranchRowActionTarget,
  normalizeNodeConfig,
  type WorkflowConditionBranch,
} from "./workflow-utils"

export function WorkflowConditionNodeContent({
  configValue,
  nodeId,
  onChange,
}: {
  configValue: Record<string, unknown> | undefined
  nodeId: string
  onChange: (value: Record<string, unknown>) => void
}) {
  const { selectedBranch, onSelectBranch } = useWorkflowBranchSelection()
  const config = normalizeNodeConfig(configValue)
  const branches = ensureConditionBranches(config.branches ?? [])

  const updateBranches = (nextBranches: WorkflowConditionBranch[]) => {
    onChange({
      ...config,
      branches: ensureConditionBranches(nextBranches),
    })
  }
  const deleteBranch = (branchId: string) => {
    updateBranches(branches.filter((branch) => branch.id !== branchId))
    if (selectedBranch?.nodeId === nodeId && selectedBranch.branchId === branchId) {
      onSelectBranch?.(null)
    }
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        {branches.map((branch, index) => (
          <WorkflowConditionBranchRow
            key={branch.id}
            branch={branch}
            index={index}
            selected={selectedBranch?.nodeId === nodeId && selectedBranch.branchId === branch.id}
            onSelect={() => onSelectBranch?.({ nodeId, branchId: branch.id })}
            onDelete={() => deleteBranch(branch.id)}
          />
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-muted-foreground"
        onClick={(event) => {
          event.stopPropagation()
          updateBranches([
            ...branches,
            {
              id: createConditionBranchID(branches),
              name: "新条件",
              targetNodeId: "",
              condition: { operator: "eq" },
            },
          ])
        }}
      >
        <PlusIcon className="size-3.5" />
        添加条件
      </Button>
    </div>
  )
}

function WorkflowConditionBranchRow({
  branch,
  index,
  selected,
  onSelect,
  onDelete,
}: {
  branch: WorkflowConditionBranch
  index: number
  selected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const branchType = branch.default ? "else" : index === 0 ? "if" : "elseif"

  return (
    <div
      className={cn(
        "relative flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
        selected
          ? "border-(--g-selection-background) bg-background shadow-sm"
          : "border-border/50 bg-background/70 hover:border-border hover:bg-background"
      )}
      onPointerDownCapture={(event) => {
        event.stopPropagation()
        if (isBranchRowActionTarget(event.target)) {
          return
        }
        onSelect()
      }}
      onMouseDownCapture={(event) => {
        event.stopPropagation()
      }}
      onClick={(event) => {
        event.stopPropagation()
      }}
    >
      <span className="shrink-0 rounded-md border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
        {branchType}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium text-foreground/90">
        {branch.name || (branch.default ? "默认分支" : branch.id)}
      </span>
      {branch.default ? null : (
        <button
          type="button"
          className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          aria-label={`删除条件 ${branch.name || branch.id}`}
          onPointerDownCapture={(event) => {
            event.stopPropagation()
          }}
          onMouseDownCapture={(event) => {
            event.stopPropagation()
          }}
          onClick={(event) => {
            event.stopPropagation()
            onDelete()
          }}
        >
          <XIcon className="size-3.5" />
        </button>
      )}
      <span
        data-port-id={branch.id}
        data-port-type="output"
        className="absolute -right-4 top-1/2 size-0"
      />
    </div>
  )
}

function ensureConditionBranches(branches: WorkflowConditionBranch[]) {
  const normalized = branches.some((branch) => branch.default)
    ? branches
    : [...branches, { id: "default", name: "默认分支", targetNodeId: "", default: true }]
  return [
    ...normalized.filter((branch) => !branch.default),
    ...normalized.filter((branch) => branch.default).slice(0, 1),
  ]
}
