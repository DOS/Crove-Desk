import { request } from "@/lib/api/client"

export type OrganizationItem = {
  id: number
  code: string
  name: string
  logo: string
  plan: string
  status: number
  role?: string
  isActive: boolean
  createdAt: string
}

export type UserOrganizationListResponse = {
  currentOrganizationId: number
  organizations: OrganizationItem[]
}

export async function listMyOrganizations() {
  return request<UserOrganizationListResponse>("/api/dashboard/organization/my_list", {
    method: "GET",
  })
}

export async function switchOrganization(organizationId: number) {
  return request<OrganizationItem>("/api/dashboard/organization/switch", {
    method: "POST",
    body: JSON.stringify({ organizationId }),
  })
}
