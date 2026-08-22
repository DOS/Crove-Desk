"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import {
  fetchKnowledgeRetrieveLog,
  type KnowledgeRetrieveHit,
  type KnowledgeRetrieveLogDetail,
} from "@/lib/api/admin"
import { formatDateTime } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useI18n } from "@/i18n/provider"
import {
  getKnowledgeAnswerStatusLabel,
  getKnowledgeChunkProviderLabel,
  getKnowledgeRetrieveChannelLabel,
  getKnowledgeRetrieveSceneLabel,
} from "@/lib/knowledge-i18n"

type RetrieveLogDetailDrawerProps = {
  open: boolean
  retrieveLogId: number | null
  onOpenChange: (open: boolean) => void
}

function safeParseJSON(value: string) {
  if (!value) {
    return null
  }
  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return null
  }
}

type TFunction = (key: string, values?: Record<string, string | number>) => string

function CitationList({ hits, t }: { hits: KnowledgeRetrieveHit[]; t: TFunction }) {
  const citations = hits.filter((item) => item.isCitation)
  if (citations.length === 0) {
    return <div className="text-sm text-muted-foreground">{t("knowledge.noCitations")}</div>
  }
  return (
    <div className="space-y-3">
      {citations.map((item) => (
        <div key={item.id} className="rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <span className="font-medium">{getHitSourceLabel(item, t)}</span>
            <Badge variant="outline">Chunk #{item.chunkNo}</Badge>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {item.sectionPath || item.title || t("knowledge.unrecordedSection")}
          </div>
          <div className="mt-2 text-sm leading-6 whitespace-pre-wrap text-foreground/90">
            {item.snippet || "-"}
          </div>
        </div>
      ))}
    </div>
  )
}

export function RetrieveLogDetailDrawer({
  open,
  retrieveLogId,
  onOpenChange,
}: RetrieveLogDetailDrawerProps) {
  const t = useI18n()
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<KnowledgeRetrieveLogDetail | null>(null)

  const loadDetail = useCallback(async () => {
    if (!retrieveLogId) {
      setDetail(null)
      return
    }
    setLoading(true)
    try {
      const data = await fetchKnowledgeRetrieveLog(retrieveLogId)
      setDetail(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("knowledge.loadRetrieveLogDetailFailed"))
    } finally {
      setLoading(false)
    }
  }, [retrieveLogId, t])

  useEffect(() => {
    if (open && retrieveLogId) {
      void loadDetail()
    }
  }, [open, retrieveLogId, loadDetail])

  const traceData = useMemo(() => safeParseJSON(detail?.log.traceData ?? ""), [detail?.log.traceData])

  if (!open) {
    return null
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="max-w-3xl">
        <DrawerHeader>
          <DrawerTitle>{t("knowledge.retrieveLogDetail")}</DrawerTitle>
          <DrawerDescription>
            {detail?.log.question || (loading ? t("knowledge.loading") : t("knowledge.retrieveLogNotFound"))}
          </DrawerDescription>
        </DrawerHeader>
        <ScrollArea className="h-[calc(100vh-6rem)] px-4 pb-6">
          {!detail ? (
            <div className="py-6 text-sm text-muted-foreground">
              {loading ? t("knowledge.loadingDetail") : t("knowledge.emptyDetail")}
            </div>
          ) : (
            <div className="space-y-6 pb-6">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">{t("knowledge.requestInfo")}</h3>
                <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted-foreground">{t("knowledge.title")}</div>
                    <div className="mt-1 text-sm">{detail.log.knowledgeBaseName || `#${detail.log.knowledgeBaseId}`}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{t("knowledge.createdAt")}</div>
                    <div className="mt-1 text-sm">{formatDateTime(detail.log.createdAt)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{t("knowledge.channelScene")}</div>
                    <div className="mt-1 text-sm">
                      {getKnowledgeRetrieveChannelLabel(detail.log.channel, detail.log.channelName, t)} /{" "}
                      {getKnowledgeRetrieveSceneLabel(detail.log.scene, detail.log.sceneName, t)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Request ID</div>
                    <div className="mt-1 break-all font-mono text-xs">{detail.log.requestId || "-"}</div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-xs text-muted-foreground">{t("knowledge.originalQuestion")}</div>
                    <div className="mt-1 text-sm leading-6 whitespace-pre-wrap">{detail.log.question || "-"}</div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-xs text-muted-foreground">{t("knowledge.rewriteQuestion")}</div>
                    <div className="mt-1 text-sm leading-6 whitespace-pre-wrap">{detail.log.rewriteQuestion || "-"}</div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-xs text-muted-foreground">{t("knowledge.answerContent")}</div>
                    <div className="mt-1 text-sm leading-6 whitespace-pre-wrap">{detail.log.answer || "-"}</div>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">{t("knowledge.retrieveStrategy")}</h3>
                <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-3">
                  <Metric
                    label="Chunk Provider"
                    value={detail.log.chunkProvider ? getKnowledgeChunkProviderLabel(detail.log.chunkProvider, t) : "-"}
                    mono
                  />
                  <Metric label="Target Tokens" value={detail.log.chunkTargetTokens} />
                  <Metric label="Max Tokens" value={detail.log.chunkMaxTokens} />
                  <Metric label="Overlap Tokens" value={detail.log.chunkOverlapTokens} />
                  <Metric label="Rerank" value={detail.log.rerankEnabled ? t("knowledge.rerankEnabled") : t("knowledge.rerankDisabled")} />
                  <Metric label="Rerank Limit" value={detail.log.rerankLimit} />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">{t("knowledge.resultSummary")}</h3>
                <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-4">
                  <Metric
                    label={t("knowledge.answerStatus")}
                    value={getKnowledgeAnswerStatusLabel(detail.log.answerStatus, detail.log.answerStatusName, t)}
                  />
                  <Metric label={t("knowledge.hitCount")} value={detail.log.hitCount} />
                  <Metric label={t("knowledge.citations")} value={detail.log.citationCount} />
                  <Metric label={t("knowledge.contextChunks")} value={detail.log.usedChunkCount} />
                  <Metric label="Top Score" value={detail.log.topScore.toFixed(4)} mono />
                  <Metric label={t("knowledge.retrieveMs")} value={`${detail.log.retrieveMs} ms`} />
                  <Metric label={t("knowledge.generateMs")} value={`${detail.log.generateMs} ms`} />
                  <Metric label={t("knowledge.totalMs")} value={`${detail.log.latencyMs} ms`} />
                  <Metric label="Prompt Tokens" value={detail.log.promptTokens} />
                  <Metric label="Completion Tokens" value={detail.log.completionTokens} />
                  <Metric label={t("knowledge.model")} value={detail.log.modelName || "-"} mono />
                  <Metric label={t("knowledge.sessionId")} value={detail.log.sessionId || "-"} mono />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">{t("knowledge.citationSources")}</h3>
                <CitationList hits={detail.hits} t={t} />
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{t("knowledge.hitDetails")}</h3>
                  <div className="text-xs text-muted-foreground">{t("knowledge.itemsCount", { count: detail.hits.length })}</div>
                </div>
                <div className="space-y-3">
                  {detail.hits.map((item) => (
                    <div key={item.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">#{item.rankNo}</Badge>
                        <span className="font-medium">{getHitSourceLabel(item, t)}</span>
                        <Badge variant={item.usedInAnswer ? "default" : "secondary"}>
                          {item.usedInAnswer ? t("knowledge.usedInContext") : t("knowledge.notUsedInContext")}
                        </Badge>
                        {item.isCitation ? <Badge>{t("knowledge.citations")}</Badge> : null}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>{t("knowledge.section", { section: item.sectionPath || item.title || "-" })}</span>
                        <span>Chunk #{item.chunkNo}</span>
                        <span>Provider：{item.provider || "-"}</span>
                        <span>Score：{item.score.toFixed(4)}</span>
                        <span>Rerank：{item.rerankScore ? item.rerankScore.toFixed(4) : "-"}</span>
                      </div>
                      <Separator className="my-3" />
                      <div className="text-sm leading-6 whitespace-pre-wrap text-foreground/90">
                        {item.snippet || "-"}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">TraceData</h3>
                <div className="rounded-lg border bg-muted/20 p-4">
                  <pre className="overflow-x-auto text-xs leading-6 text-muted-foreground">
                    {traceData ? JSON.stringify(traceData, null, 2) : detail.log.traceData || "-"}
                  </pre>
                </div>
              </section>
            </div>
          )}
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  )
}

function getHitSourceLabel(item: KnowledgeRetrieveHit, t: TFunction) {
  if (item.faqQuestion) {
    return item.faqQuestion
  }
  if (item.documentTitle) {
    return item.documentTitle
  }
  if (item.faqId > 0) {
    return `FAQ #${item.faqId}`
  }
  return `${t("knowledge.document")} #${item.documentId}`
}

function Metric({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string | number
  mono?: boolean
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-sm ${mono ? "font-mono" : ""}`}>{String(value || value === 0 ? value : "-")}</div>
    </div>
  )
}
