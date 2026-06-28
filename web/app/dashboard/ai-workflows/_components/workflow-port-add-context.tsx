"use client"

import { createContext, useContext } from "react"

import type { WorkflowLineEntity, WorkflowPortEntity } from "@flowgram.ai/free-layout-editor"

export type WorkflowPortAddRequest = {
  sourcePort: WorkflowPortEntity
  targetPort?: WorkflowPortEntity
  line?: WorkflowLineEntity
  event: React.MouseEvent
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
