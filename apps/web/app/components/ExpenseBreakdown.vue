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
/** Link a segment to the same month's real booked expense records. */
function categoryLink(id: string | null) {
  return `/transactions?${new URLSearchParams({ ...monthRangeQuery(props.report.month), ...(id ? { categoryId: id } : { uncategorized: 'true' }), direction: 'EXPENSE', status: 'BOOKED', excludeTransfers: 'true' })}`;
}
</script>

<template>
  <SectionPanel
    :title="title"
    icon="categories"
    class="spending-panel"
    help="Noch nicht kategorisierte Buchungen sind bereits in den Ausgaben enthalten."
  >
    <template #actions
      ><span class="subtle-tag">{{ monthName(report.month) }}</span></template
    >
    <div v-if="groups.length" class="spending-overview">
      <ExpenseChart
        :groups="groups"
        :total-cents="report.expenseCents"
        :label="`${money(report.expenseCents)} Ausgaben in ${groups.length} Kategorien`"
        @select="navigateTo(categoryLink($event))"
      />
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
  </SectionPanel>
</template>
