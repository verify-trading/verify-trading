/**
 * Reads every row of a query. Supabase caps each response at 1,000 rows (max-rows) whatever
 * `.range()` asks for, so bulk reads must page. Order the query by a unique key so pages don't
 * overlap or skip rows.
 */
export async function selectAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  size = 1000,
  retries = 1,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    let data: T[] | null = null;
    // One chunk is one Postgres statement: under load a heavy chunk can hit the statement
    // timeout, so a failed chunk gets a short-backoff retry before the whole read gives up.
    for (let attempt = 0; ; attempt++) {
      const res = await page(from, from + size - 1);
      if (!res.error) {
        data = res.data;
        break;
      }
      if (attempt >= retries) throw new Error(res.error.message);
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
    rows.push(...(data ?? []));
    if (!data || data.length < size) return rows;
  }
}
