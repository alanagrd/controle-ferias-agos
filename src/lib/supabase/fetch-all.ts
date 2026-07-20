/**
 * Supabase's PostgREST layer caps any `.select()` at 1000 rows by default
 * (the `max_rows` config) when no explicit `.range()` is applied. Tables in
 * this app (`rh_funcionarios`, `rh_periodos_aquisitivos` / `v_rh_periodos`)
 * have grown past 1000 rows, so any "fetch everything" query silently drops
 * rows past the first page unless it paginates.
 *
 * `fetchAllRows` loops with `.range()` until a page comes back short of
 * `pageSize`, accumulating every row. The caller supplies a factory that
 * takes `(from, to)` and returns a fresh query for that page — Supabase
 * query builders must be rebuilt per call since `.range()` can't be
 * reapplied to an already-awaited builder.
 *
 * Always give the underlying query a deterministic `.order(...)` (e.g. by
 * `id`) so page boundaries are stable — without it, Postgres may return
 * rows in a different order per page, causing skipped or duplicated rows.
 */
export async function fetchAllRows<T>(
  pageFactory: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000
): Promise<{ data: T[]; error: unknown }> {
  const all: T[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await pageFactory(from, to);
    if (error) return { data: all, error };
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return { data: all, error: null };
}
