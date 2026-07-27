"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useMemo, useState } from "react"
import { type Resolver, useForm } from "react-hook-form"
import { z } from "zod/v4"
import { LoaderCircleIcon, PlayIcon } from "lucide-react"
import { toast } from "sonner"

import { ProjectDialog } from "@/components/project-dialog"
import { OptionCombobox } from "@/components/option-combobox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  debugResumeSkillDefinition,
  debugRunSkillDefinition,
  fetchAIAgentsAll,
  type AIAgent,
  type SkillDebugResumePayload,
  type SkillDebugRunPayload,
  type SkillDebugRunResult,
} from "@/lib/api/admin"
import { useI18n } from "@/i18n/provider"

type DebugDialogProps = {
  open: boolean
  skillDefinitionId: number
  skillName: string
  onOpenChange: (open: boolean) => void
}

type TFunction = (key: string, values?: Record<string, string | number>) => string

function createDebugFormSchema(t: TFunction) {
  return z.object({
  aiAgentId: z.string().trim().min(1, t("skillDefinition.agentRequired")),
  conversationId: z.string().trim(),
  userMessage: z.string().trim().min(1, t("skillDefinition.messageRequired")),
  })
}

type DebugForm = {
  aiAgentId: string
  conversationId: string
  userMessage: string
}

const emptyForm: DebugForm = {
  aiAgentId: "",
  conversationId: "",
  userMessage: "",
}

function getQuickResumeActions(t: TFunction) {
  return [
    { label: t("skillDefinition.confirm"), value: t("skillDefinition.confirm") },
    { label: t("skillDefinition.reject"), value: t("skillDefinition.reject") },
  ]
}

function ResultBlock({
  title,
  value,
  emptyText,
}: {
  title: string
  value?: string
  emptyText?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {value ? (
          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-3 text-xs leading-5">
            {value}
          </pre>
        ) : (
          <div className="text-sm text-muted-foreground">{emptyText}</div>
        )}
      </CardContent>
    </Card>
  )
}

export function DebugDialog({
  open,
  skillDefinitionId,
  skillName,
  onOpenChange,
}: DebugDialogProps) {
  if (!open) {
    return null
  }

  return (
    <DebugDialogBody
      key={skillDefinitionId}
      open={open}
      skillDefinitionId={skillDefinitionId}
      skillName={skillName}
      onOpenChange={onOpenChange}
    />
  )
}

function DebugDialogBody({
  open,
  skillDefinitionId,
  skillName,
  onOpenChange,
}: DebugDialogProps) {
  const t = useI18n()
  const formId = `skill-debug-form-${skillDefinitionId}`
  const [running, setRunning] = useState(false)
  const [resuming, setResuming] = useState(false)
  const [aiAgents, setAiAgents] = useState<AIAgent[]>([])
  const [result, setResult] = useState<SkillDebugRunResult | null>(null)
  const [resumeResult, setResumeResult] = useState<SkillDebugRunResult | null>(null)
  const [resumeMessage, setResumeMessage] = useState("")
  const debugFormSchema = useMemo(() => createDebugFormSchema(t), [t])
  const debugFormResolver = useMemo(
    () => zodResolver(debugFormSchema) as Resolver<DebugForm>,
    [debugFormSchema],
  )
  const form = useForm<DebugForm>({
    resolver: debugFormResolver,
    defaultValues: emptyForm,
  })

  const {
    handleSubmit,
    reset,
    register,
    setValue,
    watch,
    formState: { errors },
  } = form

  const selectedAgentId = watch("aiAgentId")
  const quickResumeActions = useMemo(() => getQuickResumeActions(t), [t])

  useEffect(() => {
    async function loadAIAgents() {
      try {
        const data = await fetchAIAgentsAll({ status: 1 })
        setAiAgents(data)
      } catch (error) {
        console.error("Failed to load AI agents:", error)
      }
    }

    void loadAIAgents()
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }
    reset(emptyForm)
    setResult(null)
    setResumeResult(null)
    setResumeMessage("")
  }, [open, reset])

  useEffect(() => {
    if (!open || aiAgents.length === 0 || selectedAgentId) {
      return
    }
    setValue("aiAgentId", String(aiAgents[0].id), { shouldValidate: true })
  }, [aiAgents, open, selectedAgentId, setValue])

  const aiAgentOptions = useMemo(
    () =>
      aiAgents.map((item) => ({
        value: String(item.id),
        label: item.name,
      })),
    [aiAgents],
  )

  const selectedAgent = useMemo(
    () => aiAgents.find((item) => String(item.id) === selectedAgentId) ?? null,
    [aiAgents, selectedAgentId],
  )

  async function onSubmit(values: DebugForm) {
    const payload: SkillDebugRunPayload = {
      aiAgentId: Number(values.aiAgentId),
      skillDefinitionId,
      userMessage: values.userMessage.trim(),
    }
    const conversationId = Number(values.conversationId)
    if (conversationId > 0) {
      payload.conversationId = conversationId
    }

    setRunning(true)
    try {
      const data = await debugRunSkillDefinition(payload)
      setResult(data)
      setResumeResult(null)
      setResumeMessage("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("skillDefinition.debugFailed"))
      setResult(null)
    } finally {
      setRunning(false)
    }
  }

  async function handleResumeDebug(messageText?: string) {
    const nextMessage = (messageText ?? resumeMessage).trim()
    if (!result?.checkPointId || !result.interrupted) {
      return
    }
    if (!nextMessage) {
      toast.error(t("skillDefinition.resumeMessageRequired"))
      return
    }
    const payload: SkillDebugResumePayload = {
      aiAgentId: Number(selectedAgentId || result.aiAgentId),
      checkPointId: result.checkPointId,
      userMessage: nextMessage,
    }
    const conversationId = result.conversationId || Number(watch("conversationId"))
    if (conversationId > 0) {
      payload.conversationId = conversationId
    }

    setResuming(true)
    try {
      const data = await debugResumeSkillDefinition(payload)
      setResumeResult(data)
      setResumeMessage(nextMessage)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("skillDefinition.resumeFailed"))
      setResumeResult(null)
    } finally {
      setResuming(false)
    }
  }

  return (
    <ProjectDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("skillDefinition.debugTitle", { name: skillName })}
      description={t("skillDefinition.debugDescription")}
      size="xl"
      allowFullscreen
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={running}
            onClick={() => onOpenChange(false)}
          >
            {t("skillDefinition.close")}
          </Button>
          <Button type="submit" form={formId} disabled={running}>
            {running ? <LoaderCircleIcon className="animate-spin" /> : <PlayIcon />}
            {running ? t("skillDefinition.debugging") : t("skillDefinition.startDebug")}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
              <CardTitle className="text-sm">{t("skillDefinition.debugInput")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Field data-invalid={!!errors.aiAgentId}>
                  <FieldLabel>AI Agent</FieldLabel>
                  <FieldContent>
                    <OptionCombobox
                      value={selectedAgentId}
                      options={aiAgentOptions}
                      placeholder={t("skillDefinition.selectAgent")}
                      searchPlaceholder={t("skillDefinition.searchAgent")}
                      emptyText={t("skillDefinition.emptyAgent")}
                      onChange={(value) =>
                        setValue("aiAgentId", value, { shouldValidate: true })
                      }
                    />
                    <FieldError errors={[errors.aiAgentId]} />
                  </FieldContent>
                </Field>
                <Field data-invalid={!!errors.conversationId}>
                  <FieldLabel htmlFor="skill-debug-conversation-id">
                    Conversation ID
                  </FieldLabel>
                  <FieldContent>
                    <Input
                      id="skill-debug-conversation-id"
                      type="number"
                      min={0}
                      placeholder={t("skillDefinition.conversationPlaceholder")}
                      aria-invalid={!!errors.conversationId}
                      {...register("conversationId")}
                    />
                    <FieldError errors={[errors.conversationId]} />
                  </FieldContent>
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Field>
                  <FieldLabel>Skill</FieldLabel>
                  <FieldContent>
                    <Input value={skillName} disabled />
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel>{t("skillDefinition.matchedAgent")}</FieldLabel>
                  <FieldContent>
                    <Input
                      value={selectedAgent?.name || t("skillDefinition.noAgentSelected")}
                      disabled
                    />
                  </FieldContent>
                </Field>
              </div>
              <Field data-invalid={!!errors.userMessage}>
                <FieldLabel htmlFor="skill-debug-user-message">{t("skillDefinition.userMessage")}</FieldLabel>
                <FieldContent>
                  <Textarea
                    id="skill-debug-user-message"
                    rows={5}
                    placeholder={t("skillDefinition.userMessagePlaceholder")}
                    aria-invalid={!!errors.userMessage}
                    {...register("userMessage")}
                  />
                  <FieldError errors={[errors.userMessage]} />
                </FieldContent>
              </Field>
            </form>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{t("skillDefinition.debugSummary")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{result?.skillName || skillName}</Badge>
                {result?.interruptType ? (
                  <Badge variant="secondary">{result.interruptType}</Badge>
                ) : null}
                {result?.interrupted ? (
                  <Badge>{t("skillDefinition.interrupted")}</Badge>
                ) : (
                  <Badge variant="outline">{t("skillDefinition.notInterrupted")}</Badge>
                )}
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">{t("skillDefinition.skillName")}</div>
                <div className="mt-1 font-medium">{result?.skillName || skillName}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Reply</div>
                <div className="mt-1 whitespace-pre-wrap break-words">
                  {result?.replyText || t("skillDefinition.none")}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground">Checkpoint</div>
                  <div className="mt-1 break-all">
                    {result?.checkPointId || t("skillDefinition.none")}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground">{t("skillDefinition.errorMessage")}</div>
                  <div className="mt-1 whitespace-pre-wrap break-words">
                    {result?.errorMessage || t("skillDefinition.none")}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{t("skillDefinition.toolView")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">{t("skillDefinition.skillToolWhitelist")}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(result?.toolWhitelist ?? []).length > 0 ? (
                    result?.toolWhitelist.map((toolCode) => (
                      <Badge key={toolCode} variant="outline">
                        {toolCode}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground">{t("skillDefinition.none")}</span>
                  )}
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">{t("skillDefinition.invokedTools")}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(result?.invokedToolCodes ?? []).length > 0 ? (
                    result?.invokedToolCodes.map((toolCode) => (
                      <Badge key={toolCode} variant="secondary">
                        {toolCode}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground">{t("skillDefinition.none")}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <ResultBlock title={t("skillDefinition.traceData")} value={result?.traceData} emptyText={t("skillDefinition.emptyData")} />
        </div>

        {result?.interrupted && result.checkPointId ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{t("skillDefinition.resumeDebug")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <div className="text-xs text-muted-foreground">{t("skillDefinition.currentCheckpoint")}</div>
                <div className="mt-1 break-all">{result.checkPointId}</div>
              </div>
              <Field>
                <FieldLabel htmlFor="skill-debug-resume-message">{t("skillDefinition.resumeMessage")}</FieldLabel>
                <FieldContent>
                  <Textarea
                    id="skill-debug-resume-message"
                    rows={3}
                    placeholder={t("skillDefinition.resumePlaceholder")}
                    value={resumeMessage}
                    onChange={(event) => setResumeMessage(event.target.value)}
                  />
                </FieldContent>
              </Field>
              <div className="flex flex-wrap gap-2">
                {quickResumeActions.map((item) => (
                  <Button
                    key={item.value}
                    type="button"
                    variant="outline"
                    disabled={resuming}
                    onClick={() => void handleResumeDebug(item.value)}
                  >
                    {item.label}
                  </Button>
                ))}
                <Button
                  type="button"
                  disabled={resuming}
                  onClick={() => void handleResumeDebug()}
                >
                  {resuming ? (
                    <LoaderCircleIcon className="animate-spin" />
                  ) : (
                    <PlayIcon />
                  )}
                  {resuming ? t("skillDefinition.resuming") : t("skillDefinition.resumeDebugAction")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {resumeResult ? (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{t("skillDefinition.resumeResult")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{resumeResult.skillName || skillName}</Badge>
                  {resumeResult.interruptType ? (
                    <Badge variant="secondary">{resumeResult.interruptType}</Badge>
                  ) : null}
                  {resumeResult.interrupted ? (
                    <Badge>{t("skillDefinition.stillWaiting")}</Badge>
                  ) : (
                    <Badge variant="outline">{t("skillDefinition.resumeCompleted")}</Badge>
                  )}
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground">{t("skillDefinition.resumeMessage")}</div>
                  <div className="mt-1 whitespace-pre-wrap break-words">
                    {resumeMessage || t("skillDefinition.none")}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground">{t("skillDefinition.resumeReply")}</div>
                  <div className="mt-1 whitespace-pre-wrap break-words">
                    {resumeResult.replyText || t("skillDefinition.none")}
                  </div>
                </div>
              </CardContent>
            </Card>
            <ResultBlock title={t("skillDefinition.resumeTraceData")} value={resumeResult.traceData} emptyText={t("skillDefinition.emptyData")} />
          </div>
        ) : null}
      </div>
    </ProjectDialog>
  )
}
