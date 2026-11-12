// A TVDB entity an assistant answer is based on.
export interface SourceEntity {
  name: string
  tvdbId: number
  type: 'company' | 'person' | 'series'
  url: string
}
