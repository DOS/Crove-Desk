"use client";

import { useEffect, useState } from "react";

import { ProjectDialog } from "@/components/project-dialog";
import { SafeRichHTML } from "@/components/safe-rich-html";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  fetchKnowledgeDocument,
  fetchKnowledgeFAQ,
  type KnowledgeDocument,
  type KnowledgeFAQ,
} from "@/lib/api/admin";
import { markdownToHtml } from "@/components/content-editor/convert";
import { KnowledgeDocumentContentType } from "@/lib/generated/enums";
import { useI18n } from "@/i18n/provider";
import { formatDateTime } from "@/lib/utils";

type KnowledgeContentDetailDialogProps = {
  open: boolean;
  type: "document" | "faq";
  itemId: number | null;
  onOpenChange: (open: boolean) => void;
};

type DetailFieldProps = {
  label: string;
  value: string;
};

function DetailField({ label, value }: DetailFieldProps) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="truncate text-sm">{value || "-"}</div>
    </div>
  );
}

function getDirectoryLabel(item: KnowledgeDocument | KnowledgeFAQ, rootLabel: string) {
  return item.directoryPath || item.directoryName || (item.directoryId === 0 ? rootLabel : "-");
}

function renderDocumentContent(item: KnowledgeDocument) {
  if (item.contentType === KnowledgeDocumentContentType.Markdown) {
    return markdownToHtml(item.content || "");
  }
  return item.content || "";
}

export function KnowledgeContentDetailDialog({
  open,
  type,
  itemId,
  onOpenChange,
}: KnowledgeContentDetailDialogProps) {
  const t = useI18n();
  const [loading, setLoading] = useState(false);
  const [documentDetail, setDocumentDetail] = useState<KnowledgeDocument | null>(null);
  const [faqDetail, setFAQDetail] = useState<KnowledgeFAQ | null>(null);

  useEffect(() => {
    if (!open || !itemId) {
      return;
    }
    const id = itemId;
    let cancelled = false;
    async function loadDetail() {
      setLoading(true);
      try {
        if (type === "document") {
          const data = await fetchKnowledgeDocument(id);
          if (!cancelled) {
            setDocumentDetail(data);
            setFAQDetail(null);
          }
          return;
        }
        const data = await fetchKnowledgeFAQ(id);
        if (!cancelled) {
          setFAQDetail(data);
          setDocumentDetail(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [itemId, open, type]);

  const item = type === "document" ? documentDetail : faqDetail;
  const title =
    type === "document"
      ? documentDetail?.title || t("knowledge.viewDocumentTitle")
      : faqDetail?.question || t("knowledge.viewFAQTitle");

  return (
    <ProjectDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="xl"
      allowFullscreen
      closeOnEsc
      defaultFullscreen
      footer={
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          {t("common.close")}
        </Button>
      }
    >
      {loading || !item ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          {t("knowledge.loading")}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <DetailField
              label={t("knowledge.directory")}
              value={getDirectoryLabel(item, t("knowledge.rootContent"))}
            />
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">{t("knowledge.status")}</div>
              <Badge variant="outline">{item.statusName || item.status}</Badge>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">{t("knowledge.indexStatus")}</div>
              <Badge variant="secondary">{item.indexStatusName || item.indexStatus}</Badge>
            </div>
            <DetailField
              label={t("knowledge.createdAt")}
              value={formatDateTime(item.createdAt)}
            />
            <DetailField
              label={t("knowledge.updatedAt")}
              value={formatDateTime(item.updatedAt)}
            />
            <DetailField
              label={t("knowledge.createUser")}
              value={item.createUserName || "-"}
            />
            <DetailField
              label={t("knowledge.updateUser")}
              value={item.updateUserName || "-"}
            />
            <DetailField
              label={t("knowledge.indexedAtLabel")}
              value={item.indexedAt ? formatDateTime(item.indexedAt) : "-"}
            />
          </div>

          {item.indexError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {item.indexError}
            </div>
          ) : null}

          {type === "document" && documentDetail ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium">{t("knowledge.content")}</div>
                <Badge variant="outline">{documentDetail.contentType || "-"}</Badge>
              </div>
              <div className="rounded-md border bg-background p-4">
                <SafeRichHTML html={renderDocumentContent(documentDetail)} />
              </div>
            </div>
          ) : null}

          {type === "faq" && faqDetail ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="text-sm font-medium">{t("knowledge.standardQuestion")}</div>
                <div className="rounded-md border bg-muted/20 p-3 text-sm">{faqDetail.question}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">{t("knowledge.answer")}</div>
                <pre className="whitespace-pre-wrap rounded-md border bg-muted/20 p-4 text-sm leading-6">
                  {faqDetail.answer || "-"}
                </pre>
              </div>
              {faqDetail.similarQuestions.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium">{t("knowledge.similarQuestions")}</div>
                  <div className="flex flex-wrap gap-2">
                    {faqDetail.similarQuestions.map((question) => (
                      <Badge key={question} variant="outline">
                        {question}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
              {faqDetail.remark ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium">{t("knowledge.remark")}</div>
                  <div className="rounded-md border bg-muted/20 p-3 text-sm">{faqDetail.remark}</div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </ProjectDialog>
  );
}
