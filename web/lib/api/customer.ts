import { request } from "@/lib/api/client"
import type { PageResult } from "@/lib/api/admin"
import type { ContactType } from "@/lib/generated/enums"
import { AdminCompany } from "./company"

export type CustomerIdentity = {
  id: number
  customerId: number
  externalSource: string
  externalId: string
  status: number
  createdAt?: string
}

export type AdminCustomer = {
  id: number
  name: string
  gender: number
  companyId: number
  company?: AdminCompany
  lastActiveAt?: string
  primaryMobile: string
  primaryEmail: string
  status: number
  remark: string
  identities?: CustomerIdentity[]
  channels?: string[]
  createdAt: string
  updatedAt: string
}

export type CreateAdminCustomerPayload = {
  name: string
  gender: number
  companyId: number
  primaryMobile: string
  primaryEmail: string
  remark: string
}

export type UpdateAdminCustomerPayload = CreateAdminCustomerPayload & {
  id: number
}

/** Matches POST /customer/save/profile request body. */
export type SaveCustomerProfileContactLine = {
  id?: number
  contactType: ContactType | string
  contactValue: string
  remark: string
  isPrimary: boolean
}

export type SaveCustomerProfilePayload = {
  id?: number
  name: string
  gender: number
  companyId: number
  remark: string
  contacts: SaveCustomerProfileContactLine[]
}

/** Matches POST /customer/list JSON body. */
export type CustomerListRequest = {
  page: number
  limit: number
  status?: number
  gender?: number
  companyId?: number
  /** Fuzzy match against customer name, primary phone, primary email, contacts, and company name. */
  keyword?: string
}

export function fetchCustomers(body: CustomerListRequest) {
  return request<PageResult<AdminCustomer>>("/api/dashboard/customer/list", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export function fetchCustomer(id: number) {
  return request<AdminCustomer | null>(`/api/dashboard/customer/${id}`)
}

export function createCustomer(payload: CreateAdminCustomerPayload) {
  return request<AdminCustomer>("/api/dashboard/customer/create", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

/** Saves the customer profile and the full contact list in one request and transaction. */
export function saveCustomerProfile(payload: SaveCustomerProfilePayload) {
  return request<AdminCustomer>("/api/dashboard/customer/save_profile", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function updateCustomer(payload: UpdateAdminCustomerPayload) {
  return request<void>("/api/dashboard/customer/update", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function updateCustomerStatus(id: number, status: number) {
  return request<void>("/api/dashboard/customer/update_status", {
    method: "POST",
    body: JSON.stringify({ id, status }),
  })
}

export function deleteCustomer(id: number) {
  return request<void>("/api/dashboard/customer/delete", {
    method: "POST",
    body: JSON.stringify({ id }),
  })
}

export type MergeCustomerPayload = {
  targetCustomerId: number
  sourceCustomerId: number
  reason?: string
}

export function mergeCustomer(payload: MergeCustomerPayload) {
  return request<AdminCustomer>("/api/dashboard/customer/merge", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}
