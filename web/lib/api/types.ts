export type PageData<T> = {
  cursor?: string
  hasMore: boolean
  results: T[]
}
