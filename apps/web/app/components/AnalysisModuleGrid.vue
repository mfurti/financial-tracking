<script setup lang="ts">
import type { z } from 'zod';
import type { analyticsOverviewSchema } from '@financial-tracking/contracts';
import type { AnalysisModuleId } from '../utils/workspace-preferences';
const props = defineProps<{
  report: z.infer<typeof analyticsOverviewSchema>;
  merchantCount: number;
  available: readonly AnalysisModuleId[];
  merchantAmounts?: readonly string[];
  monthsHref?: string;
  categoriesHref?: string;
  merchantsHref?: string;
}>();
const emit = defineEmits<{ activate: [id: 'months' | 'categories' | 'merchants'] }>();
const { preferences } = useWorkspacePreferences();
const slots = useSlots();
const visible = computed(
  /** Render only selected delivered content in device order; future modules require actual owning slots. */ () =>
    preferences.value.analysisModules.filter(
      /** A declared preference alone must never fabricate a financial tile. */ (id) =>
        props.available.includes(id) && (['months', 'categories', 'merchants'].includes(id) || Boolean(slots[id])),
    ),
);
</script>

<template>
  <div class="finance-feature-grid">
    <div
      v-for="id in visible"
      :key="id"
      :data-analysis-module="id"
      :data-analysis-scope="['history', 'reserve', 'contracts'].includes(id) ? 'workspace' : 'report'"
    >
      <slot :name="id">
        <FinanceTile
          v-if="id === 'months'"
          :label="tr('Deine letzten Monate')"
          :value="tr('{0} Monate', [report.months.length])"
          :context="tr('{0} abgeschlossene Monate mit Buchungen', [report.average.monthCount])"
          :to="monthsHref"
          :actionable="!monthsHref"
          @activate="emit('activate', 'months')"
          ><template #graphic
            ><FinanceMiniChart kind="bars" :values="report.months.map((month) => month.expenseCents)" /></template
        ></FinanceTile>
        <FinanceTile
          v-else-if="id === 'categories'"
          :label="tr('Verteilung aller Ausgaben')"
          :value="money(report.expenseCents)"
          financial
          :context="tr('Gebuchte Ausgaben im gewählten Zeitraum')"
          :to="categoriesHref"
          :actionable="!categoriesHref"
          @activate="emit('activate', 'categories')"
          ><template #graphic
            ><FinanceMiniChart
              kind="ring"
              :values="report.categories.map((category) => category.expenseCents)" /></template
        ></FinanceTile>
        <FinanceTile
          v-else-if="id === 'merchants'"
          :label="tr('Händlerausgaben')"
          :value="money(report.expenseCents)"
          financial
          :context="tr('{0} Händler · inklusive unbekannter Gegenparteien', [merchantCount])"
          :to="merchantsHref"
          :actionable="!merchantsHref"
          @activate="emit('activate', 'merchants')"
          ><template #graphic><FinanceMiniChart kind="ring" :values="merchantAmounts ?? []" /></template
        ></FinanceTile>
      </slot>
    </div>
  </div>
  <p v-if="!visible.length" class="empty-copy">
    {{ tr('Keine Analysen ausgewählt. Über „Anpassen“ kannst du sie wieder einblenden.') }}
  </p>
</template>
