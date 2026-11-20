<script setup lang="ts">
import { z } from 'zod';
const props = withDefaults(
  defineProps<{
    groups: { categoryId: string | null; name: string; expenseCents: string }[];
    totalCents: string;
    label: string;
    centerLabel?: string;
    description?: string;
    chart?: 'bar' | 'ring';
  }>(),
  {
    centerLabel: 'Ausgegeben',
    description: 'Exakte Beträge und Links zu den Buchungen stehen neben dem Diagramm.',
    chart: 'ring',
  },
);
const emit = defineEmits<{ select: [id: string | null] }>();
const data = computed(
  /** Floating geometry is display-only; every shown amount uses its original integer-cent string. */ () =>
    props.groups.map(
      /** Preserve each exact value and identity next to its plot coordinate. */ (row) => ({
        ...row,
        value: Number(row.expenseCents) / 100,
      }),
    ),
);
const colors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
];
/** Accept chart selection only when it resolves to a real rendered group. */
function select(point: unknown) {
  const parsed = z.object({ datum: z.object({ categoryId: z.string().nullable() }) }).safeParse(point);
  if (
    parsed.success &&
    props.groups.some(
      /** Ignore stale points after a filter change. */ (row) => row.categoryId === parsed.data.datum.categoryId,
    )
  )
    emit('select', parsed.data.datum.categoryId);
}
/** Resolve the accessible tooltip label to its exact source amount. */
function exact(label: string) {
  return money(
    props.groups.find(/** Category names are unique persisted labels. */ (row) => row.name === label)?.expenseCents ??
      '0',
  );
}
</script>
<template>
  <UChart
    v-if="!amountsMasked()"
    :type="chart === 'ring' ? 'donut' : 'bar'"
    :data="data"
    index="name"
    :categories="['value']"
    :colors="colors"
    :height="260"
    :legend="false"
    :aria-label="label"
    :aria-description="tr(description)"
    @select="select"
  >
    <template v-if="chart === 'ring'" #center
      ><div class="chart-center">
        <small>{{ tr(centerLabel) }}</small
        ><strong>{{ money(totalCents) }}</strong>
      </div></template
    >
    <template #tooltip="{ title, rows }"
      ><div v-for="row in rows" :key="row.label">
        <strong>{{ chart === 'bar' ? title : row.label }}</strong>
        <p>{{ exact(chart === 'bar' && title ? title : row.label) }}</p>
      </div></template
    >
  </UChart>
  <p v-else role="status">{{ tr('Diagramm bei ausgeblendeten Beträgen verborgen.') }}</p>
</template>
