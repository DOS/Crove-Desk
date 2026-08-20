"use client"

import { DownloadIcon, FileUpIcon, InfoIcon } from "lucide-react"
import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { OptionCombobox } from "@/components/option-combobox"
import { ProjectDialog } from "@/components/project-dialog"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  downloadKnowledgeFAQImportTemplate,
  importKnowledgeFAQs,
  type KnowledgeFAQImportMode,
  type KnowledgeFAQImportResult,
} from "@/lib/api/admin"
import { useI18n } from "@/i18n/provider"

type FAQImportDialogProps = {
  open: boolean
  knowledgeBaseId: number | null
  importing: boolean
  onOpenChange: (open: boolean) => void
  onImportingChange: (importing: boolean) => void
  onImported: () => Promise<void>
}

export function FAQImportDialog({
  open,
  knowledgeBaseId,
  importing,
  onOpenChange,
  onImportingChange,
  onImported,
}: FAQImportDialogProps) {
  const t = useI18n()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<KnowledgeFAQImportMode>("append")
  const [result, setResult] = useState<KnowledgeFAQImportResult | null>(null)

  const modeOptions = useMemo(
    () => [
      { value: "append", label: t("knowledge.importModeAppend") },
      { value: "overwrite", label: t("knowledge.importModeOverwrite") },
    ],
    [t],
  )

  function resetState() {
    setFile(null)
    setMode("append")
    setResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null
    setResult(null)
    if (!nextFile) {
      setFile(null)
      return
    }
    if (!nextFile.name.toLowerCase().endsWith(".xlsx")) {
      setFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      toast.error(t("knowledge.importXlsxOnly"))
      return
    }
    setFile(nextFile)
  }

  async function handleDownloadTemplate() {
    try {
      await downloadKnowledgeFAQImportTemplate()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("knowledge.downloadTemplateFailed"))
    }
  }

  async function handleImport() {
    if (!knowledgeBaseId || !file || importing) {
      return
    }

    onImportingChange(true)
    setResult(null)
    try {
      const data = await importKnowledgeFAQs({
        knowledgeBaseId,
        mode,
        file,
      })
      setResult(data)
      await onImported()
      toast.success(
        t("knowledge.importFAQResultToast", {
          created: data.created,
          updated: data.updated,
          skipped: data.skipped,
          failed: data.failed,
        }),
      )
      if (data.failed === 0) {
        resetState()
        onOpenChange(false)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("knowledge.importFailed"))
    } finally {
      onImportingChange(false)
    }
  }

  return (
    <ProjectDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !importing) {
          resetState()
        }
        onOpenChange(nextOpen)
      }}
      title={t("knowledge.importFAQTitle")}
      description={t("knowledge.importFAQDescription")}
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => void handleDownloadTemplate()}>
            <DownloadIcon className="size-4" />
            {t("knowledge.downloadTemplate")}
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            {t("knowledge.cancel")}
          </Button>
          <Button type="button" onClick={() => void handleImport()} disabled={importing || !file}>
            {importing ? t("knowledge.importing") : t("knowledge.startImport")}
          </Button>
        </>
      }
    >
      <FieldGroup>
        <Field>
          <FieldLabel>{t("knowledge.importMode")}</FieldLabel>
          <FieldContent>
            <OptionCombobox
              value={mode}
              options={modeOptions}
              placeholder={t("knowledge.selectImportMode")}
              searchPlaceholder={t("knowledge.searchImportMode")}
              emptyText={t("knowledge.emptyImportMode")}
              disabled={importing}
              onChange={(value) => setMode(value as KnowledgeFAQImportMode)}
            />
            <FieldDescription>
              {mode === "overwrite"
                ? t("knowledge.importModeOverwriteDescription")
                : t("knowledge.importModeAppendDescription")}
            </FieldDescription>
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="faq-import-file">{t("knowledge.importFile")}</FieldLabel>
          <FieldContent>
            <div className="flex items-center gap-2">
              <Input
                id="faq-import-file"
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={importing}
                onChange={handleFileChange}
              />
              <Button
                type="button"
                variant="outline"
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUpIcon className="size-4" />
                {t("knowledge.chooseFile")}
              </Button>
            </div>
            <FieldDescription>{t("knowledge.importFileDescription")}</FieldDescription>
          </FieldContent>
        </Field>

        {file ? (
          <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
            {t("knowledge.currentFile", { name: file.name })}
          </div>
        ) : null}

        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="mb-2 flex items-center gap-2 font-medium">
            <InfoIcon className="size-4" />
            {t("knowledge.importHint")}
          </div>
          <div>{t("knowledge.importXlsxHint")}</div>
        </div>

        {result ? (
          <div className="rounded-md border">
            <div className="border-b px-4 py-3 text-sm font-medium">
              {t("knowledge.importResult")}
            </div>
            <div className="grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-5">
              <ImportMetric label={t("knowledge.importTotal")} value={result.total} />
              <ImportMetric label={t("knowledge.importCreated")} value={result.created} />
              <ImportMetric label={t("knowledge.importUpdated")} value={result.updated} />
              <ImportMetric label={t("knowledge.importSkipped")} value={result.skipped} />
              <ImportMetric label={t("knowledge.importFailedCount")} value={result.failed} />
            </div>
            {result.errors.length > 0 ? (
              <ScrollArea className="max-h-64 border-t">
                <ul className="divide-y text-sm">
                  {result.errors.map((item, index) => (
                    <li key={`${item.row}-${index}`} className="px-4 py-2">
                      {t("knowledge.importRowFailed", {
                        row: item.row,
                        message: item.message,
                      })}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            ) : null}
          </div>
        ) : null}
      </FieldGroup>
    </ProjectDialog>
  )
}

function ImportMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/30 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  )
}
