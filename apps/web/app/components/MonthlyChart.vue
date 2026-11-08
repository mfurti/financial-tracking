<script setup lang="ts">
import { z } from 'zod';
import { analyticsOverviewSchema } from '@financial-tracking/contracts';
const props = defineProps<{ report: z.infer<typeof analyticsOverviewSchema> }>();
const emit = defineEmits<{ select: [month: string, direction: 'INCOME' | 'EXPENSE'] }>();
const data = computed(
  /** Plot coordinates are approximate display-only Euro numbers; financial labels remain exact strings. */ () =>
    props.report.months.map(
      /** Preserve visible calendar gaps in the same sequence. */ (row) => ({
        month: row.month,
        income: Number(row.incomeCents) / 100,
        expense: Number(row.expenseCents) / 100,
      }),
    ),
);
const categories = [
  { key: 'income' as const, label: 'Einnahmen', color: 'var(--positive)' },
  { key: 'expense' as const, label: 'Ausgaben', color: 'var(--chart-1)' },
];
/** Format axis ticks only; tooltips and tables read original exact-cent strings. */
function axis(value: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}
/** Resolve a tooltip to both exact financial values. */
function values(month: string) {
  return props.report.months.find(
    /** Chart index is the unlocalized calendar identity. */ (row) => row.month === month,
  );
}
/** Drill down using a validated calendar identity and the selected series direction. */
function select(point: unknown) {
  const parsed = z
    .object({ datum: z.object({ x: z.string(), category: z.enum(['income', 'expense']) }) })
    .safeParse(point);
  if (parsed.success && values(parsed.data.datum.x))
    emit('select', parsed.data.datum.x, parsed.data.datum.category === 'income' ? 'INCOME' : 'EXPENSE');
}
</script>
<template>
  <UChart
    type="bar"
    :data="data"
    index="month"
    :categories="categories"
    :format="axis"
    :height="300"
    aria-label="Einnahmen und Ausgaben im Monatsverlauf"
    aria-description="Monatliche exakte Werte und Buchungslinks stehen in der Tabelle. Leere Monate belegen keine vollständige Bankhistorie."
    @select="select"
  >
    <template #tooltip="{ title }"
      ><div v-if="title && values(title)">
        <strong>{{ monthName(title) }}</strong>
        <p>Einnahmen: {{ money(values(title)!.incomeCents) }}</p>
        <p>Ausgaben: {{ money(values(title)!.expenseCents) }}</p>
        <p>{{ values(title)!.count }} Buchungen</p>
      </div></template
    >
  </UChart>
</template>
