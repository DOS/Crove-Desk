"use client";

import { Loader2Icon, PlugZapIcon, WrenchIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  DashboardPage,
  DashboardTableShell,
  DashboardToolbar,
} from "@/components/dashboard-page";
import { JsonCodeEditor } from "@/components/json-code-editor";
import { JsonViewer } from "@/components/json-viewer";
import { OptionCombobox } from "@/components/option-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import {
  callMCPTool,
  listMCPServers,
  listMCPTools,
  testMCPConnection,
  type MCPConnectionResult,
  type MCPServerInfo,
  type MCPToolCallResult,
  type MCPToolInfo,
} from "@/lib/api/admin";
import { useI18n } from "@/i18n/provider";

const defaultServerCode = "";

export default function MCPDashboardPage() {
  const t = useI18n();
  const [serverCode, setServerCode] = useState(defaultServerCode);
  const [servers, setServers] = useState<MCPServerInfo[]>([]);
  const [connection, setConnection] = useState<MCPConnectionResult | null>(
    null,
  );
  const [tools, setTools] = useState<MCPToolInfo[]>([]);
  const [loadingServers, setLoadingServers] = useState(true);
  const [testing, setTesting] = useState(false);
  const [loadingTools, setLoadingTools] = useState(false);
  const [callingTool, setCallingTool] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<MCPToolInfo | null>(null);
  const [argumentsText, setArgumentsText] = useState("{}");
  const [toolResult, setToolResult] = useState<MCPToolCallResult | null>(null);
  const [argumentsError, setArgumentsError] = useState<string | null>(null);

  const serverOptions = useMemo(
    () =>
      servers.map((server) => ({
        value: server.code,
        label: server.enabled
          ? `${server.code} (${server.endpoint})`
          : `${server.code} (${t("mcp.disabled")})`,
      })),
    [servers, t],
  );

  useEffect(() => {
    async function loadServers() {
      setLoadingServers(true);
      try {
        const result = await listMCPServers();
        setServers(result);
        const firstServer = result[0];
        if (firstServer) {
          setServerCode((current) => current || firstServer.code);
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("mcp.loadServersFailed"),
        );
      } finally {
        setLoadingServers(false);
      }
    }

    void loadServers();
  }, [t]);

  async function handleTestConnection() {
    setTesting(true);
    try {
      const result = await testMCPConnection(serverCode.trim());
      setConnection(result);
      toast.success(t("mcp.connectSuccess"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("mcp.connectFailed"));
    } finally {
      setTesting(false);
    }
  }

  async function handleListTools() {
    setLoadingTools(true);
    try {
      const result = await listMCPTools(serverCode.trim());
      setTools(result);
      toast.success(t("mcp.toolsLoaded", { count: result.length }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("mcp.loadToolsFailed"));
    } finally {
      setLoadingTools(false);
    }
  }

  async function handleCallTool() {
    if (!activeTool) {
      toast.error(t("mcp.selectToolFirst"));
      return;
    }
    if (argumentsError) {
      toast.error(t("mcp.argumentsInvalid"));
      return;
    }

    let parsedArguments: Record<string, unknown> = {};
    try {
      parsedArguments = argumentsText.trim()
        ? (JSON.parse(argumentsText) as Record<string, unknown>)
        : {};
    } catch {
      toast.error(t("mcp.argumentsMustBeJson"));
      return;
    }

    setCallingTool(true);
    try {
      const result = await callMCPTool({
        serverCode: serverCode.trim(),
        toolName: activeTool.name,
        arguments: parsedArguments,
      });
      setToolResult(result);
      toast.success(result.isError ? t("mcp.toolReturnedError") : t("mcp.toolCallSuccess"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("mcp.toolCallFailed"));
    } finally {
      setCallingTool(false);
    }
  }

  function openToolDrawer(tool: MCPToolInfo) {
    setActiveTool(tool);
    setToolResult(null);
    if (tool.name === "lorem") {
      setArgumentsText('{\n  "wordCount": 8\n}');
    } else if (tool.name === "ping") {
      setArgumentsText('{\n  "message": "hello from dashboard"\n}');
    } else {
      setArgumentsText("{}");
    }
    setDrawerOpen(true);
  }

  return (
    <>
      <DashboardPage className="gap-6">
        <DashboardToolbar
          actions={
            <>
              <Button
                onClick={() => void handleTestConnection()}
                disabled={testing || loadingServers || !serverCode}
              >
                {testing ? (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                ) : (
                  <PlugZapIcon className="mr-2 size-4" />
                )}
                {t("mcp.testConnection")}
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleListTools()}
                disabled={loadingTools || loadingServers || !serverCode}
              >
                {loadingTools ? (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                ) : (
                  <WrenchIcon className="mr-2 size-4" />
                )}
                {t("mcp.listTools")}
              </Button>
            </>
          }
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="shrink-0 text-sm font-medium">{t("mcp.serverConfig")}</span>
            <div className="min-w-[280px] max-w-[520px] flex-1">
              <OptionCombobox
                value={serverCode}
                options={serverOptions}
                placeholder={t("mcp.selectServer")}
                searchPlaceholder={t("mcp.searchServer")}
                emptyText={t("mcp.emptyServer")}
                disabled={loadingServers}
                onChange={(value) => {
                  setServerCode(value);
                  setConnection(null);
                  setTools([]);
                  setToolResult(null);
                  setActiveTool(null);
                }}
              />
            </div>
          </div>
          {connection ? (
            <div className="w-full rounded-lg border bg-muted/30 p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{t("mcp.connected")}</Badge>
                <span className="font-medium">
                  {connection.serverName || "-"}
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-muted-foreground grid-cols-1 md:grid-cols-5">
                <div>serverCode: {connection.serverCode}</div>
                <div>protocol: {connection.protocol || "-"}</div>
                <div className="break-all md:col-span-2">
                  endpoint: {connection.endpoint}
                </div>
                <div>version: {connection.version || "-"}</div>
              </div>
            </div>
          ) : null}
        </DashboardToolbar>

        {tools.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            {t("mcp.emptyToolsHint")}
          </div>
        ) : (
          <DashboardTableShell>
            <div>
              <div className="grid grid-cols-[minmax(0,220px)_minmax(0,1fr)_88px] gap-4 border-b bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground">
                <div>{t("mcp.toolName")}</div>
                <div>{t("mcp.description")}</div>
                <div className="text-right">{t("mcp.actions")}</div>
              </div>
              {tools.map((tool) => (
                <div
                  key={tool.name}
                  className="grid grid-cols-[minmax(0,220px)_minmax(0,1fr)_88px] gap-4 border-b px-4 py-4 text-sm last:border-b-0"
                >
                  <div className="font-medium">{tool.name}</div>
                  <div className="text-muted-foreground">
                    {tool.description || "-"}
                  </div>
                  <div className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openToolDrawer(tool)}
                    >
                      {t("mcp.view")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </DashboardTableShell>
        )}
      </DashboardPage>

      <Drawer open={drawerOpen} direction="right" onOpenChange={setDrawerOpen}>
        <DrawerContent className="min-w-3xl">
          <DrawerHeader>
            <DrawerTitle>{activeTool?.name || t("mcp.toolDetail")}</DrawerTitle>
            <DrawerDescription>
              {t("mcp.detailDescription")}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
            {activeTool ? (
              <>
                <div className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{activeTool.name}</Badge>
                    {activeTool.title ? (
                      <span className="text-sm font-medium">
                        {activeTool.title}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {activeTool.description || t("mcp.noDescription")}
                  </p>
                </div>

                <div className="space-y-4 rounded-lg border p-4">
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      Input Schema
                    </p>
                    <JsonViewer value={activeTool.inputSchema} />
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      Output Schema
                    </p>
                    <JsonViewer value={activeTool.outputSchema} />
                  </div>
                </div>

                <div className="space-y-4 rounded-lg border p-4">
                  <div className="grid gap-2">
                    <Label htmlFor="tool-arguments">Arguments JSON</Label>
                    <JsonCodeEditor
                      value={argumentsText}
                      onChange={setArgumentsText}
                      onValidationChange={setArgumentsError}
                    />
                  </div>
                  <Button
                    onClick={() => void handleCallTool()}
                    disabled={
                      callingTool ||
                      loadingServers ||
                      !serverCode ||
                      !!argumentsError
                    }
                  >
                    {callingTool ? (
                      <Loader2Icon className="mr-2 size-4 animate-spin" />
                    ) : (
                      <WrenchIcon className="mr-2 size-4" />
                    )}
                    {t("mcp.testTool")}
                  </Button>
                  {toolResult ? (
                    <div className="space-y-4 rounded-lg border p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            toolResult.isError ? "destructive" : "default"
                          }
                        >
                          {toolResult.isError ? t("mcp.returnedError") : t("mcp.callSuccess")}
                        </Badge>
                        <span className="text-sm font-medium">
                          {toolResult.toolName}
                        </span>
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-medium text-muted-foreground">
                          Content
                        </p>
                        <JsonViewer value={toolResult.content} />
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-medium text-muted-foreground">
                          Structured Content
                        </p>
                        <JsonViewer value={toolResult.structuredContent} />
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
          <DrawerFooter>
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>
              {t("mcp.close")}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
