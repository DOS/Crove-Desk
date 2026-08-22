export type SortableKnowledgeDirectory = {
  id: number
  parentId: number
  children?: SortableKnowledgeDirectory[]
}

export type MoveDirectoryResult<T extends SortableKnowledgeDirectory> = {
  items: T[]
  changed: boolean
  parentId: number
  orderedIds: number[]
}

export type MoveDirectoryToParentResult<T extends SortableKnowledgeDirectory> =
  MoveDirectoryResult<T> & {
    item: T | null
  }

function arrayMove<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

export function findDirectoryParentId<T extends SortableKnowledgeDirectory>(
  items: T[],
  id: number,
): number | null {
  for (const item of items) {
    if (item.id === id) {
      return item.parentId
    }
    const childParentId = findDirectoryParentId(item.children as T[] | undefined ?? [], id)
    if (childParentId !== null) {
      return childParentId
    }
  }
  return null
}

export function findDirectory<T extends SortableKnowledgeDirectory>(
  items: T[],
  id: number,
): T | null {
  for (const item of items) {
    if (item.id === id) {
      return item
    }
    const child = findDirectory(item.children as T[] | undefined ?? [], id)
    if (child !== null) {
      return child
    }
  }
  return null
}

export function moveDirectoryToParent<T extends SortableKnowledgeDirectory>(
  items: T[],
  activeId: number,
  targetParentId: number,
): MoveDirectoryToParentResult<T> {
  if (activeId === targetParentId) {
    return unchangedParentMove(items, targetParentId)
  }

  const activeItem = findDirectory(items, activeId)
  const activeParentId = findDirectoryParentId(items, activeId)
  if (!activeItem || activeParentId === null || activeParentId === targetParentId) {
    return unchangedParentMove(items, targetParentId)
  }

  if (targetParentId > 0) {
    const targetParent = findDirectory(items, targetParentId)
    if (!targetParent || targetParent.parentId !== 0 || (activeItem.children?.length ?? 0) > 0) {
      return unchangedParentMove(items, targetParentId)
    }
  }

  const removed = removeDirectory(items, activeId)
  if (!removed.item) {
    return unchangedParentMove(items, targetParentId)
  }

  const movedItem = { ...removed.item, parentId: targetParentId } as T
  const appended = appendDirectoryToParent(removed.items, targetParentId, movedItem)
  if (!appended.changed) {
    return unchangedParentMove(items, targetParentId)
  }

  return {
    items: appended.items,
    changed: true,
    parentId: targetParentId,
    orderedIds: appended.siblings.map((item) => item.id),
    item: movedItem,
  }
}

export function moveDirectoryWithinParent<T extends SortableKnowledgeDirectory>(
  items: T[],
  parentId: number,
  activeId: number,
  overId: number,
): MoveDirectoryResult<T> {
  if (activeId === overId) {
    return { items, changed: false, parentId, orderedIds: [] }
  }

  if (parentId === 0) {
    return moveSiblingList(items, parentId, activeId, overId)
  }

  let changed = false
  let orderedIds: number[] = []
  const nextItems = items.map((item) => {
    if (item.id === parentId) {
      const moved = moveSiblingList((item.children as T[] | undefined) ?? [], parentId, activeId, overId)
      changed = moved.changed
      orderedIds = moved.orderedIds
      return { ...item, children: moved.items }
    }
    if (item.children?.length) {
      const moved = moveDirectoryWithinParent(item.children as T[], parentId, activeId, overId)
      if (moved.changed) {
        changed = true
        orderedIds = moved.orderedIds
        return { ...item, children: moved.items }
      }
    }
    return item
  })

  return {
    items: changed ? nextItems : items,
    changed,
    parentId,
    orderedIds,
  }
}

function unchangedParentMove<T extends SortableKnowledgeDirectory>(
  items: T[],
  parentId: number,
): MoveDirectoryToParentResult<T> {
  return { items, changed: false, parentId, orderedIds: [], item: null }
}

function removeDirectory<T extends SortableKnowledgeDirectory>(
  items: T[],
  id: number,
): { items: T[]; item: T | null } {
  let removedItem: T | null = null
  const nextItems: T[] = []

  for (const item of items) {
    if (item.id === id) {
      removedItem = item
      continue
    }
    if (item.children?.length) {
      const removed = removeDirectory(item.children as T[], id)
      if (removed.item) {
        removedItem = removed.item
        nextItems.push({ ...item, children: removed.items } as T)
        continue
      }
    }
    nextItems.push(item)
  }

  return {
    items: removedItem ? nextItems : items,
    item: removedItem,
  }
}

function appendDirectoryToParent<T extends SortableKnowledgeDirectory>(
  items: T[],
  parentId: number,
  item: T,
): { items: T[]; changed: boolean; siblings: T[] } {
  if (parentId === 0) {
    const siblings = [...items, item]
    return { items: siblings, changed: true, siblings }
  }

  let changed = false
  let siblings: T[] = []
  const nextItems = items.map((current) => {
    if (current.id === parentId) {
      siblings = [...((current.children as T[] | undefined) ?? []), item]
      changed = true
      return { ...current, children: siblings } as T
    }
    if (current.children?.length) {
      const appended = appendDirectoryToParent(current.children as T[], parentId, item)
      if (appended.changed) {
        changed = true
        siblings = appended.siblings
        return { ...current, children: appended.items } as T
      }
    }
    return current
  })

  return {
    items: changed ? nextItems : items,
    changed,
    siblings,
  }
}

function moveSiblingList<T extends SortableKnowledgeDirectory>(
  items: T[],
  parentId: number,
  activeId: number,
  overId: number,
): MoveDirectoryResult<T> {
  const oldIndex = items.findIndex((item) => item.id === activeId)
  const newIndex = items.findIndex((item) => item.id === overId)
  if (oldIndex < 0 || newIndex < 0) {
    return { items, changed: false, parentId, orderedIds: [] }
  }

  const nextItems = arrayMove(items, oldIndex, newIndex)
  return {
    items: nextItems,
    changed: true,
    parentId,
    orderedIds: nextItems.map((item) => item.id),
  }
}
