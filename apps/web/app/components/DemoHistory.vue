<script setup lang="ts">
const { state } = useDemoPortfolio();
const rows = computed(
  /** Newest recorded simulation values appear first without inventing bank history. */ () =>
    [...state.value.history].reverse(),
);
const chart = computed(
  /** Normalize exact cents into bounded SVG coordinates only after integer arithmetic. */ () => {
    const values = state.value.history.map(
      /** Read validated integer-cent strings. */ (item) => BigInt(item.totalCents),
    );
    if (!values.length) return { points: '', min: 0n, max: 0n };
    let min = values[0]!,
      max = values[0]!;
    for (const value of values) {
      if (value < min) min = value;
      if (value > max) max = value;
    }
    const range = max - min;
    const points = values
      .map(
        /** Convert only bounded plot ratios, never money, to display coordinates. */ (value, index) =>
          `${10 + (index * 480) / Math.max(1, values.length - 1)},${range === 0n ? 60 : 110 - Number(((value - min) * 100n) / range)}`,
      )
      .join(' ');
    return { points, min, max };
  },
);
/** Display recorded simulation times in the project's Berlin timezone. */
function time(at: string) {
  return new Intl.DateTimeFormat(displayLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Berlin',
  }).format(new Date(at));
}
</script>
<template>
  <SectionPanel
    :title="tr('Aufgezeichneter Demo-Verlauf')"
    :help="
      tr('Nur gespeicherte Simulationswerte bei geändertem Gesamtwert, maximal 48. Keine historische Bankbewertung.')
    "
  >
    <p>
      {{
        tr('Aufgezeichnete Simulationswerte · maximal 48. Nur ein geänderter Gesamtwert erzeugt einen weiteren Punkt.')
      }}
    </p>
    <p v-if="!rows.length">{{ tr('Noch keine aufgezeichneten Simulationswerte.') }}</p>
    <template v-else>
      <p>
        {{ tr('Zuletzt aufgezeichnet:') }}
        <strong data-financial
          ><template v-if="!amountsMasked()">{{ money(rows[0]!.totalCents) }}</template
          ><template v-else>{{ tr('Betrag ausgeblendet') }}</template></strong
        >
      </p>
      <svg
        v-if="rows.length > 1 && !amountsMasked()"
        class="demo-history-chart"
        viewBox="0 0 500 120"
        role="img"
        :aria-label="tr('Verlauf aufgezeichneter Simulationswerte; genaue Werte in der folgenden Liste')"
      >
        <polyline
          :points="chart.points"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          vector-effect="non-scaling-stroke"
        />
      </svg>
      <p v-if="rows.length > 1" data-financial>
        <template v-if="!amountsMasked()"
          >{{ tr('Spanne:') }} {{ money(chart.min) }} {{ tr('bis') }} {{ money(chart.max) }}</template
        ><template v-else>{{ tr('Betrag ausgeblendet') }}</template>
      </p>
      <details>
        <summary>{{ rows.length }} {{ tr('aufgezeichnete Simulationswerte anzeigen') }}</summary>
        <ol>
          <li v-for="record in rows" :key="record.id" class="demo-history-row" :data-demo-history="record.id">
            <time :datetime="record.at">{{ time(record.at) }}</time
            ><strong data-financial
              ><template v-if="!amountsMasked()">{{ money(record.totalCents) }}</template
              ><template v-else>{{ tr('Betrag ausgeblendet') }}</template></strong
            >
          </li>
        </ol>
      </details>
    </template>
  </SectionPanel>
</template>
<style scoped>
.demo-history-chart {
  width: 100%;
  height: 150px;
  color: var(--green);
  margin-block: 16px;
}
.demo-history-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
  padding-block: 12px;
  border-bottom: 1px solid var(--line);
}
.demo-history-row:last-child {
  border-bottom: 0;
}
.demo-history-row strong {
  overflow-wrap: anywhere;
}
summary {
  margin-top: 12px;
  cursor: pointer;
}
</style>
