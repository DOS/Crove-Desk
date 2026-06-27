"use client"

import { useCallback, useState } from "react"

import type { AIWorkflowDefinition } from "@/lib/api/admin"

type WorkflowDefinitionHistoryState = {
  present: AIWorkflowDefinition
  past: AIWorkflowDefinition[]
  future: AIWorkflowDefinition[]
  revision: number
}

export function useWorkflowDefinitionHistory(initialDefinition: AIWorkflowDefinition) {
  const [state, setState] = useState<WorkflowDefinitionHistoryState>({
    present: initialDefinition,
    past: [],
    future: [],
    revision: 0,
  })

  const replace = useCallback((definition: AIWorkflowDefinition) => {
    setState((current) => ({
      present: definition,
      past: [],
      future: [],
      revision: current.revision + 1,
    }))
  }, [])

  const update = useCallback((definition: AIWorkflowDefinition) => {
    setState((current) => {
      if (sameWorkflowDefinition(current.present, definition)) {
        return current
      }
      return {
        present: definition,
        past: [...current.past.slice(-49), current.present],
        future: [],
        revision: current.revision,
      }
    })
  }, [])

  const undo = useCallback(() => {
    setState((current) => {
      const previous = current.past[current.past.length - 1]
      if (!previous) {
        return current
      }
      return {
        present: previous,
        past: current.past.slice(0, -1),
        future: [current.present, ...current.future.slice(0, 49)],
        revision: current.revision + 1,
      }
    })
  }, [])

  const redo = useCallback(() => {
    setState((current) => {
      const next = current.future[0]
      if (!next) {
        return current
      }
      return {
        present: next,
        past: [...current.past.slice(-49), current.present],
        future: current.future.slice(1),
        revision: current.revision + 1,
      }
    })
  }, [])

  return {
    definition: state.present,
    revision: state.revision,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    replace,
    update,
    undo,
    redo,
  }
}

function sameWorkflowDefinition(left: AIWorkflowDefinition, right: AIWorkflowDefinition) {
  return JSON.stringify(left) === JSON.stringify(right)
}
