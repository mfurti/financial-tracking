<script setup lang="ts">
import { contractCalendarSchema } from '@financial-tracking/contracts';
import type { z } from 'zod';
const props = defineProps<{ contracts: readonly { revisions: readonly { id: string; intervalMonths: number }[] }[] }>();
const api = useApi();
const open = ref(false);
const all = ref(false);
const status = ref<'loading' | 'ready' | 'error'>('loading');
const events = ref<z.infer<typeof contractCalendarSchema>['events']>([]);
const monthly = computed(
  () =>
    new Set(
      props.contracts.flatMap((item) =>
        item.revisions.filter((rule) => rule.intervalMonths === 1).map((rule) => rule.id),
      ),
    ),
);
const days = computed(() =>
  Object.entries(
    Object.groupBy(
      events.value.filter((event) => all.value || !monthly.value.has(event.revisionId)),
      (event) => event.dueDate,
    ),
  ),
);
let generation = 0;
async function load() {
  const request = ++generation;
  status.value = 'loading';
  const from = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
  const end = new Date(`${from.slice(0, 7)}-01T12:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + 12, 0);
  try {
    const report = await api.request('/contracts/calendar', contractCalendarSchema, {
      query: { from, to: end.toISOString().slice(0, 10) },
    });
    if (request !== generation) return;
    events.value = report.events;
    status.value = 'ready';
  } catch {
    if (request === generation) status.value = 'error';
  }
}
watch(open, (visible) => {
  if (visible) {
    all.value = false;
    void load();
  } else generation++;
});
</script>

<template>
  <FinanceDialog v-model:open="open" :title="tr('Vertragskalender')">
    <template #trigger
      ><UButton variant="ghost" color="neutral" :aria-label="tr('Vertragskalender')"
        ><FinanceIcon name="calendar" /></UButton
    ></template>
    <div class="toolbar mb-4">
      <UButton size="sm" :variant="all ? 'ghost' : 'soft'" :aria-pressed="!all" @click="all = false">{{
        tr('Nicht monatlich')
      }}</UButton>
      <UButton size="sm" :variant="all ? 'soft' : 'ghost'" :aria-pressed="all" @click="all = true">{{
        tr('Alle Verträge')
      }}</UButton>
      <UBadge variant="outline" color="neutral">{{ tr('Prognose · nächste 12 Monate') }}</UBadge>
    </div>
    <UButton v-if="status === 'error'" variant="soft" @click="load">{{ tr('Erneut laden') }}</UButton>
    <p v-else-if="status === 'loading'" role="status">{{ tr('Vertragskalender wird geladen …') }}</p>
    <template v-else>
      <p v-if="!days.length" class="empty-copy">{{ tr('Keine Fälligkeiten im gewählten Zeitraum.') }}</p>
      <section v-for="[day, entries] in days" :key="day" class="finance-booking-day">
        <h3>{{ calendarDate(day) }}</h3>
        <NuxtLink
          v-for="entry in entries"
          :key="entry.contractId"
          :to="`/contracts/${entry.contractId}`"
          class="contract-list-row finance-booking-row"
          @click="open = false"
        >
          <span
            >{{ entry.name }}<small>{{ entry.provider }}</small></span
          >
          <strong class="negative" data-financial>{{
            amountsMasked() ? tr('Betrag ausgeblendet') : money(String(-BigInt(entry.plannedCents)))
          }}</strong>
        </NuxtLink>
      </section>
    </template>
    <UButton to="/contracts/calendar" variant="soft" class="mt-4" @click="open = false">{{
      tr('Vollständigen Kalender öffnen')
    }}</UButton>
  </FinanceDialog>
</template>
