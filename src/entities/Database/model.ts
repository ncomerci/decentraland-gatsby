import { Model as BaseModel, OnConflict, PrimaryKey, QueryPart, SQLStatement } from "decentraland-server";
import { createQueryHash, database_duration_seconds, database_pool_size } from './metrics';

async function messureWithParams<T>(exec: () => Promise<T>, params: { queryId: string, [key: string]: any }): Promise<T> {
  database_pool_size.inc({ query: params.queryId })
  const complete = database_duration_seconds.startTimer({ query: params.queryId })
  try {
    const result = await exec()
    database_pool_size.dec({ query: params.queryId })
    complete({ error: 0 })
    return result
  } catch (err) {
    database_pool_size.dec({ query: params.queryId })
    complete({ error: 1 })
    Object.assign(err, params)
    throw err
  }
}

export class Model<T extends {}> extends BaseModel<T> {

  static async find<U extends {} = any>(conditions?: Partial<U>, orderBy?: Partial<U>, extra?: string): Promise<U[]> {
    const queryId = createQueryHash(
      'find',
      this.tableName,
      Object.keys(conditions || {}),
      Object.keys(orderBy || {}),
      extra || ''
    )

    return messureWithParams(
      () => super.find(conditions, orderBy, extra),
      { queryId, conditions, orderBy, extra }
    )
  }

  static findOne<U extends {} = any, P extends QueryPart = any>(primaryKey: PrimaryKey, orderBy?: Partial<P>): Promise<U | undefined>;
  static findOne<U extends QueryPart = any, P extends QueryPart = any>(conditions: Partial<U>, orderBy?: Partial<P>): Promise<U | undefined>;
  static async findOne<U extends QueryPart = any, P extends QueryPart = any>(conditions: PrimaryKey | Partial<U>, orderBy?: Partial<P>): Promise<U | undefined> {
    const queryId = createQueryHash(
      'findOne',
      this.tableName,
      typeof conditions === 'object' ? Object.keys(conditions) : conditions,
      Object.keys(orderBy || {})
    )
    return messureWithParams(
      () => super.findOne(conditions as PrimaryKey, orderBy),
      { queryId, conditions, orderBy }
    )
  }

  static async count<U extends QueryPart = any>(conditions: Partial<U>, extra?: string): Promise<number> {
    const queryId = createQueryHash(
      'count',
      this.tableName,
      Object.keys(conditions),
      extra || ''
    )

    return messureWithParams(
      () => super.count(conditions, extra),
      { queryId, conditions, extra }
    )
  }

  static async create<U extends QueryPart = any>(row: U): Promise<U> {
    const queryId = createQueryHash('create', this.tableName)
    return messureWithParams(
      () => super.create(row),
      { queryId, row }
    )
  }

  static async upsert<U extends QueryPart = any>(row: U, onConflict?: OnConflict<U>): Promise<U> {
    const queryId = createQueryHash('upsert', this.tableName)
    return messureWithParams(
      () => super.upsert(row),
      { queryId, row, onConflict }
    )
  }


  static async update<U extends QueryPart = any, P extends QueryPart = any>(changes: Partial<U>, conditions: Partial<P>): Promise<any> {
    const queryId = createQueryHash(
      'update',
      this.tableName,
      Object.values(changes),
      Object.values(conditions)
    )

    return messureWithParams(
      () => super.update(changes, conditions),
      { queryId, changes, conditions }
    )
  }

  static async delete<U extends QueryPart = any>(conditions: Partial<U>): Promise<any> {
    const queryId = createQueryHash(
      'update',
      this.tableName,
      Object.values(conditions)
    )

    return messureWithParams(
      () => super.delete(conditions),
      { queryId, conditions }
    )
  }

  static async query<U extends {}= any>(query: SQLStatement): Promise<U[]> {
    const queryId = createQueryHash('query', this.tableName, query.text)
    return messureWithParams(
      () => super.query(query.text, query.values),
      { queryId, query: query.text, values: query.values }
    )
  }

  /**
   * Execute a query and returns the number of row affected
   */
  static async rowCount(query: SQLStatement): Promise<number> {
    const queryId = createQueryHash('rowCount', this.tableName, query.text)
    return messureWithParams(
      async () => {
        const result = await this.db.client.query(query)
        return result.rowCount
      },
      { queryId, query: query.text, values: query.values }
    )
  }
}