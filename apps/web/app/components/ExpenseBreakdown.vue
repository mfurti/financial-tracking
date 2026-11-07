<script setup lang="ts">
import type { Monthly } from '@financial-tracking/contracts';
const props = withDefaults(defineProps<{ report: Monthly; title?: string }>(), { title: 'Ausgaben nach Kategorien' });
const groups = computed(
  /** Income-only groups must not appear as zero-value expenditure slices. */ () =>
    props.report.categories
      .filter(/** Include actual expenditure only. */ (row) => BigInt(row.expenseCents) > 0n)
      .sort(
        /** Compare exact cents without floating point. */ (a, b) =>
          BigInt(a.expenseCents) === BigInt(b.expenseCents)
            ? 0
            : BigInt(a.expenseCents) > BigInt(b.expenseCents)
              ? -1
              : 1,
      ),
);
const gradient = computed(
  /** Render only the server-provided proportions; monetary labels stay exact strings. */ () => {
    let offset = 0;
    const parts: string[] = [];
    groups.value.forEach(
      /** Keep a visible legend for every colored segment. */ (group, index) => {
        const end = Math.min(100, offset + Math.max(0, group.expenseShare ?? 0) * 100);
        parts.push(`var(--chart-${(index % 6) + 1}) ${offset}% ${end}%`);
        offset = end;
      },
    );
    if (offset < 100) parts.push(`var(--soft) ${offset}% 100%`);
    return parts.length ? `conic-gradient(${parts.join(',')})` : 'var(--soft)';
  },
);
/** Link a segment to the same month's real booked expense records. */
function categoryLink(id: string | null) {
  return `/transactions?${new URLSearchParams({ ...monthRangeQuery(props.report.month), ...(id ? { categoryId: id } : { uncategorized: 'true' }), direction: 'EXPENSE', status: 'BOOKED', excludeTransfers: 'true' })}`;
}
</script>

<template>
  <section class="panel spending-panel">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">WOHIN DEIN GELD GEHT</p>
        <h2>{{ title }}</h2>
      </div>
      <span class="subtle-tag">{{ monthName(report.month) }}</span>
    </div>
    <div v-if="groups.length" class="spending-overview">
      <div
        class="spending-donut"
        :style="{ background: gradient }"
        role="img"
        :aria-label="`${money(report.expenseCents)} Ausgaben in ${groups.length} Kategorien`"
      >
        <div>
          <small>Ausgegeben</small><strong>{{ money(report.expenseCents) }}</strong>
        </div>
      </div>
      <div class="spending-legend">
        <NuxtLink
          v-for="(group, index) in groups"
          :key="group.categoryId ?? 'uncategorized'"
          :to="categoryLink(group.categoryId)"
          class="spending-row"
          ><span class="category-dot" :style="{ background: `var(--chart-${(index % 6) + 1})` }" aria-hidden="true" />
          <div>
            <strong>{{ group.name }}</strong
            ><small
              >{{ ((group.expenseShare ?? 0) * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 }) }} % der
              Ausgaben</small
            >
          </div>
          <strong>{{ money(group.expenseCents) }}</strong></NuxtLink
        >
      </div>
    </div>
    <div v-else class="empty-state">
      <FinanceIcon name="categories" />
      <h3>Noch keine Ausgaben in diesem Monat</h3>
      <p>Lade eine CSV-Datei hoch. Deine gebuchten Ausgaben erscheinen hier automatisch.</p>
      <UButton to="/imports/csv" variant="soft">CSV hochladen</UButton>
    </div>
    <p class="muted text-sm mt-5">
      Kategorien bündeln ähnliche Buchungen. „Nicht kategorisiert“ bedeutet, dass die Buchungen bereits mitgezählt
      werden, aber noch keine Kategorie haben.
    </p>
  </section>
</template>
