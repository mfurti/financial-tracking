<script setup lang="ts">
import type { z } from 'zod';
import type { analyticsOverviewSchema } from '@financial-tracking/contracts';
import type { AnalysisModuleId } from '../utils/workspace-preferences';
const props = defineProps<{
  report: z.infer<typeof analyticsOverviewSchema>;
  merchantCount: number;
  available: readonly AnalysisModuleId[];
  monthsHref: string;
  categoriesHref: string;
  merchantsHref: string;
}>();
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
          label="Deine letzten Monate"
          :value="`${report.months.length} Monate`"
          :context="`${report.average.monthCount} abgeschlossene Monate mit Buchungen`"
          :to="monthsHref"
          ><template #graphic><FinanceIcon name="calendar" /></template
        ></FinanceTile>
        <FinanceTile
          v-else-if="id === 'categories'"
          label="Verteilung aller Ausgaben"
          :value="money(report.expenseCents)"
          financial
          context="Gebuchte Ausgaben im gewählten Zeitraum"
          :to="categoriesHref"
          ><template #graphic><FinanceIcon name="categories" /></template
        ></FinanceTile>
        <FinanceTile
          v-else-if="id === 'merchants'"
          label="Händlerausgaben"
          :value="money(report.expenseCents)"
          financial
          :context="`${merchantCount} Händler · inklusive unbekannter Gegenparteien`"
          :to="merchantsHref"
          ><template #graphic><FinanceIcon name="transactions" /></template
        ></FinanceTile>
      </slot>
    </div>
  </div>
  <p v-if="!visible.length" class="empty-copy">
    Keine Analysen ausgewählt. Über „Anpassen“ kannst du sie wieder einblenden.
  </p>
</template>
