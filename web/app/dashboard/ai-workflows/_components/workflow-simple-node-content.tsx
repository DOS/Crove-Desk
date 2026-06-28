import type { AIWorkflowNodeSpec } from "@/lib/api/admin"

export function WorkflowSimpleNodeContent({
  spec,
}: {
  spec?: AIWorkflowNodeSpec
}) {
  const inputCount = spec?.inputSchema?.length ?? 0
  const outputCount = spec?.outputSchema?.length ?? 0
  const hasSchema = inputCount > 0 || outputCount > 0

  if (!hasSchema && !spec?.riskLevel && !spec?.interruptible) {
    return (
      <div className="text-xs leading-5 text-muted-foreground">
        通过右侧面板配置节点参数
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {inputCount > 0 ? <NodeInfoChip label={`入参 ${inputCount}`} /> : null}
      {outputCount > 0 ? <NodeInfoChip label={`出参 ${outputCount}`} /> : null}
      {spec?.riskLevel ? <NodeInfoChip label={riskLevelLabel(spec.riskLevel)} /> : null}
      {spec?.interruptible ? <NodeInfoChip label="可中断" /> : null}
    </div>
  )
}

function NodeInfoChip({ label }: { label: string }) {
  return (
    <span className="inline-flex h-5 items-center rounded-md border bg-background px-1.5 text-[11px] leading-none text-muted-foreground">
      {label}
    </span>
  )
}

function riskLevelLabel(riskLevel: AIWorkflowNodeSpec["riskLevel"]) {
  if (riskLevel === "high") return "高风险"
  if (riskLevel === "medium") return "中风险"
  return "低风险"
}
