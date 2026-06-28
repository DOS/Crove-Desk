"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"

export type SelectedWorkflowBranch = {
  nodeId: string
  branchId: string
}

type WorkflowBranchSelectionContextValue = {
  selectedBranch: SelectedWorkflowBranch | null
  onSelectBranch: (branch: SelectedWorkflowBranch | null) => void
}

const WorkflowBranchSelectionContext = createContext<WorkflowBranchSelectionContextValue>({
  selectedBranch: null,
  onSelectBranch: () => {},
})

export function WorkflowBranchSelectionProvider({
  selectedBranch,
  onSelectBranch,
  children,
}: WorkflowBranchSelectionContextValue & {
  children: ReactNode
}) {
  const value = useMemo(
    () => ({ selectedBranch, onSelectBranch }),
    [onSelectBranch, selectedBranch]
  )

  return (
    <WorkflowBranchSelectionContext.Provider value={value}>
      {children}
    </WorkflowBranchSelectionContext.Provider>
  )
}

export function useWorkflowBranchSelection() {
  return useContext(WorkflowBranchSelectionContext)
}
