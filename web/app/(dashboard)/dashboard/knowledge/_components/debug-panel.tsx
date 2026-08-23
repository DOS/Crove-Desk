"use client";

import { useState } from "react";
import { BotIcon, SearchIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";

import {
  debugKnowledgeAnswer,
  debugKnowledgeSearch,
  type KnowledgeAnswerResponse,
  type KnowledgeSearchResponse,
} from "@/lib/api/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n/provider";
import { getKnowledgeAnswerStatusLabel } from "@/lib/knowledge-i18n";

type DebugPanelProps = {
  knowledgeBaseId: number | null;
};

export function DebugPanel({ knowledgeBaseId }: DebugPanelProps) {
  const t = useI18n();
  const [question, setQuestion] = useState("");
  const [topK, setTopK] = useState("5");
  const [scoreThreshold, setScoreThreshold] = useState("0.2");
  const [rerankLimit, setRerankLimit] = useState("5");
  const [searching, setSearching] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [searchResult, setSearchResult] = useState<KnowledgeSearchResponse | null>(null);
  const [answerResult, setAnswerResult] = useState<KnowledgeAnswerResponse | null>(null);

  async function handleSearch() {
    if (!knowledgeBaseId) {
      toast.error(t("knowledge.selectKnowledgeBaseFirst"));
      return;
    }
    if (!question.trim()) {
      toast.error(t("knowledge.debugQuestionRequired"));
      return;
    }

    setSearching(true);
    try {
      const data = await debugKnowledgeSearch({
        knowledgeBaseIds: [knowledgeBaseId],
        question: question.trim(),
        topK: Number(topK) || undefined,
        scoreThreshold: Number(scoreThreshold) || undefined,
        rerankLimit: Number(rerankLimit) || undefined,
      });
      setSearchResult(data);
      toast.success(t("knowledge.searchCompleted", { count: data.hitCount }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("knowledge.searchFailed"));
    } finally {
      setSearching(false);
    }
  }

  async function handleAnswer() {
    if (!knowledgeBaseId) {
      toast.error(t("knowledge.selectKnowledgeBaseFirst"));
      return;
    }
    if (!question.trim()) {
      toast.error(t("knowledge.debugQuestionRequired"));
      return;
    }

    setAnswering(true);
    try {
      const data = await debugKnowledgeAnswer({
        knowledgeBaseIds: [knowledgeBaseId],
        question: question.trim(),
        topK: Number(topK) || undefined,
        scoreThreshold: Number(scoreThreshold) || undefined,
        rerankLimit: Number(rerankLimit) || undefined,
      });
      setAnswerResult(data);
      toast.success(t("knowledge.answerCompleted", {
        status: getKnowledgeAnswerStatusLabel(data.answerStatus, data.answerStatusName, t),
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("knowledge.answerFailed"));
    } finally {
      setAnswering(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className="space-y-3">
        <Textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={t("knowledge.debugQuestionPlaceholder")}
          rows={5}
          className="text-sm"
        />
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="topk" className="text-xs">TopK</Label>
            <Input id="topk" value={topK} onChange={(event) => setTopK(event.target.value)} placeholder={t("knowledge.topKPlaceholder")} className="h-8" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="threshold" className="text-xs">{t("knowledge.scoreThreshold")}</Label>
            <Input id="threshold" value={scoreThreshold} onChange={(event) => setScoreThreshold(event.target.value)} placeholder={t("knowledge.scoreThresholdPlaceholder")} className="h-8" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rerank" className="text-xs">{t("knowledge.rerankLimitLabel")}</Label>
            <Input id="rerank" value={rerankLimit} onChange={(event) => setRerankLimit(event.target.value)} placeholder={t("knowledge.rerankLimitPlaceholder")} className="h-8" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" variant="outline" onClick={() => void handleSearch()} disabled={searching}>
            <SearchIcon className="mr-2 size-4" />
            {searching ? t("knowledge.searching") : t("knowledge.debugSearch")}
          </Button>
          <Button className="flex-1" onClick={() => void handleAnswer()} disabled={answering}>
            <SparklesIcon className="mr-2 size-4" />
            {answering ? t("knowledge.generating") : t("knowledge.debugAnswer")}
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3">
          {answerResult ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <BotIcon className="size-4" />
                  {t("knowledge.answerResult")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {getKnowledgeAnswerStatusLabel(answerResult.answerStatus, answerResult.answerStatusName, t)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {answerResult.latencyMs}ms · {answerResult.modelName || "fallback"}
                  </span>
                </div>
                <div className="rounded-md border bg-background p-3 whitespace-pre-wrap">
                  {answerResult.answer}
                </div>
                {answerResult.citations.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">{t("knowledge.citationSources")}</div>
                    {answerResult.citations.map((citation) => (
                      <div
                        key={`${citation.documentId}-${citation.chunkNo}-${citation.sectionPath}`}
                        className="rounded-md border bg-muted/30 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate text-xs font-medium">
                            {getSearchResultLabel(citation)}
                          </div>
                          <Badge variant="outline">{citation.score.toFixed(4)}</Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {citation.sectionPath || citation.title || `Chunk #${citation.chunkNo}`}
                        </div>
                        <div className="mt-2 text-xs leading-5 text-muted-foreground whitespace-pre-wrap">
                          {citation.snippet}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {searchResult ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t("knowledge.searchHits")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  {t("knowledge.hitsSummary", { count: searchResult.hitCount, latency: searchResult.latencyMs })}
                </div>
                {searchResult.results.map((item) => (
                  <div key={`${item.chunkId}-${item.documentId}`} className="rounded-md border bg-background p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-medium">
                        {getSearchResultLabel(item)}
                      </div>
                      <Badge variant="outline">{item.score.toFixed(4)}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.sectionPath || item.title || `Chunk #${item.chunkNo}`}
                    </div>
                    <div className="mt-2 text-xs leading-5 text-muted-foreground whitespace-pre-wrap">
                      {item.content}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

function getSearchResultLabel(item: {
  faqQuestion?: string
  faqId?: number
  documentTitle?: string
  documentId?: number
}) {
  if (item.faqQuestion) {
    return item.faqQuestion
  }
  if (item.documentTitle) {
    return item.documentTitle
  }
  if (item.faqId && item.faqId > 0) {
    return `FAQ ${item.faqId}`
  }
  return `Document ${item.documentId ?? 0}`
}
