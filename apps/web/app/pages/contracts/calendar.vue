<script setup lang="ts">
import { z } from 'zod';
import * as c from '@financial-tracking/contracts';
const api = useApi();
const route = useRoute();
const router = useRouter();
const month = ref(
  typeof route.query.month === 'string'
    ? route.query.month
    : new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date()).slice(0, 7),
);
const accountId = ref(typeof route.query.accountId === 'string' ? route.query.accountId : '');
const accounts = ref<c.Account[]>([]);
const report = ref<z.infer<typeof c.contractCalendarSchema> | null>(null);
const loading = ref(true);
const error = ref('');
const selectedDay = ref('');
let generation = 0;
let disposed = false;
const days = computed(
  /** Lay out the requested calendar using UTC day numbers, independently of the browser timezone. */ () => {
    if (!report.value) return [];
    const first = new Date(`${report.value.from}T12:00:00Z`);
    const offset = (first.getUTCDay() + 6) % 7;
    return Array.from(
      { length: offset + Number(report.value.to.slice(-2)) },
      /** Empty leading cells carry no date or invented obligation. */ (_, index) =>
        index < offset ? null : `${month.value}-${String(index - offset + 1).padStart(2, '0')}`,
    );
  },
);
const events = computed(
  /** An optional selected day narrows only the visible list, never the month total. */ () =>
    report.value?.events.filter(
      /** Keep all events visible until a real day is explicitly selected. */ (event) =>
        !selectedDay.value || event.dueDate === selectedDay.value,
    ) ?? [],
);
/** Count actual schedule occurrences for a date without manufacturing paid/unpaid states. */
function dueCount(date: string) {
  return (
    report.value?.events.filter(/** Compare the validated calendar identity. */ (event) => event.dueDate === date)
      .length ?? 0
  );
}
/** Read one bounded month and account scope; failed or superseded reads never retain old financial totals. */
async function load() {
  const request = ++generation;
  loading.value = true;
  report.value = null;
  error.value = '';
  selectedDay.value = '';
  try {
    const query = c.contractCalendarQuerySchema.parse({
      ...monthRangeQuery(month.value),
      accountId: accountId.value || undefined,
    });
    const [calendar, choices] = await Promise.all([
      api.request('/contracts/calendar', c.contractCalendarSchema, { query }),
      api.request('/accounts', z.array(c.accountSchema)),
    ]);
    if (disposed || request !== generation) return;
    report.value = calendar;
    accounts.value = choices;
    await router.replace({ query: { month: month.value, ...(accountId.value ? { accountId: accountId.value } : {}) } });
  } catch (cause) {
    if (!disposed && request === generation) error.value = userErrorMessage(cause);
  } finally {
    if (!disposed && request === generation) loading.value = false;
  }
}
/** Move only a valid month identity through the same scoped loading path. */
async function shiftMonth(offset: number) {
  const date = new Date(`${month.value}-01T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return;
  date.setUTCMonth(date.getUTCMonth() + offset);
  month.value = date.toISOString().slice(0, 7);
  await load();
}
watch(
  /** Restore the precise month/account bookmark when browser history changes it. */ () => [
    route.query.month,
    route.query.accountId,
  ],
  /** Ignore our own completed query update, but reload a different history scope. */ ([nextMonth, nextAccount]) => {
    const next = typeof nextMonth === 'string' ? nextMonth : month.value;
    const account = typeof nextAccount === 'string' ? nextAccount : '';
    if (month.value === next && accountId.value === account) return;
    month.value = next;
    accountId.value = account;
    void load();
  },
);
onMounted(load);
onBeforeUnmount(
  /** Revoke late calendar/account reads after leaving this page. */ () => {
    disposed = true;
    generation++;
  },
);
</script>

<template>
  <div class="page-heading">
    <h1>Vertragskalender</h1>
    <UButton to="/contracts" variant="soft">Alle Verträge</UButton>
  </div>
  <div class="toolbar calendar-toolbar mb-5">
    <UButton variant="ghost" aria-label="Vorheriger Monat" @click="shiftMonth(-1)">‹</UButton>
    <MonthPicker v-model="month" @change="load" />
    <UButton variant="ghost" aria-label="Nächster Monat" @click="shiftMonth(1)">›</UButton>
    <div class="calendar-scope">
      <ChoiceSelect
        v-model="accountId"
        aria-label="Kalenderkonto"
        :items="[
          { label: 'Alle Konten', value: '' },
          ...accounts.map(
            /** Bind filters to real identities, including inactive historical accounts. */ (account) => ({
              label: account.name,
              value: account.id,
            }),
          ),
        ]"
        @update:model-value="load"
      />
    </div>
    <UButton variant="soft" :loading="loading" @click="load">Aktualisieren</UButton>
  </div>
  <p class="muted mb-5">
    Fälligkeiten sind Planwerte aus bestätigten Verträgen. Fehlende Zuordnung beweist keinen Zahlungsausfall.
    Tatsächliche Buchungen und ihr Buchungsdatum bleiben getrennt. Ein Kontofilter berücksichtigt nur ausdrücklich
    diesem Konto zugeordnete Verträge.
  </p>
  <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-4" />
  <UButton v-if="error && !loading" variant="soft" @click="load">Erneut laden</UButton>
  <p v-if="loading" role="status">Vertragskalender wird geladen …</p>
  <template v-if="report && !loading">
    <FinanceTile
      label="Geplante Fälligkeiten im Monat"
      :value="money(report.totalPlannedCents)"
      :context="`${report.events.length} Fälligkeiten · ${monthName(month)} · Planwert`"
      variant="insight"
      financial
      class="mb-6"
    />
    <div class="contract-calendar-layout">
      <SectionPanel :title="monthName(month)" icon="calendar" compact>
        <div class="contract-calendar-grid" role="group" aria-label="Kalendertage">
          <span v-for="day in ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']" :key="day" class="muted calendar-weekday">{{
            day
          }}</span>
          <template v-for="(date, index) in days" :key="date ?? `blank-${index}`">
            <button
              v-if="date"
              type="button"
              class="calendar-day"
              :class="{ 'calendar-day--due': dueCount(date) > 0 }"
              :aria-label="`${calendarDate(date)} · ${dueCount(date)} Fälligkeiten`"
              :aria-pressed="selectedDay === date"
              @click="selectedDay = selectedDay === date ? '' : date"
            >
              <span>{{ Number(date.slice(-2)) }}</span
              ><small v-if="dueCount(date)">{{ dueCount(date) }}</small></button
            ><span v-else aria-hidden="true" />
          </template>
        </div>
        <UButton v-if="selectedDay" variant="ghost" class="mt-3" @click="selectedDay = ''"
          >Alle Fälligkeiten zeigen</UButton
        >
      </SectionPanel>
      <SectionPanel
        :title="selectedDay ? `Fälligkeiten am ${calendarDate(selectedDay)}` : 'Fälligkeiten im Monat'"
        icon="contracts"
        compact
      >
        <p v-if="!events.length" class="empty-copy">Keine Fälligkeiten im gewählten Zeitraum.</p>
        <article
          v-for="event in events"
          :key="`${event.contractId}:${event.dueDate}`"
          class="calendar-event"
          data-calendar-event
        >
          <NuxtLink :to="`/contracts/${event.contractId}`"
            ><strong>{{ event.name }}</strong></NuxtLink
          >
          <p class="muted">{{ calendarDate(event.dueDate) }} · {{ event.provider }}</p>
          <p>
            Planwert: <strong data-financial>{{ money(event.plannedCents) }}</strong>
          </p>
          <NuxtLink v-if="event.payment" :to="`/transactions/${event.payment.transactionId}`" class="text-link"
            >Zugeordnete Buchung: <span data-financial>{{ money(event.payment.amountCents) }}</span> ·
            {{ calendarDate(event.payment.bookingDate) }}</NuxtLink
          >
          <p v-else class="muted">Keine Buchung zugeordnet</p>
        </article>
      </SectionPanel>
    </div>
  </template>
</template>

<style scoped>
.calendar-scope {
  width: min(320px, 100%);
}
.calendar-toolbar > button {
  min-width: 44px;
  min-height: 44px;
}
.contract-calendar-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
  gap: 24px;
  align-items: start;
}
.contract-calendar-layout > * {
  min-width: 0;
}
.contract-calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}
.calendar-weekday {
  text-align: center;
  padding: 8px 0;
  font-size: 12px;
}
.calendar-day {
  min-width: 0;
  min-height: 44px;
  display: grid;
  place-content: center;
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
}
.calendar-day--due {
  background: var(--accent-soft);
  color: var(--accent);
}
.calendar-day[aria-pressed='true'] {
  border-color: var(--accent);
}
.calendar-day small {
  font-size: 10px;
}
.calendar-event {
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
  overflow-wrap: anywhere;
}
.calendar-event:last-child {
  border: 0;
}
@media (max-width: 1100px) {
  .contract-calendar-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
}
</style>
