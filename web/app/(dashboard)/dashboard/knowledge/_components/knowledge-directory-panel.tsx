"use client";

import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FolderIcon,
  FolderPlusIcon,
  LayersIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { toast } from "sonner";

import { OptionCombobox } from "@/components/option-combobox";
import { ProjectDialog } from "@/components/project-dialog";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  createKnowledgeDirectory,
  deleteKnowledgeDirectory,
  fetchKnowledgeDirectories,
  updateKnowledgeDirectory,
  updateKnowledgeDirectorySort,
  type KnowledgeDirectory,
} from "@/lib/api/admin";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import {
  findDirectoryParentId,
  moveDirectoryToParent,
  moveDirectoryWithinParent,
} from "./knowledge-directory-sort";

type KnowledgeDirectoryPanelProps = {
  knowledgeBaseId: number;
  selectedDirectoryId: number | null;
  onSelectDirectory: (directoryId: number | null) => void;
  onChanged?: () => void;
};

type DirectoryDialogState = {
  open: boolean;
  id: number | null;
  parentId: number;
  name: string;
  remark: string;
};

type DirectoryOption = { value: string; label: string };

const DIRECTORY_PANEL_WIDTH_STORAGE_KEY = "knowledge-directory-panel-width";
const DIRECTORY_PANEL_MIN_WIDTH = 180;
const DIRECTORY_PANEL_MAX_WIDTH = 360;
const DIRECTORY_PANEL_DEFAULT_WIDTH = 224;
const ROOT_DIRECTORY_DROP_ID = "knowledge-directory-root";

function rootDirectoryOptions(items: KnowledgeDirectory[]): DirectoryOption[] {
  return items.map((item) => ({ value: String(item.id), label: item.name }));
}

function collectExpandedIds(items: KnowledgeDirectory[]) {
  const ids = new Set<number>();
  const walk = (nodes: KnowledgeDirectory[]) => {
    for (const node of nodes) {
      ids.add(node.id);
      walk(node.children || []);
    }
  };
  walk(items);
  return ids;
}

export function KnowledgeDirectoryPanel({
  knowledgeBaseId,
  selectedDirectoryId,
  onSelectDirectory,
  onChanged,
}: KnowledgeDirectoryPanelProps) {
  const t = useI18n();
  const directoryNameInputRef = useRef<HTMLInputElement>(null);
  const directoryNameFocusTimerRef = useRef<number | null>(null);
  const [panelWidth, setPanelWidth] = useState(() => {
    if (typeof window === "undefined") {
      return DIRECTORY_PANEL_DEFAULT_WIDTH;
    }
    const saved = Number(localStorage.getItem(DIRECTORY_PANEL_WIDTH_STORAGE_KEY));
    if (!Number.isFinite(saved)) {
      return DIRECTORY_PANEL_DEFAULT_WIDTH;
    }
    return Math.min(DIRECTORY_PANEL_MAX_WIDTH, Math.max(DIRECTORY_PANEL_MIN_WIDTH, saved));
  });
  const [directories, setDirectories] = useState<KnowledgeDirectory[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [contextMenuDirectoryId, setContextMenuDirectoryId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sorting, setSorting] = useState(false);
  const [dialog, setDialog] = useState<DirectoryDialogState>({
    open: false,
    id: null,
    parentId: 0,
    name: "",
    remark: "",
  });
  const parentOptions = useMemo(
    () => [
      { value: "0", label: t("knowledge.rootDirectory") },
      ...rootDirectoryOptions(directories).filter((item) => item.value !== String(dialog.id ?? "")),
    ],
    [directories, dialog.id, t],
  );
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const loadDirectories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchKnowledgeDirectories(knowledgeBaseId);
      setDirectories(data);
      setExpandedIds(collectExpandedIds(data));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("knowledge.loadDirectoriesFailed"));
    } finally {
      setLoading(false);
    }
  }, [knowledgeBaseId, t]);

  useEffect(() => {
    void loadDirectories();
  }, [loadDirectories]);

  useEffect(() => {
    localStorage.setItem(DIRECTORY_PANEL_WIDTH_STORAGE_KEY, String(panelWidth));
  }, [panelWidth]);

  useEffect(() => {
    if (!dialog.open) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      directoryNameFocusTimerRef.current = window.setTimeout(() => {
        const input =
          directoryNameInputRef.current ??
          document.querySelector<HTMLInputElement>("[data-knowledge-directory-name-input='true']");
        input?.focus({ preventScroll: true });
        input?.select();
      }, 80);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (directoryNameFocusTimerRef.current !== null) {
        window.clearTimeout(directoryNameFocusTimerRef.current);
        directoryNameFocusTimerRef.current = null;
      }
    };
  }, [dialog.open]);

  function handleResizePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = panelWidth;

    function handlePointerMove(moveEvent: globalThis.PointerEvent) {
      const nextWidth = startWidth + moveEvent.clientX - startX;
      setPanelWidth(
        Math.min(DIRECTORY_PANEL_MAX_WIDTH, Math.max(DIRECTORY_PANEL_MIN_WIDTH, nextWidth)),
      );
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function toggleDirectory(id: number) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function openCreate(parentId = 0) {
    setDialog({ open: true, id: null, parentId, name: "", remark: "" });
  }

  function openEdit(item: KnowledgeDirectory) {
    setDialog({
      open: true,
      id: item.id,
      parentId: item.parentId,
      name: item.name,
      remark: item.remark || "",
    });
  }

  async function handleSubmit() {
    const name = dialog.name.trim();
    if (!name) {
      toast.error(t("knowledge.directoryNameRequired"));
      return;
    }
    setSaving(true);
    try {
      if (dialog.id) {
        await updateKnowledgeDirectory({
          id: dialog.id,
          knowledgeBaseId,
          parentId: dialog.parentId,
          name,
          remark: dialog.remark.trim(),
        });
        toast.success(t("knowledge.directoryUpdated", { name }));
      } else {
        await createKnowledgeDirectory({
          knowledgeBaseId,
          parentId: dialog.parentId,
          name,
          remark: dialog.remark.trim(),
        });
        toast.success(t("knowledge.directoryCreated", { name }));
      }
      setDialog((current) => ({ ...current, open: false }));
      await loadDirectories();
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("knowledge.directorySaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: KnowledgeDirectory) {
    setSaving(true);
    try {
      await deleteKnowledgeDirectory(item.id);
      if (selectedDirectoryId === item.id) {
        onSelectDirectory(null);
      }
      toast.success(t("knowledge.directoryDeleted", { name: item.name }));
      await loadDirectories();
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("knowledge.directoryDeleteFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDirectoryDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || sorting) {
      return;
    }
    const activeId = Number(active.id);
    if (!Number.isFinite(activeId)) {
      return;
    }
    if (over.id === ROOT_DIRECTORY_DROP_ID) {
      await handleDirectoryMoveToParent(activeId, 0);
      return;
    }
    const overId = Number(over.id);
    if (!Number.isFinite(overId)) {
      return;
    }

    const activeParentId = findDirectoryParentId(directories, activeId);
    const overParentId = findDirectoryParentId(directories, overId);
    if (activeParentId === null || overParentId === null) {
      return;
    }
    if (activeParentId !== overParentId) {
      await handleDirectoryMoveToParent(activeId, overId);
      return;
    }
    if (activeParentId === 0 && overParentId === 0 && event.delta.x > 24) {
      await handleDirectoryMoveToParent(activeId, overId);
      return;
    }

    const previousDirectories = directories;
    const moved = moveDirectoryWithinParent(previousDirectories, activeParentId, activeId, overId);
    if (!moved.changed) {
      return;
    }

    setDirectories(moved.items);
    setSorting(true);
    try {
      await updateKnowledgeDirectorySort({
        knowledgeBaseId,
        parentId: moved.parentId,
        ids: moved.orderedIds,
      });
      toast.success(t("knowledge.directorySortUpdated"));
      await loadDirectories();
      onChanged?.();
    } catch (error) {
      setDirectories(previousDirectories);
      toast.error(error instanceof Error ? error.message : t("knowledge.directorySortUpdateFailed"));
    } finally {
      setSorting(false);
    }
  }

  async function handleDirectoryMoveToParent(activeId: number, targetParentId: number) {
    const previousDirectories = directories;
    const moved = moveDirectoryToParent(previousDirectories, activeId, targetParentId);
    if (!moved.changed || !moved.item) {
      return;
    }

    setDirectories(moved.items);
    if (moved.parentId > 0) {
      setExpandedIds((current) => new Set(current).add(moved.parentId));
    }
    setSorting(true);
    try {
      await updateKnowledgeDirectory({
        id: moved.item.id,
        knowledgeBaseId,
        parentId: moved.parentId,
        name: moved.item.name,
        remark: moved.item.remark || "",
      });
      await updateKnowledgeDirectorySort({
        knowledgeBaseId,
        parentId: moved.parentId,
        ids: moved.orderedIds,
      });
      toast.success(t("knowledge.directoryMoved"));
      await loadDirectories();
      onChanged?.();
    } catch (error) {
      setDirectories(previousDirectories);
      toast.error(error instanceof Error ? error.message : t("knowledge.directoryMoveFailed"));
    } finally {
      setSorting(false);
    }
  }

  return (
    <>
      <div
        className="relative flex h-full min-h-0 shrink-0 flex-col border-r bg-muted/20"
        style={{ width: panelWidth }}
      >
        <div className="flex h-[49px] items-center justify-between border-b bg-background px-3">
          <div className="text-sm font-medium">{t("knowledge.directory")}</div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={loading || saving}
            onClick={() => openCreate(0)}
            aria-label={t("knowledge.createDirectory")}
          >
            <FolderPlusIcon className="size-4" />
          </Button>
        </div>
        <ScrollArea className="min-h-0 flex-1 overflow-hidden">
          <div className="py-1">
            <DirectoryStaticRow
              icon={<LayersIcon className="size-4 text-muted-foreground" />}
              label={t("knowledge.allContent")}
              selected={selectedDirectoryId === null}
              onClick={() => onSelectDirectory(null)}
            />
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => void handleDirectoryDragEnd(event)}
            >
              <RootDirectoryRow
                selected={selectedDirectoryId === 0}
                onClick={() => onSelectDirectory(0)}
                t={t}
              />
              <SortableContext
                items={directories.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                {directories.map((item) => (
                  <DirectoryNode
                    key={item.id}
                    item={item}
                    depth={0}
                    expandedIds={expandedIds}
                    selectedDirectoryId={selectedDirectoryId}
                    contextMenuDirectoryId={contextMenuDirectoryId}
                    saving={saving || sorting}
                    onToggle={toggleDirectory}
                    onSelect={onSelectDirectory}
                    onContextMenuOpenChange={(directoryId, open) =>
                      setContextMenuDirectoryId(open ? directoryId : null)
                    }
                    onCreate={openCreate}
                    onEdit={openEdit}
                    onDelete={(directory) => void handleDelete(directory)}
                    t={t}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </ScrollArea>
        <div
          className="absolute top-0 right-[-3px] z-10 h-full w-1.5 cursor-col-resize transition-colors hover:bg-primary/30"
          onPointerDown={handleResizePointerDown}
          role="separator"
          aria-orientation="vertical"
          aria-label={t("knowledge.resizeDirectoryPanel")}
        />
      </div>
      <ProjectDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        title={dialog.id ? t("knowledge.editDirectory") : t("knowledge.createDirectory")}
        size="sm"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialog((current) => ({ ...current, open: false }))}
              disabled={saving}
            >
              {t("knowledge.cancel")}
            </Button>
            <Button type="button" onClick={() => void handleSubmit()} disabled={saving}>
              {saving ? t("knowledge.saving") : t("knowledge.save")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field>
            <FieldLabel>{t("knowledge.parentDirectory")}</FieldLabel>
            <FieldContent>
              <OptionCombobox
                value={String(dialog.parentId)}
                onChange={(value) =>
                  setDialog((current) => ({ ...current, parentId: Number(value ?? 0) }))
                }
                options={parentOptions}
                placeholder={t("knowledge.selectDirectory")}
                searchPlaceholder={t("knowledge.searchDirectory")}
                emptyText={t("knowledge.emptyDirectory")}
              />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel>{t("knowledge.directoryName")}</FieldLabel>
            <FieldContent>
              <Input
                ref={directoryNameInputRef}
                autoFocus
                data-knowledge-directory-name-input="true"
                value={dialog.name}
                onChange={(event) =>
                  setDialog((current) => ({ ...current, name: event.target.value }))
                }
                placeholder={t("knowledge.directoryNamePlaceholder")}
              />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel>{t("knowledge.remark")}</FieldLabel>
            <FieldContent>
              <Textarea
                value={dialog.remark}
                onChange={(event) =>
                  setDialog((current) => ({ ...current, remark: event.target.value }))
                }
                rows={3}
                placeholder={t("knowledge.remarkPlaceholder")}
              />
            </FieldContent>
          </Field>
        </div>
      </ProjectDialog>
    </>
  );
}

type DirectoryStaticRowProps = {
  icon: ReactNode;
  label: string;
  selected: boolean;
  draggingOver?: boolean;
  onClick: () => void;
};

function DirectoryStaticRow({ icon, label, selected, draggingOver, onClick }: DirectoryStaticRowProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-1 px-2 py-1.5 text-left text-sm hover:bg-accent",
        selected && "bg-accent text-accent-foreground",
        draggingOver && "bg-primary/10 text-accent-foreground",
      )}
      onClick={onClick}
    >
      <span className="size-5" />
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}

type RootDirectoryRowProps = {
  selected: boolean;
  onClick: () => void;
  t: TFunction;
};

function RootDirectoryRow({ selected, onClick, t }: RootDirectoryRowProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: ROOT_DIRECTORY_DROP_ID,
  });

  return (
    <div ref={setNodeRef}>
      <DirectoryStaticRow
        icon={<FolderIcon className="size-4 text-muted-foreground" />}
        label={t("knowledge.rootContent")}
        selected={selected}
        draggingOver={isOver}
        onClick={onClick}
      />
    </div>
  );
}

type DirectoryNodeProps = {
  item: KnowledgeDirectory;
  depth: number;
  expandedIds: Set<number>;
  selectedDirectoryId: number | null;
  contextMenuDirectoryId: number | null;
  saving: boolean;
  onToggle: (id: number) => void;
  onSelect: (id: number) => void;
  onContextMenuOpenChange: (id: number, open: boolean) => void;
  onCreate: (parentId: number) => void;
  onEdit: (item: KnowledgeDirectory) => void;
  onDelete: (item: KnowledgeDirectory) => void;
  t: TFunction;
};

type TFunction = (key: string, values?: Record<string, string | number>) => string;

function DirectoryNode({
  item,
  depth,
  expandedIds,
  selectedDirectoryId,
  contextMenuDirectoryId,
  saving,
  onToggle,
  onSelect,
  onContextMenuOpenChange,
  onCreate,
  onEdit,
  onDelete,
  t,
}: DirectoryNodeProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled: saving,
  });
  const expanded = expandedIds.has(item.id);
  const hasChildren = (item.children || []).length > 0;
  const active = selectedDirectoryId === item.id || contextMenuDirectoryId === item.id;
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ContextMenu onOpenChange={(open) => onContextMenuOpenChange(item.id, open)}>
        <ContextMenuTrigger className="block">
          <div
            className={cn(
              "group flex cursor-pointer items-center gap-1 px-2 py-1.5 text-sm hover:bg-accent",
              active && "bg-accent text-accent-foreground",
              isDragging && "bg-muted/60 shadow-sm opacity-80",
            )}
            style={{ paddingLeft: 8 + depth * 16 }}
            onClick={() => onSelect(item.id)}
            {...attributes}
            {...listeners}
          >
            <Button
              variant="ghost"
              size="icon"
              className="size-5 shrink-0"
              disabled={!hasChildren}
              onClick={(event) => {
                event.stopPropagation();
                onToggle(item.id);
              }}
              aria-label={expanded ? t("knowledge.collapseDirectory") : t("knowledge.expandDirectory")}
            >
              {expanded ? <ChevronDownIcon className="size-3.5" /> : <ChevronRightIcon className="size-3.5" />}
            </Button>
            <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-left">
              {item.name}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger
                onClick={(event) => event.stopPropagation()}
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 opacity-0 group-hover:opacity-100"
                    disabled={saving}
                  />
                }
                aria-label={t("knowledge.moreActions", { name: item.name })}
              >
                <MoreHorizontalIcon className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 min-w-40">
                {item.parentId === 0 ? (
                  <DropdownMenuItem onClick={() => onCreate(item.id)}>
                    <PlusIcon className="mr-2 size-3.5" />
                    {t("knowledge.createSubDirectory")}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onClick={() => onEdit(item)}>
                  <PencilIcon className="mr-2 size-3.5" />
                  {t("knowledge.edit")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(item)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2Icon className="mr-2 size-3.5" />
                  {t("knowledge.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-40">
          {item.parentId === 0 ? (
            <ContextMenuItem onClick={() => onCreate(item.id)}>
              <PlusIcon className="mr-2 size-3.5" />
              {t("knowledge.createSubDirectory")}
            </ContextMenuItem>
          ) : null}
          <ContextMenuItem onClick={() => onEdit(item)}>
            <PencilIcon className="mr-2 size-3.5" />
            {t("knowledge.edit")}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => onDelete(item)}
            variant="destructive"
          >
            <Trash2Icon className="mr-2 size-3.5" />
            {t("knowledge.delete")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {expanded
        ? (
            <SortableContext
              items={(item.children || []).map((child) => child.id)}
              strategy={verticalListSortingStrategy}
            >
              {(item.children || []).map((child) => (
                <DirectoryNode
                  key={child.id}
                  item={child}
                  depth={depth + 1}
                  expandedIds={expandedIds}
                  selectedDirectoryId={selectedDirectoryId}
                  contextMenuDirectoryId={contextMenuDirectoryId}
                  saving={saving}
                  onToggle={onToggle}
                  onSelect={onSelect}
                  onContextMenuOpenChange={onContextMenuOpenChange}
                  onCreate={onCreate}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  t={t}
                />
              ))}
            </SortableContext>
          )
        : null}
    </div>
  );
}
