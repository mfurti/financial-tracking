<script setup lang="ts">
import { z } from 'zod';
import { analyticsOverviewSchema } from '@financial-tracking/contracts';
const props = withDefaults(defineProps<{ report: z.infer<typeof analyticsOverviewSchema>; chart?: 'bar' | 'ring' }>(), {
  chart: 'bar',
});
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
  { key: 'income' as const, label: tr('Einnahmen'), color: 'var(--positive)' },
  { key: 'expense' as const, label: tr('Ausgaben'), color: 'var(--chart-1)' },
];
/** Format axis ticks only; tooltips and tables read original exact-cent strings. */
function axis(value: number) {
  return new Intl.NumberFormat(displayLocale(), {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}
/** Resolve a tooltip to both exact financial values. */
function values(month: string) {
  return props.report.months.find(
    /** Chart index is the unlocalized calendar identity. */ (row) => row.month === month,
  );
}
/** Resolve either chart tooltip representation to original exact monthly rows, never plotted numbers. */
function tooltipMonths(title: string | undefined, rows: { label: string }[]) {
  return props.chart === 'ring'
    ? rows.map(/** Ring tooltip keys are the canonical month labels. */ (row) => row.label)
    : title
      ? [title]
      : [];
}
/** Drill down using a validated calendar identity and the selected series direction. */
function select(point: unknown) {
  if (props.chart === 'ring') {
    const selected = z.object({ datum: z.object({ month: z.string() }) }).safeParse(point);
    if (selected.success && values(selected.data.datum.month)) emit('select', selected.data.datum.month, 'EXPENSE');
    return;
  }
  const parsed = z
    .object({ datum: z.object({ x: z.string(), category: z.enum(['income', 'expense']) }) })
    .safeParse(point);
  if (parsed.success && values(parsed.data.datum.x))
    emit('select', parsed.data.datum.x, parsed.data.datum.category === 'income' ? 'INCOME' : 'EXPENSE');
}
</script>
<template>
  <UChart
    v-if="!amountsMasked()"
    :type="chart === 'ring' ? 'donut' : 'bar'"
    :data="data"
    index="month"
    :categories="chart === 'ring' ? ['expense'] : categories"
    :colors="
      chart === 'ring'
        ? ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)']
        : undefined
    "
    :format="axis"
    :height="300"
    :aria-label="
      chart === 'ring' ? tr('Ausgabenanteile im Monatsverlauf') : tr('Einnahmen und Ausgaben im Monatsverlauf')
    "
    :aria-description="
      tr(
        'Monatliche exakte Werte und Buchungslinks stehen in der Tabelle. Leere Monate belegen keine vollständige Bankhistorie.',
      )
    "
    @select="select"
  >
    <template #tooltip="{ title, rows }"
      ><template v-for="month in tooltipMonths(title, rows)" :key="month">
        <div v-if="values(month)">
          <strong>{{ monthName(month) }}</strong>
          <p>{{ tr('Einnahmen:') }} {{ money(values(month)!.incomeCents) }}</p>
          <p>{{ tr('Ausgaben:') }} {{ money(values(month)!.expenseCents) }}</p>
          <p>{{ values(month)!.count }} {{ tr('Buchungen') }}</p>
        </div>
      </template></template
    >
  </UChart>
  <p v-else role="status">{{ tr('Diagramm bei ausgeblendeten Beträgen verborgen.') }}</p>
</template>
