<script setup lang="ts">
import { z } from 'zod';
import { contractSchema } from '@financial-tracking/contracts';
const api = useApi();
const upcoming = ref<z.infer<typeof contractSchema>[]>([]);
const busy = ref(true);
const error = ref('');
let timer: ReturnType<typeof setInterval> | undefined;
let version = 0;
let disposed = false;
/** Keep upcoming confirmed contracts separate from the displayed month's actual expenses. */
async function load() {
  if (disposed) return;
  const current = ++version;
  busy.value = true;
  try {
    const rows = await api.request('/contracts', z.array(contractSchema));
    if (current === version) {
      upcoming.value = rows
        .filter(
          /** Hide ended and undated obligations. */ (row) =>
            row.active && row.nextDueDate && row.direction === 'EXPENSE',
        )
        .slice(0, 3);
      error.value = '';
    }
  } catch (cause) {
    if (current === version) {
      upcoming.value = [];
      error.value = userErrorMessage(cause);
    }
  } finally {
    if (current === version) busy.value = false;
  }
}
onMounted(
  /** Refresh the Berlin next-due ordering without requiring a page reload. */ async () => {
    await load();
    if (disposed) return;
    timer = setInterval(
      /** Avoid network requests for a hidden page. */ () => {
        if (!document.hidden) void load();
      },
      60000,
    );
  },
);
onBeforeUnmount(
  /** Release the timer and invalidate late responses. */ () => {
    disposed = true;
    version++;
    if (timer) clearInterval(timer);
  },
);
</script>
<template>
  <SectionPanel
    :title="tr('Nächste Zahlungen')"
    icon="contracts"
    compact
    :help="
      tr(
        'Nächste heutige oder zukünftige offene Fälligkeit je Vertrag. Prognosen werden nicht zu den tatsächlichen Ausgaben addiert.',
      )
    "
  >
    <template #actions
      ><span class="subtle-tag">{{ tr('Planwerte') }}</span></template
    >
    <p v-if="busy" role="status" class="empty-copy">{{ tr('Zahlungen werden geladen …') }}</p>
    <UAlert v-if="error" role="alert" color="error" :description="error" class="my-3" /><UButton
      v-if="error"
      variant="soft"
      :disabled="busy"
      @click="load"
      >{{ tr('Erneut laden') }}</UButton
    >
    <p v-if="!upcoming.length && !error && !busy" class="empty-copy">
      {{ tr('Keine anstehenden Vertragszahlungen.') }}
    </p>
    <UButton
      v-for="contract in busy ? [] : upcoming"
      :key="contract.id"
      :to="`/contracts/${contract.id}`"
      variant="link"
      color="neutral"
      class="contract-list-row"
      ><span
        ><strong>{{ contract.name }}</strong
        ><small>{{ calendarDate(contract.nextDueDate!) }}</small></span
      ><strong>{{ money(contract.nextAmountCents!) }}</strong></UButton
    >
    <div class="section-action">
      <UButton to="/contracts" variant="soft">{{ tr('Alle Verträge') }}</UButton>
    </div>
  </SectionPanel>
</template>
