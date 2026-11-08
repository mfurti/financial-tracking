<script setup lang="ts">
import { z } from 'zod';
import { contractSchema } from '@financial-tracking/contracts';
const api = useApi();
const upcoming = ref<z.infer<typeof contractSchema>[]>([]);
const error = ref('');
let timer: ReturnType<typeof setInterval> | undefined;
let version = 0;
/** Keep upcoming confirmed contracts separate from the displayed month's actual expenses. */
async function load() {
  const current = ++version;
  try {
    const rows = await api.request('/contracts', z.array(contractSchema));
    if (current === version) {
      upcoming.value = rows
        .filter(/** Hide ended and undated obligations. */ (row) => row.active && row.nextDueDate)
        .slice(0, 5);
      error.value = '';
    }
  } catch (cause) {
    if (current === version) {
      upcoming.value = [];
      error.value = userErrorMessage(cause);
    }
  }
}
onMounted(
  /** Refresh the Berlin next-due ordering without requiring a page reload. */ async () => {
    await load();
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
    version++;
    if (timer) clearInterval(timer);
  },
);
</script>
<template>
  <section class="panel mt-6">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">ALS NÄCHSTES</p>
        <h2>Anstehende Vertragszahlungen</h2>
      </div>
      <UButton to="/contracts" variant="link">Alle Verträge</UButton>
    </div>
    <p class="muted">
      Nächste heutige oder zukünftige offene Fälligkeit je Vertrag. Prognosen werden nicht zu den tatsächlichen Ausgaben
      addiert.
    </p>
    <UAlert v-if="error" role="alert" color="error" :description="error" class="my-3" /><UButton
      v-if="error"
      variant="soft"
      @click="load"
      >Erneut laden</UButton
    >
    <p v-if="!upcoming.length && !error" class="empty-copy">
      Keine anstehenden bestätigten Vertragszahlungen. Prüfe wiederkehrende Zahlungen unter Verträge.
    </p>
    <UButton
      v-for="contract in upcoming"
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
  </section>
</template>
