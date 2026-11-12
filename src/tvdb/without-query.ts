// A request path for logs, without the query string (it can hold user text).
export function withoutQuery(path: string): string {
  return path.split('?')[0]
}
