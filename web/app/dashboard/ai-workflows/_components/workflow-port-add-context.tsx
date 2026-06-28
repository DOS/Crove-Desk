"use client"

import { createContext, useContext } from "react"

import type { WorkflowPortEntity } from "@flowgram.ai/free-layout-editor"

export type WorkflowPortAddRequest = {
  port: WorkflowPortEntity
  event: React.MouseEvent<HTMLDivElement>
}

const WorkflowPortAddContext = createContext<((request: WorkflowPortAddRequest) => void) | null>(null)

export function WorkflowPortAddProvider({
  onRequestAdd,
  children,
}: {
  onRequestAdd: (request: WorkflowPortAddRequest) => void
  children: React.ReactNode
}) {
  return (
    <WorkflowPortAddContext.Provider value={onRequestAdd}>
      {children}
    </WorkflowPortAddContext.Provider>
  )
}

export function useWorkflowPortAdd() {
  return useContext(WorkflowPortAddContext)
}
