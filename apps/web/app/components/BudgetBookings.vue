<script setup lang="ts">
import { transactionPageSchema, type Transaction } from '@financial-tracking/contracts';
import { userErrorMessage } from '../utils/api-error';

const props = defineProps<{ month: string; categoryId: string }>();
const api = useApi();
const bookings = ref<Transaction[]>([]);
const cursor = ref<string | null>(null);
const busy = ref(true);
const error = ref('');

/** Use the same month and booked-expense filters as the budget total. */
async function load() {
  busy.value = true;
  error.value = '';
  try {
    const page = await api.request('/transactions', transactionPageSchema, {
      query: {
        ...monthRangeQuery(props.month),
        categoryId: props.categoryId,
        status: 'BOOKED',
        direction: 'EXPENSE',
        excludeTransfers: 'true',
        cursor: cursor.value ?? undefined,
      },
    });
    bookings.value = [...bookings.value, ...page.items];
    cursor.value = page.nextCursor;
  } catch (cause) {
    error.value = userErrorMessage(cause);
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section>
    <h3 class="mb-1 font-semibold">{{ tr('Buchungen') }}</h3>
    <p v-if="busy && !bookings.length" role="status" class="muted">{{ tr('Wird geladen …') }}</p>
    <p v-else-if="!bookings.length && !error" class="muted">{{ tr('Keine Ausgaben in diesem Budget.') }}</p>
    <ul v-if="bookings.length">
      <li v-for="booking in bookings" :key="booking.id" class="budget-booking">
        <span>
          <strong>{{ booking.counterpartyName?.trim() || booking.description }}</strong>
          <small class="muted block">
            {{ calendarDate(booking.bookingDate)
            }}<template v-if="booking.categoryAmountCents !== undefined"> · {{ tr('Teilbetrag') }}</template>
          </small>
        </span>
        <strong class="negative" data-financial>{{ money(booking.categoryAmountCents ?? booking.amountCents) }}</strong>
      </li>
    </ul>
    <UAlert v-if="error" role="alert" color="error" :description="error" class="mt-2" />
    <UButton v-if="cursor || error" variant="soft" class="mt-3" :loading="busy" @click="load">
      {{ tr(error ? 'Erneut versuchen' : 'Weitere Buchungen') }}
    </UButton>
  </section>
</template>

<style scoped>
.budget-booking {
  display: flex;
  justify-content: space-between;
  gap: 8px 16px;
  flex-wrap: wrap;
  padding: 8px 0;
  overflow-wrap: anywhere;
  border-bottom: 1px solid var(--finance-line);
}
</style>
