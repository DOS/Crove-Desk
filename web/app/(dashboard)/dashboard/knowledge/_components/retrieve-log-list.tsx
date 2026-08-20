"use client"

import { useMemo, useState } from "react"
import { SearchIcon } from "lucide-react"

import {
  fetchKnowledgeRetrieveLogs,
  type KnowledgeRetrieveLog,
} from "@/lib/api/admin"
import {
  KnowledgeAnswerStatus,
  KnowledgeRetrieveChannel,
  KnowledgeRetrieveScene,
} from "@/lib/generated/enums"
import {
  getKnowledgeAnswerStatusLabel,
  getKnowledgeChunkProviderLabel,
  getKnowledgeRetrieveChannelLabel,
  getKnowledgeRetrieveSceneLabel,
} from "@/lib/knowledge-i18n"
import { formatDateTime } from "@/lib/utils"
import { useI18n } from "@/i18n/provider"
import { DashboardListPage } from "@/components/dashboard/list"
import { Badge } from "@/components/ui/badge"
import { RetrieveLogDetailDrawer } from "./retrieve-log-detail"

type RetrieveLogListProps = {
  knowledgeBaseId: number | null
}

type TFunction = (key: string, values?: Record<string, string | number>) => string

function getChannelOptions(t: TFunction) {
  return [
    { value: "all", label: t("knowledge.allChannels") },
    { value: KnowledgeRetrieveChannel.IM, label: t("knowledge.channelIM") },
    { value: KnowledgeRetrieveChannel.AgentAssist, label: t("knowledge.channelAgentAssist") },
    { value: KnowledgeRetrieveChannel.API, label: t("knowledge.channelAPI") },
    { value: KnowledgeRetrieveChannel.Debug, label: t("knowledge.channelDebug") },
  ]
}

function getSceneOptions(t: TFunction) {
  return [
    { value: "all", label: t("knowledge.allScenes") },
    { value: KnowledgeRetrieveScene.FirstResponse, label: t("knowledge.sceneFirstResponse") },
    { value: KnowledgeRetrieveScene.Assist, label: t("knowledge.sceneAssist") },
    { value: KnowledgeRetrieveScene.QA, label: t("knowledge.sceneQA") },
  ]
}

function getAnswerStatusOptions(t: TFunction) {
  return [
    { value: "all", label: t("knowledge.allAnswerStatus") },
    { value: String(KnowledgeAnswerStatus.Normal), label: t("knowledge.answerNormal") },
    { value: String(KnowledgeAnswerStatus.NoAnswer), label: t("knowledge.answerNoAnswer") },
    { value: String(KnowledgeAnswerStatus.Fallback), label: t("knowledge.answerFallback") },
    { value: String(KnowledgeAnswerStatus.Blocked), label: t("knowledge.answerBlocked") },
  ]
}

function getProviderOptions(t: TFunction) {
  return [
    { value: "all", label: t("knowledge.allChunkProviders") },
    { value: "fixed", label: t("knowledge.chunkFixed") },
    { value: "structured", label: t("knowledge.chunkStructured") },
    { value: "faq", label: t("knowledge.chunkFAQ") },
    { value: "semantic", label: t("knowledge.chunkSemantic") },
  ]
}

function getRerankOptions(t: TFunction) {
  return [
    { value: "all", label: t("knowledge.allRerank") },
    { value: "1", label: t("knowledge.rerankEnabled") },
    { value: "0", label: t("knowledge.rerankDisabled") },
  ]
}

function channelLabel(value: string, fallback: string, t: TFunction) {
  return getKnowledgeRetrieveChannelLabel(value, fallback, t)
}

function sceneLabel(value: string, fallback: string, t: TFunction) {
  return getKnowledgeRetrieveSceneLabel(value, fallback, t)
}

function answerStatusLabel(value: number, fallback: string, t: TFunction) {
  return getKnowledgeAnswerStatusLabel(value, fallback, t)
}

function providerLabel(value: string, t: TFunction) {
  return getKnowledgeChunkProviderLabel(value, t)
}

function getAnswerStatusVariant(status: number): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case 1:
      return "default"
    case 2:
      return "secondary"
    case 3:
      return "outline"
    case 4:
      return "destructive"
    default:
      return "outline"
  }
}

export function RetrieveLogList({
  knowledgeBaseId,
}: RetrieveLogListProps) {
  const t = useI18n()
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null)
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState<number | null>(null)
  const channelOptions = useMemo(() => getChannelOptions(t), [t])
  const sceneOptions = useMemo(() => getSceneOptions(t), [t])
  const answerStatusOptions = useMemo(() => getAnswerStatusOptions(t), [t])
  const providerOptions = useMemo(() => getProviderOptions(t), [t])
  const rerankOptions = useMemo(() => getRerankOptions(t), [t])

  function handleOpenDetail(logId: number) {
    setSelectedLogId(logId)
    setSelectedKnowledgeBaseId(knowledgeBaseId)
    setDetailOpen(true)
  }

  if (!knowledgeBaseId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t("knowledge.selectBaseForLogs")}
      </div>
    )
  }

  return (
    <>
      <div className="flex h-full flex-col gap-4 px-6 py-4">
        <DashboardListPage<KnowledgeRetrieveLog>
          layout="fragment"
          filters={[
            {
              name: "question",
              label: t("knowledge.filterQuestion"),
              placeholder: t("knowledge.filterQuestion"),
              defaultValue: "",
              trim: true,
              className: "min-w-0 xl:min-w-[280px]",
              inputClassName: "pl-9",
              icon: <SearchIcon className="size-4" />,
            },
            {
              name: "channel",
              label: t("knowledge.selectChannel"),
              type: "select",
              defaultValue: "all",
              allValue: "all",
              options: channelOptions,
              placeholder: t("knowledge.selectChannel"),
            },
            {
              name: "scene",
              label: t("knowledge.selectScene"),
              type: "select",
              defaultValue: "all",
              allValue: "all",
              options: sceneOptions,
              placeholder: t("knowledge.selectScene"),
            },
            {
              name: "answerStatus",
              label: t("knowledge.answerStatus"),
              type: "select",
              defaultValue: "all",
              allValue: "all",
              valueType: "number",
              options: answerStatusOptions,
              placeholder: t("knowledge.answerStatus"),
            },
            {
              name: "chunkProvider",
              label: t("knowledge.chunkStrategy"),
              type: "select",
              defaultValue: "all",
              allValue: "all",
              options: providerOptions,
              placeholder: t("knowledge.chunkStrategy"),
            },
            {
              name: "rerankEnabled",
              label: "Rerank",
              type: "select",
              defaultValue: "all",
              allValue: "all",
              valueType: "number",
              options: rerankOptions,
              placeholder: "Rerank",
            },
          ]}
          fetchList={(query) => fetchKnowledgeRetrieveLogs({ knowledgeBaseId, ...query })}
          reloadKey={knowledgeBaseId}
          getItemId={(item) => item.id}
          getRowClassName={() => "cursor-pointer"}
          onRowClick={(item) => handleOpenDetail(item.id)}
          columns={[
            {
              key: "time",
              label: t("knowledge.time"),
              className: "w-42 text-xs text-muted-foreground",
              render: (item) => formatDateTime(item.createdAt),
            },
            {
              key: "question",
              label: t("knowledge.question"),
              render: (item) => (
                        <div className="space-y-1">
                          <div className="line-clamp-2 font-medium">{item.question || "-"}</div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{channelLabel(item.channel, item.channelName, t)}</span>
                            <span>{sceneLabel(item.scene, item.sceneName, t)}</span>
                            {item.knowledgeBaseName ? <span>{item.knowledgeBaseName}</span> : null}
                          </div>
                        </div>
              ),
            },
            {
              key: "answerStatus",
              label: t("knowledge.answerStatus"),
              className: "w-28",
              render: (item) => (
                        <Badge variant={getAnswerStatusVariant(item.answerStatus)}>
                          {answerStatusLabel(item.answerStatus, item.answerStatusName, t)}
                        </Badge>
              ),
            },
            {
              key: "hitCount",
              label: t("knowledge.hitCount"),
              className: "w-24 text-right",
              render: (item) => item.hitCount,
            },
            {
              key: "topScore",
              label: "TopScore",
              className: "w-24 text-right font-mono text-xs",
              render: (item) => item.topScore.toFixed(4),
            },
            {
              key: "provider",
              label: "Provider",
              className: "w-28",
              render: (item) =>
                item.chunkProvider ? providerLabel(item.chunkProvider, t) : "-",
            },
            {
              key: "rerank",
              label: "Rerank",
              className: "w-24",
              render: (item) =>
                item.rerankEnabled
                  ? `${t("knowledge.yes")} (${item.rerankLimit})`
                  : t("knowledge.no"),
            },
            {
              key: "citations",
              label: t("knowledge.citations"),
              className: "w-24 text-right",
              render: (item) => item.citationCount,
            },
            {
              key: "duration",
              label: t("knowledge.duration"),
              className: "w-28 text-right",
              render: (item) => `${item.latencyMs} ms`,
            },
          ]}
          labels={{
            query: t("knowledge.filter"),
            loading: t("knowledge.loadingRetrieveLogs"),
            empty: t("knowledge.emptyRetrieveLogs"),
            loadFailed: t("knowledge.loadRetrieveLogsFailed"),
          }}
        />
      </div>

      <RetrieveLogDetailDrawer
        open={detailOpen && selectedKnowledgeBaseId === knowledgeBaseId}
        retrieveLogId={selectedLogId}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) {
            setSelectedLogId(null)
            setSelectedKnowledgeBaseId(null)
          }
        }}
      />
    </>
  )
}
