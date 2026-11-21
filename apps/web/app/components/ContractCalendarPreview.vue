<script setup lang="ts">
import { contractCalendarSchema } from '@financial-tracking/contracts';
import type { z } from 'zod';
import { contractKinds, contractIntervalOptions } from '../utils/contract-presentation';
const props = defineProps<{ contracts: readonly { revisions: readonly { id: string; intervalMonths: number }[] }[] }>();
const api = useApi();
const open = ref(false);
const all = ref(false);
const status = ref<'loading' | 'ready' | 'error'>('loading');
const events = ref<z.infer<typeof contractCalendarSchema>['events']>([]);
const intervals = computed(
  () =>
    new Map(
      props.contracts.flatMap((contract) => contract.revisions.map((rule) => [rule.id, rule.intervalMonths] as const)),
    ),
);
const days = computed(() =>
  Object.entries(
    Object.groupBy(
      events.value.filter((event) => all.value || intervals.value.get(event.revisionId) !== 1),
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
  <FinanceDialog v-model:open="open" :title="tr('Vertragskalender')" panel="calendar">
    <template #trigger
      ><UButton variant="ghost" color="neutral" :aria-label="tr('Vertragskalender')"
        ><FinanceIcon name="calendar" /></UButton
    ></template>
    <div class="toolbar finance-calendar-controls">
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
        <h3>
          {{
            new Intl.DateTimeFormat(displayLocale(), { dateStyle: 'long', timeZone: 'UTC' }).format(
              new Date(day + 'T12:00:00Z'),
            )
          }}
        </h3>
        <NuxtLink
          v-for="entry in entries"
          :key="entry.contractId"
          :to="`/contracts/${entry.contractId}`"
          class="contract-list-row finance-booking-row finance-calendar-entry"
          @click="open = false"
        >
          <span class="contract-kind-icon" :style="{ '--kind-color': contractKinds[entry.kind].color }"
            ><FinanceIcon :name="contractKinds[entry.kind].icon"
          /></span>
          <span
            ><strong>{{ entry.name }}</strong
            ><small>{{
              contractIntervalOptions.find((option) => option.value === intervals.get(entry.revisionId))?.label ??
              entry.provider
            }}</small></span
          >
          <strong :class="entry.direction === 'INCOME' ? 'positive' : 'negative'" data-financial>{{
            amountsMasked()
              ? tr('Betrag ausgeblendet')
              : money(entry.direction === 'INCOME' ? entry.plannedCents : String(-BigInt(entry.plannedCents)))
          }}</strong>
        </NuxtLink>
      </section>
    </template>
    <UButton to="/contracts/calendar" variant="ghost" size="sm" class="mt-4" @click="open = false">{{
      tr('Vollständigen Kalender öffnen')
    }}</UButton>
  </FinanceDialog>
</template>
