// Raw TVDB v4 response shapes, limited to the fields we read.
// See docs/TVDB_API.md and test/fixtures/tvdb/samples/.

export interface TvdbSearchResult {
  country: null | string
  name: string
  network: null | string
  overview: null | string
  primary_type: null | string
  status: null | string
  tvdb_id: string
  year: null | string
}

export interface TvdbStatus {
  id: number
  name: string
}

export interface TvdbSeriesBase {
  firstAired: null | string
  id: number
  name: string
  overview: null | string
  score: number
  status: null | TvdbStatus
  year: null | string
}

export interface TvdbCompany {
  companyType?: { companyTypeName: string }
  country: null | string
  id: number
  name: string
}

export interface TvdbCharacter {
  isFeatured: boolean
  movieId: null | number
  name: null | string
  peopleId: number
  peopleType: string
  personName: null | string
  series: null | { name: null | string; year: null | string }
  seriesId: null | number
  sort: number
}

export interface TvdbSeriesExtended extends TvdbSeriesBase {
  averageRuntime: null | number
  characters: null | TvdbCharacter[]
  companies: null | TvdbCompany[]
  genres: null | { id: number; name: string }[]
  lastAired: null | string
  latestNetwork: null | TvdbCompany
  nextAired: null | string
  originalCountry: null | string
  originalLanguage: null | string
  originalNetwork: null | TvdbCompany
}

export interface TvdbPersonExtended {
  birth: null | string
  characters: null | TvdbCharacter[]
  death: null | string
  id: number
  name: string
}

export interface TvdbGenre {
  id: number
  name: string
}

export type SearchType = 'company' | 'person' | 'series'
