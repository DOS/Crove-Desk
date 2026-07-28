"use client"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useI18n } from "@/i18n/provider"
import { exportKnowledgeFAQs, fetchKnowledgeBase, type KnowledgeBase } from "@/lib/api/admin"
import {
  ArrowLeftIcon,
  BugIcon,
  DownloadIcon,
  FileTextIcon,
  LayoutGridIcon,
  LayoutListIcon,
  PlusIcon,
  RefreshCwIcon,
  UploadIcon,
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { DebugPanel } from "../_components/debug-panel"
import { DocumentList, type DocumentListActionState } from "../_components/document-list"
import { FAQList, type FAQListActionState } from "../_components/faq-list"
import { RetrieveLogList } from "../_components/retrieve-log-list"

export default function KnowledgeBaseDetailPage() {
  const t = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const knowledgeBaseId = Number(searchParams.get("id"))
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("documents")
  const [debugPanelOpen, setDebugPanelOpen] = useState(false)
  const [documentActionState, setDocumentActionState] = useState<DocumentListActionState | null>(null)
  const [faqActionState, setFAQActionState] = useState<FAQListActionState | null>(null)
  const [exportingFAQ, setExportingFAQ] = useState(false)

  const loadKnowledgeBase = useCallback(async () => {
    if (!Number.isInteger(knowledgeBaseId) || knowledgeBaseId <= 0) {
      setKnowledgeBase(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setKnowledgeBase(await fetchKnowledgeBase(knowledgeBaseId))
    } catch (error) {
      setKnowledgeBase(null)
      toast.error(error instanceof Error ? error.message : t("knowledge.loadBaseFailed"))
    } finally {
      setLoading(false)
    }
  }, [knowledgeBaseId, t])

  useEffect(() => {
    void loadKnowledgeBase()
  }, [loadKnowledgeBase])

  async function handleExportFAQ() {
    if (!knowledgeBase || exportingFAQ) {
      return
    }
    setExportingFAQ(true)
    try {
      await exportKnowledgeFAQs(knowledgeBase.id)
      toast.success(t("knowledge.exportFAQSuccess"))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("knowledge.exportFAQFailed"))
    } finally {
      setExportingFAQ(false)
    }
  }

  if (!loading && !knowledgeBase) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <FileTextIcon className="size-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t("knowledge.baseNotFound")}</p>
        <Button variant="outline" onClick={() => router.push("/dashboard/knowledge")}>
          <ArrowLeftIcon className="size-4" />
          {t("knowledge.backToList")}
        </Button>
      </div>
    )
  }

  const isFAQKnowledgeBase = knowledgeBase?.knowledgeType === "faq"

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="min-h-0 flex-1 gap-0">
        <div className="flex shrink-0 items-center gap-3 border-b bg-background px-4 py-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => router.push("/dashboard/knowledge")}
            aria-label={t("knowledge.backToList")}
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h1 className="shrink-0 truncate text-sm font-semibold">{knowledgeBase?.name ?? t("knowledge.title")}</h1>
            {knowledgeBase?.description ? (
              <>
                <span className="h-3 w-px shrink-0 bg-border" aria-hidden="true" />
                <p className="min-w-0 truncate text-xs text-muted-foreground">{knowledgeBase.description}</p>
              </>
            ) : null}
          </div>
          {activeTab === "documents" && !isFAQKnowledgeBase && documentActionState ? (
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon" className="size-7" onClick={documentActionState.onRefresh} disabled={documentActionState.loading} aria-label={t("knowledge.refreshDocuments")}>
                <RefreshCwIcon className={documentActionState.loading ? "size-4 animate-spin" : "size-4"} />
              </Button>
              <Button variant={documentActionState.viewMode === "list" ? "secondary" : "ghost"} size="icon" className="size-7" onClick={() => documentActionState.onChangeViewMode("list")} aria-label={t("knowledge.listLayout")}><LayoutListIcon className="size-4" /></Button>
              <Button variant={documentActionState.viewMode === "grid" ? "secondary" : "ghost"} size="icon" className="size-7" onClick={() => documentActionState.onChangeViewMode("grid")} aria-label={t("knowledge.gridLayout")}><LayoutGridIcon className="size-4" /></Button>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setDebugPanelOpen(true)} aria-label={t("knowledge.openDebugPanel")}><BugIcon className="size-4" /></Button>
              <Button size="sm" className="h-7 gap-1.5 px-2.5 text-xs" onClick={documentActionState.onCreate}>
                <PlusIcon className="size-3.5" />
                {t("knowledge.newDocument")}
              </Button>
            </div>
          ) : null}
          {activeTab === "documents" && isFAQKnowledgeBase && faqActionState ? (
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon" className="size-7" onClick={faqActionState.onRefresh} disabled={faqActionState.loading} aria-label={t("knowledge.refreshFAQ")}><RefreshCwIcon className={faqActionState.loading ? "size-4 animate-spin" : "size-4"} /></Button>
              <Button variant="ghost" size="icon" className="size-7" onClick={faqActionState.onImport} disabled={faqActionState.importing} aria-label={t("knowledge.importFAQ")}><UploadIcon className="size-4" /></Button>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => void handleExportFAQ()} disabled={exportingFAQ} aria-label={t("knowledge.exportFAQ")}><DownloadIcon className={exportingFAQ ? "size-4 animate-pulse" : "size-4"} /></Button>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setDebugPanelOpen(true)} aria-label={t("knowledge.openDebugPanel")}><BugIcon className="size-4" /></Button>
              <Button size="sm" className="h-7 gap-1.5 px-2.5 text-xs" onClick={faqActionState.onCreate}>
                <PlusIcon className="size-3.5" />
                {t("knowledge.newFAQ")}
              </Button>
            </div>
          ) : null}
          <TabsList className="ml-auto h-8 shrink-0 border bg-muted/40 p-0.5">
            <TabsTrigger value="documents" className="h-7 px-3 text-xs text-muted-foreground data-[state=active]:bg-background data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              {isFAQKnowledgeBase ? t("knowledge.faq") : t("knowledge.document")}
            </TabsTrigger>
            <TabsTrigger value="retrieveLogs" className="h-7 px-3 text-xs text-muted-foreground data-[state=active]:bg-background data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              {t("knowledge.retrieveLogs")}
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="documents" className="min-h-0 flex-1">
          {isFAQKnowledgeBase ? <FAQList knowledgeBaseId={knowledgeBase?.id ?? null} onActionStateChange={setFAQActionState} /> : <DocumentList knowledgeBaseId={knowledgeBase?.id ?? null} onActionStateChange={setDocumentActionState} />}
        </TabsContent>
        <TabsContent value="retrieveLogs" className="min-h-0 flex-1">
          <RetrieveLogList knowledgeBaseId={knowledgeBase?.id ?? null} />
        </TabsContent>
      </Tabs>
      <Sheet open={debugPanelOpen} onOpenChange={setDebugPanelOpen}>
        <SheetContent side="right" className="min-w-170">
          <SheetHeader><SheetTitle>{t("knowledge.ragDebug")}</SheetTitle></SheetHeader>
          <DebugPanel knowledgeBaseId={knowledgeBase?.id ?? null} />
        </SheetContent>
      </Sheet>
    </div>
  )
}
