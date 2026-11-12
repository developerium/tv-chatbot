import { readFileSync } from 'node:fs'

import {
  toPersonCredits,
  toSeriesDetails,
  toSeriesSearchSummary,
} from './tvdb.mapper.js'

function loadSample(name: string) {
  const path = `${import.meta.dirname}/../../test/fixtures/tvdb/samples/${name}.json`

  return JSON.parse(readFileSync(path, 'utf8')).data
}

describe('tvdb mapper', () => {
  it('maps a search result with a numeric id', () => {
    const [breakingBad] = loadSample('search-series')

    expect(toSeriesSearchSummary(breakingBad)).toMatchObject({
      id: 81_189,
      name: 'Breaking Bad',
      network: 'AMC',
    })
  })

  it('keeps the featured cast in order and the networks', () => {
    const series = toSeriesDetails(loadSample('series-extended'))

    expect(series.mainCast.slice(0, 2)).toEqual([
      {
        character: 'Walter White',
        personId: 255_211,
        personName: 'Bryan Cranston',
      },
      { character: 'Skyler White', personId: 269_404, personName: 'Anna Gunn' },
    ])
    expect(series.originalNetwork).toEqual({
      country: 'usa',
      id: 389,
      name: 'AMC',
    })
    expect(series.genres).toContain('Drama')
    expect(series.status).toBe('Ended')
    expect(series.nextAired).toBeNull()
  })

  it('keeps one acting credit per series and drops movies', () => {
    const person = toPersonCredits(loadSample('people-extended'))

    expect(person.series).toHaveLength(15)
    expect(person.series).toContainEqual({
      character: 'Walter White',
      id: 81_189,
      name: 'Breaking Bad',
      year: '2008',
    })
  })
})
