<script setup lang="ts">
import type { Monthly } from '@financial-tracking/contracts';
const props = withDefaults(
  defineProps<{ report: Monthly; title?: string; compact?: boolean; chart?: 'bar' | 'ring' }>(),
  {
    title: 'Ausgaben nach Kategorien',
    compact: false,
    chart: 'ring',
  },
);
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
    :title="tr(title)"
    icon="categories"
    class="spending-panel"
    :class="{ 'spending-panel--compact': compact }"
    :compact="compact"
    :help="tr('Noch nicht kategorisierte Buchungen sind bereits in den Ausgaben enthalten.')"
  >
    <template #actions
      ><span class="subtle-tag">{{ monthName(report.month) }}</span></template
    >
    <div v-if="groups.length" class="spending-overview">
      <ExpenseChart
        v-if="!compact"
        :chart="chart"
        :groups="groups"
        :total-cents="report.expenseCents"
        :label="tr('{0} Ausgaben in {1} Kategorien', [money(report.expenseCents), groups.length])"
        @select="navigateTo(categoryLink($event))"
      />
      <div class="spending-legend">
        <NuxtLink
          v-for="(group, index) in groups"
          :key="group.categoryId ?? 'uncategorized'"
          :to="categoryLink(group.categoryId)"
          class="spending-row"
          ><span
            v-if="!compact"
            class="category-dot"
            :style="{ background: `var(--chart-${(index % 6) + 1})` }"
            aria-hidden="true" />
          <div>
            <strong>{{ group.name }}</strong
            ><small v-if="!compact"
              >{{ financialPercentage((group.expenseShare ?? 0) * 100, { maximumFractionDigits: 1 }) }}
              {{ tr('% der Ausgaben') }}</small
            >
          </div>
          <strong data-financial
            ><template v-if="!amountsMasked()">{{ money(group.expenseCents) }}</template
            ><template v-else>{{ tr('Betrag ausgeblendet') }}</template></strong
          >
          <span v-if="compact && !amountsMasked()" class="overview-category-track" aria-hidden="true"
            ><i
              :style="{
                width: `${Math.min(1, Math.max(0, group.expenseShare ?? 0)) * 100}%`,
                background: `var(--chart-${(index % 6) + 1})`,
              }" /></span
        ></NuxtLink>
      </div>
    </div>
    <div v-else class="empty-state">
      <FinanceIcon name="categories" />
      <h3>{{ tr('Noch keine Ausgaben in diesem Monat') }}</h3>
      <p>{{ tr('Lade eine CSV-Datei hoch. Deine gebuchten Ausgaben erscheinen hier automatisch.') }}</p>
      <UButton to="/imports/csv" variant="soft">{{ tr('CSV hochladen') }}</UButton>
    </div>
  </SectionPanel>
</template>
