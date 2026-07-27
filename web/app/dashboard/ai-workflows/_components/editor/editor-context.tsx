"use client"

import { createContext, useContext, type ReactNode } from "react"

import type { WorkflowEditorContextValue } from "./types"

const WorkflowEditorContext = createContext<WorkflowEditorContextValue | null>(null)
const WorkflowEditorSurfaceContext = createContext<"canvas" | "sidebar">("canvas")

export function WorkflowEditorContextProvider({
  value,
  children,
}: {
  value: WorkflowEditorContextValue
  children: ReactNode
}) {
  return (
    <WorkflowEditorContext.Provider value={value}>
      {children}
    </WorkflowEditorContext.Provider>
  )
}

export function WorkflowEditorSurfaceProvider({
  surface,
  children,
}: {
  surface: "canvas" | "sidebar"
  children: ReactNode
}) {
  return (
    <WorkflowEditorSurfaceContext.Provider value={surface}>
      {children}
    </WorkflowEditorSurfaceContext.Provider>
  )
}

export function useWorkflowEditorContext() {
  const value = useContext(WorkflowEditorContext)
  if (!value) {
    throw new Error("WorkflowEditorContext is unavailable")
  }
  return value
}

export function useWorkflowEditorSurface() {
  return useContext(WorkflowEditorSurfaceContext)
}

