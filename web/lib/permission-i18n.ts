const PERMISSION_ACTION_LABELS: Record<string, string> = {
  view: "View",
  create: "Create",
  update: "Update",
  delete: "Delete",
  assignRole: "Assign roles to",
  assignPermission: "Assign permissions to",
  sync: "Sync",
  revoke: "Revoke",
  assign: "Assign",
  transfer: "Transfer",
  close: "Close",
  send: "Send",
  tag: "Manage tags for",
  handover: "Handle handoffs for",
  recycle: "Recycle",
  linkCustomer: "Link customers to",
  changeStatus: "Change status for",
  progress: "Update progress for",
  resetUserTokenSecret: "Reset user token secret for",
  updateStatus: "Update status for",
  config: "Configure service rules for",
  batchGenerate: "Batch generate",
  call: "Call",
}

const PERMISSION_RESOURCE_LABELS: Record<string, { singular: string; plural: string }> = {
  user: { singular: "user", plural: "users" },
  role: { singular: "role", plural: "roles" },
  permission: { singular: "permission", plural: "permissions" },
  session: { singular: "session", plural: "sessions" },
  conversation: { singular: "conversation", plural: "conversations" },
  ticket: { singular: "ticket", plural: "tickets" },
  notification: { singular: "notification", plural: "notifications" },
  quickReply: { singular: "quick reply", plural: "quick replies" },
  tag: { singular: "tag", plural: "tags" },
  company: { singular: "company", plural: "companies" },
  channel: { singular: "channel", plural: "channels" },
  wxworkOutbox: { singular: "WeCom outbox record", plural: "WeCom outbox records" },
  customer: { singular: "customer", plural: "customers" },
  agent: { singular: "agent", plural: "agents" },
  agentTeam: { singular: "agent team", plural: "agent teams" },
  agentTeamSchedule: { singular: "agent team schedule", plural: "agent team schedules" },
  asset: { singular: "file asset", plural: "file assets" },
  aiAgent: { singular: "AI Agent", plural: "AI Agents" },
  aiConfig: { singular: "AI configuration", plural: "AI configurations" },
  knowledgeBase: { singular: "knowledge base", plural: "knowledge bases" },
  knowledgeDocument: { singular: "knowledge document", plural: "knowledge documents" },
  knowledgeFAQ: { singular: "knowledge FAQ", plural: "knowledge FAQs" },
  skillDefinition: { singular: "Skill definition", plural: "Skill definitions" },
  mcp: { singular: "MCP tool", plural: "MCP tools" },
}

const PERMISSION_NAME_OVERRIDES: Record<string, string> = {
  "user.assignRole": "Assign user roles",
  "role.assignPermission": "Assign role permissions",
  "session.revoke": "Revoke sessions",
  "conversation.linkCustomer": "Link conversation customer",
  "ticket.changeStatus": "Change ticket status",
  "ticket.progress": "Update ticket progress",
  "channel.resetUserTokenSecret": "Reset channel user token secret",
  "agent.config": "Configure agent service rules",
  "agentTeamSchedule.batchGenerate": "Batch generate agent team schedules",
  "wxworkOutbox.update": "Handle WeCom outbox records",
  "mcp.view": "View MCP debug information",
  "mcp.call": "Call MCP tools",
}

export function getPermissionDisplayName(
  code: string | undefined,
  fallbackName: string,
  locale: string
) {
  if (locale !== "en-US") {
    return fallbackName
  }
  const normalizedCode = code?.trim() ?? ""
  if (!normalizedCode) {
    return fallbackName
  }
  const override = PERMISSION_NAME_OVERRIDES[normalizedCode]
  if (override) {
    return override
  }
  const [resourceKey, actionKey] = normalizedCode.split(".")
  const resource = PERMISSION_RESOURCE_LABELS[resourceKey]
  const action = PERMISSION_ACTION_LABELS[actionKey]
  if (!resource || !action) {
    return fallbackName
  }
  return `${action} ${resource.plural}`
}

export function getPermissionGroupName(groupName: string | undefined, locale: string) {
  const normalizedGroupName = groupName?.trim() ?? ""
  if (locale !== "en-US") {
    return normalizedGroupName
  }
  const resource = PERMISSION_RESOURCE_LABELS[normalizedGroupName]
  if (!resource) {
    return normalizedGroupName
  }
  return sentenceCase(resource.plural)
}

function sentenceCase(value: string) {
  if (value === "AI Agents" || value === "MCP tools") {
    return value
  }
  return value.charAt(0).toUpperCase() + value.slice(1)
}
