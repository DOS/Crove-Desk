export const supportSlugPattern = /^[a-z0-9-]+$/

export function normalizeSupportSlug(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
}
