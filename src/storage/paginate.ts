import type { Model, ProjectionType, QueryFilter } from 'mongoose'

import type { PaginationQueryDto } from '../common/pagination/pagination-query.dto.js'

import {
  type DateField,
  type Paginated,
  toPage,
} from '../common/pagination/paginated.js'

export interface PaginateOptions<TEntity> extends PaginationQueryDto {
  projection?: ProjectionType<unknown>
  sortField: DateField<TEntity>
}

// Keyset pagination, newest first: sorts on `sortField` with `_id` as
// tie-breaker, so pages stay correct while new documents arrive.
// Documents must map `_id` to `id` in toJSON.
export async function paginate<TDocument, TEntity extends { id: string }>(
  // Only `find`: comparing whole Model types trips over schema virtuals.
  model: Pick<Model<TDocument>, 'find'>,
  filter: QueryFilter<TDocument>,
  { cursor, limit, projection, sortField }: PaginateOptions<TEntity>,
): Promise<Paginated<TEntity>> {
  const afterCursor = cursor
    ? {
        $or: [
          { [sortField]: { $lt: cursor.value } },
          { _id: { $lt: cursor.id }, [sortField]: cursor.value },
        ],
      }
    : {}

  const documents = await model
    .find({ $and: [filter, afterCursor] } as QueryFilter<TDocument>, projection)
    // Key order is the sort order: sort field first, then the tie-breaker.
    .sort({ [sortField]: -1, _id: -1 })
    .limit(limit + 1)

  return toPage(
    documents.map((document) => document.toJSON<TEntity>()),
    limit,
    sortField,
  )
}
