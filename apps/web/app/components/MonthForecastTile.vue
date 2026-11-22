<script setup lang="ts">
import { contractCalendarSchema } from '@financial-tracking/contracts';
import type { z } from 'zod';
import { forecastBudgetRests, type BudgetList } from '../utils/category-budget';

const props = defineProps<{
  month: string;
  groupId: string;
  bookedNetCents: string;
  budgetList: BudgetList;
  refreshBudgets: () => Promise<void>;
}>();
const api = useApi();
const open = ref(false);
const calendarState = ref<'loading' | 'ready' | 'error'>('loading');
const state = computed(() => {
  if (calendarState.value === 'error' || (!props.groupId && props.budgetList.state === 'error')) return 'error';
  if (calendarState.value === 'loading') return 'loading';
  return props.groupId ? 'ready' : props.budgetList.state;
});
const tile = useTemplateRef('forecastTile');
const outstanding = ref<z.infer<typeof contractCalendarSchema>['events']>([]);
const expenses = computed(() => outstanding.value.filter((event) => event.direction === 'EXPENSE'));
const groups = computed(() => {
  const income = outstanding.value.filter((event) => event.direction === 'INCOME');
  return [
    {
      title: tr('Erwartete Einnahmen'),
      events: income,
      amount: income.reduce((total, event) => total + BigInt(event.plannedCents), 0n),
      tone: 'positive',
    },
    {
      title: tr('Offene Zahlungen'),
      events: expenses.value,
      amount: expenses.value.reduce((total, event) => total - BigInt(event.plannedCents), 0n),
      tone: 'negative',
    },
  ];
});
const budgetRests = computed(() =>
  !props.groupId && props.budgetList.state === 'ready'
    ? forecastBudgetRests(props.budgetList.budgets, expenses.value)
    : [],
);
const budgetReserve = computed(() => budgetRests.value.reduce((sum, budget) => sum + budget.additional, 0n));
const forecast = computed(() =>
  groups.value.reduce((net, group) => net + group.amount, BigInt(props.bookedNetCents) - budgetReserve.value),
);

/** Read the same month and scope as the booked balance, independently of other overview sections. */
async function load() {
  calendarState.value = 'loading';
  try {
    const calendar = await api.request('/contracts/calendar', contractCalendarSchema, {
      query: { ...monthRangeQuery(props.month), groupId: props.groupId || undefined },
    });
    // The monthly balance already accounts for posted activity. Pending and unlinked occurrences remain planned.
    outstanding.value = calendar.events.filter((event) => event.payment?.status !== 'BOOKED');
    calendarState.value = 'ready';
  } catch {
    calendarState.value = 'error';
  }
}

function retry() {
  if (calendarState.value === 'error') void load();
  if (!props.groupId && props.budgetList.state === 'error') void props.refreshBudgets();
}

/** The tile opens the modal programmatically, so explicitly restore keyboard focus after dismissal. */
function restoreFocus() {
  tile.value?.$el.querySelector('button')?.focus({ preventScroll: true });
}

onMounted(load);
</script>

<template>
  <FinanceTile
    ref="forecastTile"
    :label="tr('Bis Monatsende frei')"
    :state="state"
    :context="tr('Prognose')"
    error-text="Prognose konnte nicht geladen werden."
    variant="stat"
    financial
    actionable
    @activate="open = true"
    @retry="retry"
  >
    <template #value>
      <span :class="forecast < 0n ? 'negative' : 'positive'">{{ money(forecast) }}</span>
    </template>
  </FinanceTile>
  <FinanceDialog
    v-model:open="open"
    :title="tr('Bis Monatsende frei')"
    :description="monthName(month)"
    @after:leave="restoreFocus"
  >
    <dl class="forecast-calculation">
      <div class="forecast-line">
        <dt>{{ tr('Gebuchte Monatsbilanz') }}</dt>
        <dd data-financial>{{ money(bookedNetCents) }}</dd>
      </div>
      <div v-for="group in groups" :key="group.title" class="forecast-line">
        <dt>{{ group.title }}</dt>
        <dd :class="group.tone" data-financial>
          {{ !amountsMasked() && group.amount > 0n ? '+' : '' }}{{ money(group.amount) }}
        </dd>
      </div>
      <div v-if="budgetRests.length" class="forecast-line">
        <dt>{{ tr('Zusätzlich eingeplante Budgets') }}</dt>
        <dd :class="{ negative: budgetReserve > 0n }" data-financial>{{ money(-budgetReserve) }}</dd>
      </div>
      <div class="forecast-line forecast-total">
        <dt>{{ tr('Voraussichtlich frei') }}</dt>
        <dd :class="forecast < 0n ? 'negative' : 'positive'" data-financial>{{ money(forecast) }}</dd>
      </div>
    </dl>
    <p class="forecast-note muted">
      {{ tr('Planwerte aus bestätigten Verträgen. Offen bis zur Zuordnung einer gebuchten Zahlung.') }}
    </p>
    <p v-if="groupId" class="forecast-note muted">
      {{ tr('Kategorie-Budgets fließen in die Prognose für „Alle Konten“ ein.') }}
    </p>
    <section v-if="budgetRests.length" class="forecast-details">
      <h3>{{ tr('Budgetreste nach Kategorie') }}</h3>
      <ul>
        <li v-for="budget in budgetRests" :key="budget.id" class="forecast-line">
          <span>
            {{ budget.categoryName }}
            <small v-if="budget.covered > 0n && !amountsMasked()" class="muted" data-financial>
              {{ tr('Davon {0} bereits in offenen Zahlungen', [money(budget.covered)]) }}
            </small>
          </span>
          <strong data-financial>{{ money(budget.remaining) }}</strong>
        </li>
      </ul>
    </section>
    <section v-for="group in groups" :key="group.title" class="forecast-details">
      <h3>{{ group.title }}</h3>
      <p v-if="!group.events.length" class="muted">{{ tr('Keine offenen Fälligkeiten.') }}</p>
      <ul v-else>
        <li v-for="event in group.events" :key="`${event.contractId}:${event.dueDate}`" class="forecast-line">
          <span>
            {{ event.name }}
            <small class="muted">{{ calendarDate(event.dueDate) }}</small>
          </span>
          <strong :class="group.tone" data-financial>
            {{ money(event.direction === 'INCOME' ? event.plannedCents : -BigInt(event.plannedCents)) }}
          </strong>
        </li>
      </ul>
    </section>
  </FinanceDialog>
</template>

<style scoped>
.forecast-calculation {
  display: grid;
  gap: 8px;
}
.forecast-line {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px 16px;
  flex-wrap: wrap;
  overflow-wrap: anywhere;
}
.forecast-line [data-financial] {
  font-variant-numeric: tabular-nums;
}
.forecast-total {
  border-top: 1px solid var(--finance-line);
  padding-top: 8px;
  font-weight: 700;
}
.forecast-note {
  margin-top: 10px;
  font-size: 12px;
}
.forecast-details {
  margin-top: 18px;
}
.forecast-details h3 {
  margin-bottom: 4px;
  font-weight: 700;
}
.forecast-details li {
  padding: 8px 0;
  border-bottom: 1px solid var(--finance-line);
}
.forecast-details small {
  display: block;
}
</style>
