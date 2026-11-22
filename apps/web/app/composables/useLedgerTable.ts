import { useTable } from '@querry-kit/nuxt/table';
import type { ZodType } from 'zod';
import { ledgerSort, ledgerPageNumber } from '../utils/ledger-table-route';
import type { tablePageMetaSchema } from '@financial-tracking/contracts';
import type { z } from 'zod';

/** Keep server paging and sort state owned by the URL while Querry Kit owns request lifecycle. */
export function useLedgerTable<T extends Record<string, unknown>>(options: {
  endpoint: string;
  schema: ZodType<{ items: T[]; meta: z.infer<typeof tablePageMetaSchema> }>;
  fields: readonly string[];
  sortable: readonly string[];
  filters: () => Record<string, unknown>;
  afterLoad?: () => void | Promise<void>;
}) {
  const route = useRoute();
  const router = useRouter();
  const { $createQueryClient } = useNuxtApp();
  const filter = shallowRef<Record<string, unknown>>();
  const loaded = ref(false);
  const path = route.path;
  let started = false;
  const columns = ref(
    options.fields.map(/** Keep every visibly rendered field in the requested projection. */ (id) => ({ id })),
  );
  const table = useTable<T>({
    api: $createQueryClient(options.schema),
    endpoint: options.endpoint,
    columns,
    staticFilter: filter,
    persistenceKey: options.endpoint,
    storage: {
      /** Sorting and pagination restore from bookmarks. */
      getItem: () => null,
      /** Listing controls never write filter values to device storage. */
      setItem: () => {},
    },
    /** Recover a page lost after removing or reclassifying its last row. */
    async onRefreshed() {
      if (route.path !== path) return;
      const lastPage = Math.max(1, table.totalPages.value);
      if (table.page.value > lastPage) {
        await router.replace({ query: { ...route.query, page: lastPage === 1 ? undefined : lastPage } });
        return;
      }
      loaded.value = true;
      await options.afterLoad?.();
    },
  });

  /** Synchronize data and controls from one applied route before Querry Kit refreshes. */
  function syncRoute() {
    const where = options.filters();
    if (JSON.stringify(where) !== JSON.stringify(filter.value)) filter.value = where;
    table.page.value = ledgerPageNumber(route.query.page, 1_000_000) ?? 1;
    table.itemsPerPage.value = ledgerPageNumber(route.query.perPage, 100) ?? 25;
    const sort = ledgerSort(route.query.sort, options.sortable);
    if (JSON.stringify(sort) !== JSON.stringify(table.sorting.value)) table.sorting.value = sort;
  }

  /** Enable queries after the screen has loaded its route-specific reference data. */
  function start() {
    if (started) return table.refresh();
    started = true;
    syncRoute();
    return nextTick(
      /** An empty filter and default controls do not trigger the library watcher. */ () => {
        if (!table.loading.value && !loaded.value && !table.error.value) return table.refresh();
      },
    );
  }

  watch(
    /** Observe only this listing's URL. */ () => route.fullPath,
    /** Back/forward, filter and paging changes should share the same rewrite. */ () => {
      if (started && route.path === path) syncRoute();
    },
  );

  /** Apply a bounded page size and reset to the first page. */
  function setPageSize(value: number) {
    if (!(Number.isInteger(value) && value >= 1 && value <= 100)) return;
    return router.push({ query: { ...route.query, perPage: value === 25 ? undefined : value, page: undefined } });
  }

  const page = computed({
    /** Display the current accepted page. */
    get: () => table.page.value,
    /** Bookmark a page selected from the pagination panel. */
    set: (value) => {
      void router.push({ query: { ...route.query, page: value === 1 ? undefined : value } });
    },
  });
  const sorting = computed({
    /** Display the currently applied ordering. */
    get: () => table.sorting.value,
    /** Store only declared sorts and clear the previous page. */
    set: (value) => {
      const order = ledgerSort(JSON.stringify(value), options.sortable);
      void router.push({
        query: { ...route.query, sort: order.length ? JSON.stringify(order) : undefined, page: undefined },
      });
    },
  });

  return {
    ...table,
    page,
    sorting,
    setPageSize,
    start,
    loaded,
  };
}
