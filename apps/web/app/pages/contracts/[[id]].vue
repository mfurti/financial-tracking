<script setup lang="ts">
import { z } from 'zod';
import * as c from '@financial-tracking/contracts';
import { contractKinds } from '../../utils/contract-presentation';
const api = useApi();
const route = useRoute();
const records = ref<z.infer<typeof c.contractSchema>[]>([]);
const reviewing = ref(false);
const summary = ref<z.infer<typeof c.contractSummarySchema> | null>(null);
const suggestions = ref<z.infer<typeof c.contractSuggestionSchema>[]>([]);
const detail = ref<z.infer<typeof c.contractSchema> | null>(null);
const history = ref<z.infer<typeof c.contractPaymentsSchema> | null>(null);
const accounts = ref<c.Account[]>([]);
const categories = ref<c.Category[]>([]);
const candidates = ref<c.Transaction[]>([]);
const searchText = ref('');
const selectedTransaction = ref('');
const dueDate = ref('');
const paymentOpen = ref(false);
const confirmMismatch = ref(false);
const from = ref('');
const to = ref('');
const revision = reactive({ effectiveDate: '', amountEuro: '', intervalMonths: 1 });
const editorOpen = ref(false);
const editing = ref(false);
const suggestion = ref<z.infer<typeof c.contractSuggestionSchema> | null>(null);
const deleteOpen = ref(false);
const unlinkId = ref<string | null>(null);
const unlinkOpen = computed({
  get: /** Scope the unlink confirmation to a selected payment. */ () => unlinkId.value !== null,
  set: /** Cancel without modifying a bank transaction. */ (value: boolean) => {
    if (!value) unlinkId.value = null;
  },
});
const loading = ref(true);
const busy = ref(false);
const error = ref('');
const kinds: Record<string, string> = {
  SUBSCRIPTION: 'Abo',
  RENT: 'Miete',
  INSURANCE: 'Versicherung',
  ENERGY: 'Energie',
  TELECOM: 'Telefon & Internet',
  OTHER: 'Sonstiges',
};
const intervals = [
  { label: 'Monatlich', value: 1 },
  { label: 'Vierteljährlich', value: 3 },
  { label: 'Halbjährlich', value: 6 },
  { label: 'Jährlich', value: 12 },
];
let generation = 0;
let refreshTimer: ReturnType<typeof setInterval> | undefined;
const nextRule = computed(
  /** Planning equivalents use the rule applicable to the next actual due date, never a bank average. */ () =>
    detail.value?.revisions
      .filter(
        /** Later planned changes must not rewrite today's equivalent. */ (rule) =>
          rule.effectiveDate <= (detail.value?.nextDueDate ?? '9999-12-31'),
      )
      .at(-1),
);
const selected = computed(
  /** Show the chosen actual booking beside the expected forecast. */ () =>
    candidates.value.find(/** Match an offered identity only. */ (row) => row.id === selectedTransaction.value),
);
/** Load list or detail with a stale-response guard across route changes. */
async function load() {
  if (reviewing.value) return;
  const current = ++generation,
    id = String(route.params.id ?? '');
  loading.value = true;
  error.value = '';
  try {
    const [all, proposed, target, availableAccounts, availableCategories, costs] = await Promise.all([
      api.request('/contracts', z.array(c.contractSchema)),
      api.request('/contracts/suggestions', z.array(c.contractSuggestionSchema)),
      id ? api.request(`/contracts/${id}`, c.contractSchema) : Promise.resolve(null),
      api.request('/accounts', z.array(c.accountSchema)),
      api.request('/categories', z.array(c.categorySchema)),
      api.request('/contracts/summary', c.contractSummarySchema),
    ]);
    if (current !== generation) return;
    records.value = all;
    summary.value = costs;
    suggestions.value = proposed;
    detail.value = target;
    accounts.value = availableAccounts;
    categories.value = availableCategories;
    if (target) {
      if (!from.value) from.value = target.startDate;
      if (!to.value) {
        const end = new Date(`${target.startDate}T12:00:00Z`);
        end.setUTCFullYear(Math.max(end.getUTCFullYear(), new Date().getUTCFullYear()) + 1);
        to.value = end.toISOString().slice(0, 10);
      }
      const result = await api.request(`/contracts/${target.id}/payments`, c.contractPaymentsSchema, {
        query: { from: from.value, to: to.value },
      });
      if (current !== generation) return;
      history.value = result;
    } else history.value = null;
  } catch (cause) {
    if (current === generation) {
      detail.value = null;
      records.value = [];
      history.value = null;
      error.value = userErrorMessage(cause);
    }
  } finally {
    if (current === generation) loading.value = false;
  }
}
/** Create, confirm a suggestion, or edit metadata only after the user's visible action. */
function openEditor(value?: z.infer<typeof c.contractSuggestionSchema>, edit = false) {
  suggestion.value = value ?? null;
  editing.value = edit;
  editorOpen.value = true;
}
/** Refresh persisted state after confirmation and navigate to the saved contract. */
async function saved(id: string) {
  editorOpen.value = false;
  from.value = '';
  to.value = '';
  await navigateTo(`/contracts/${id}`);
  await load();
}
/** Add a future revision without replacing historical payment rules. */
async function revise() {
  if (!detail.value) return;
  busy.value = true;
  error.value = '';
  try {
    await api.request(`/contracts/${detail.value.id}/revisions`, c.contractSchema, {
      method: 'POST',
      body: c.contractRevisionInputSchema.parse({
        effectiveDate: revision.effectiveDate,
        intervalMonths: revision.intervalMonths,
        amountCents: euroCents(revision.amountEuro),
      }),
    });
    await load();
  } catch (cause) {
    error.value =
      cause instanceof Error && cause.message.startsWith('Betrag als Euro') ? cause.message : userErrorMessage(cause);
  } finally {
    busy.value = false;
  }
}
/** Fetch real candidate transactions with the same eligibility rules used by the server. */
async function search() {
  busy.value = true;
  error.value = '';
  try {
    const response = await api.request('/transactions', c.transactionPageSchema, {
      query: {
        search: searchText.value || undefined,
        status: 'BOOKED',
        direction: 'EXPENSE',
        excludeTransfers: 'true',
        limit: 100,
      },
    });
    candidates.value = response.items.filter(
      /** Existing contract owners must be explicitly unlinked first. */ (row) => !row.contract,
    );
  } catch (cause) {
    error.value = userErrorMessage(cause);
  } finally {
    busy.value = false;
  }
}
/** Link one offered transaction, with separate explicit consent for deviations. */
async function link() {
  if (!detail.value) return;
  busy.value = true;
  error.value = '';
  try {
    await api.request(`/contracts/${detail.value.id}/payments`, c.contractPaymentSchema, {
      method: 'POST',
      body: c.contractPaymentInputSchema.parse({
        transactionId: selectedTransaction.value,
        dueDate: dueDate.value,
        confirmMismatch: confirmMismatch.value,
      }),
    });
    confirmMismatch.value = false;
    selectedTransaction.value = '';
    candidates.value = [];
    await load();
  } catch (cause) {
    error.value = userErrorMessage(cause);
  } finally {
    busy.value = false;
  }
}
/** Preserve actual bookings while removing either a selected link or the whole confirmed contract. */
async function remove(paymentId?: string) {
  if (!detail.value) return;
  busy.value = true;
  error.value = '';
  try {
    await api.request(
      paymentId ? `/contracts/${detail.value.id}/payments/${paymentId}` : `/contracts/${detail.value.id}`,
      z.object({ ok: z.boolean() }),
      { method: 'DELETE', body: paymentId ? undefined : { confirm: true } },
    );
    unlinkId.value = null;
    deleteOpen.value = false;
    if (!paymentId) await navigateTo('/contracts');
    await load();
  } catch (cause) {
    error.value = userErrorMessage(cause);
  } finally {
    busy.value = false;
  }
}
watch(
  /** Route identity changes invalidate the previous detail/history window. */ () => route.params.id,
  /** Reset the range before loading another contract. */ async () => {
    from.value = '';
    to.value = '';
    history.value = null;
    detail.value = null;
    await load();
  },
);
watch(
  [selectedTransaction, dueDate],
  /** Deviation consent never survives changing either side. */ () => {
    confirmMismatch.value = false;
  },
);
onMounted(
  /** Keep next-due ordering current even when the page stays open over midnight. */ async () => {
    await load();
    refreshTimer = setInterval(
      /** Refresh persisted links and the server's Berlin business date. */ () => {
        if (!document.hidden && !busy.value && !editorOpen.value) void load();
      },
      60000,
    );
  },
);
onBeforeUnmount(
  /** Prevent late responses and timers after leaving the page. */ () => {
    generation++;
    if (refreshTimer) clearInterval(refreshTimer);
  },
);
</script>

<template>
  <div class="page-heading">
    <div>
      <h1>{{ detail?.name ?? 'Verträge' }}</h1>
    </div>
    <UButton @click="openEditor()">Vertrag anlegen</UButton>
  </div>
  <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-5" />
  <p v-if="loading" role="status">Verträge werden geladen …</p>
  <UButton v-if="route.params.id" to="/contracts" variant="link" class="mb-4">Alle Verträge</UButton>
  <template v-if="detail">
    <section class="panel mb-5">
      <div class="panel-heading">
        <div>
          <UBadge color="neutral" variant="soft">{{ kinds[detail.kind] }}</UBadge>
          <h2>{{ detail.provider }}</h2>
        </div>
        <UButton color="neutral" variant="outline" @click="openEditor(undefined, true)">Vertrag bearbeiten</UButton>
      </div>
      <p v-if="nextRule" class="muted">
        Planwert: {{ money(plannedEquivalent(nextRule.amountCents, nextRule.intervalMonths, 1)) }} / Monat (gerundet) ·
        {{ money(plannedEquivalent(nextRule.amountCents, nextRule.intervalMonths, 12)) }} / Jahr. Keine tatsächlichen
        Ausgaben.
      </p>
      <p class="balance-value">
        {{ detail.nextAmountCents ? money(detail.nextAmountCents) : 'Keine weitere Fälligkeit' }}
      </p>
      <p>
        {{
          detail.nextDueDate
            ? `Nächste offene Fälligkeit: ${calendarDate(detail.nextDueDate)}`
            : 'Für diesen Vertrag steht keine weitere Zahlung an.'
        }}
      </p>
      <p class="muted">
        Beginn: {{ calendarDate(detail.startDate)
        }}<span v-if="detail.endDate"> · einschließlich Ende: {{ calendarDate(detail.endDate) }}</span
        ><span v-if="detail.cancellationDate"> · Kündigungsdatum: {{ calendarDate(detail.cancellationDate) }}</span>
      </p>
    </section>
    <SectionPanel
      help="Nicht zugeordnet bedeutet: keine eindeutige Buchung verknüpft. Es beweist keinen Zahlungsausfall. Frühere offene Termine blockieren die nächste Fälligkeit nicht."
      title="Zahlungen & Historie"
      icon="contracts"
      class="mb-5"
    >
      <div class="form-row">
        <UFormField label="Historie von"><DatePicker v-model="from" label="Historie von" /></UFormField
        ><UFormField label="Historie bis"><DatePicker v-model="to" label="Historie bis" /></UFormField
        ><UButton :loading="loading" @click="load">Historie aktualisieren</UButton>
      </div>
      <div v-for="occurrence in history?.occurrences ?? []" :key="occurrence.dueDate" class="editable-row">
        <div>
          <strong>{{ calendarDate(occurrence.dueDate) }}</strong>
          <p>{{ money(occurrence.amountCents) }}</p>
        </div>
        <template v-if="occurrence.payment"
          ><UButton size="xs" variant="soft" :to="`/transactions/${occurrence.payment.transactionId}`">{{
            occurrence.payment.source === 'AUTO' ? 'Automatisch zugeordnet' : 'Manuell zugeordnet'
          }}</UButton
          ><UButton color="error" variant="ghost" @click="unlinkId = occurrence.payment!.id"
            >Zuordnung entfernen</UButton
          ></template
        ><template v-else
          ><span class="muted">Nicht zugeordnet</span
          ><UButton
            variant="soft"
            @click="
              dueDate = occurrence.dueDate;
              paymentOpen = true;
            "
            >Buchung zuordnen</UButton
          ></template
        >
      </div>
      <p v-if="history && !history.occurrences.length" class="empty-copy">Keine Fälligkeiten im gewählten Zeitraum.</p>
    </SectionPanel>
    <DisclosurePanel v-model:open="paymentOpen" title="Buchung manuell zuordnen" class="panel mb-5">
      <form class="grid gap-4" @submit.prevent="link">
        <p class="muted">
          Wähle eine tatsächliche Ausgabe. Betrag und Prognose bleiben unverändert. Eine Buchung kann nur zu einem
          Vertrag gehören.
        </p>
        <UFormField label="Vertragsfälligkeit"><DatePicker v-model="dueDate" label="Vertragsfälligkeit" /></UFormField>
        <div class="toolbar">
          <UInput
            v-model="searchText"
            aria-label="Zahlung suchen"
            placeholder="Buchungstext oder Gegenpartei"
          /><UButton variant="soft" :loading="busy" @click="search">Buchungen suchen</UButton>
        </div>
        <UFormField label="Tatsächliche Buchung"
          ><ChoiceSelect
            v-model="selectedTransaction"
            :items="
              candidates.map(
                /** Show exact source values before consent. */ (row) => ({
                  label: `${calendarDate(row.bookingDate)} · ${money(row.amountCents)} · ${row.counterpartyName ?? ''} · ${row.description}`,
                  value: row.id,
                }),
              )
            "
        /></UFormField>
        <p v-if="selected">
          {{ calendarDate(selected.bookingDate) }} · {{ money(selected.amountCents) }} ·
          {{ selected.counterpartyName || 'Keine Gegenpartei' }} · {{ selected.description }}
        </p>
        <UCheckbox
          v-model="confirmMismatch"
          label="Abweichenden Betrag, Datum, Gegenpartei oder Konto geprüft und ausdrücklich bestätigen"
        />
        <UButton type="submit" :disabled="!selectedTransaction || !dueDate" :loading="busy">Zahlung zuordnen</UButton>
      </form>
    </DisclosurePanel>
    <DisclosurePanel title="Zahlungsregeln & zukünftige Änderung" class="panel mb-5"
      ><p class="muted mb-4">
        Änderungen beginnen an einer bereits geplanten zukünftigen Fälligkeit. Historische Regeln und zugeordnete
        Zahlungen bleiben erhalten.
      </p>
      <ul class="mb-5">
        <li v-for="rule in detail.revisions" :key="rule.id">
          Ab {{ calendarDate(rule.effectiveDate) }}: {{ money(rule.amountCents) }} · alle
          {{ rule.intervalMonths }} Monate
        </li>
      </ul>
      <form class="grid gap-4" @submit.prevent="revise">
        <UFormField label="Änderung ab Fälligkeit"
          ><DatePicker v-model="revision.effectiveDate" label="Änderung ab Fälligkeit" /></UFormField
        ><UFormField label="Neuer Betrag in Euro"
          ><UInput v-model="revision.amountEuro" inputmode="decimal" /></UFormField
        ><UFormField label="Neuer Rhythmus"
          ><ChoiceSelect v-model="revision.intervalMonths" :searchable="false" :items="intervals" /></UFormField
        ><UButton type="submit" :loading="busy">Zukünftige Zahlungsregel speichern</UButton>
      </form></DisclosurePanel
    >
    <UButton color="error" variant="ghost" @click="deleteOpen = true">Vertrag löschen</UButton>
  </template>
  <template v-else-if="!route.params.id && !loading">
    <UButton v-if="summary" to="/contracts/analysis" color="neutral" variant="outline" class="fixed-cost-card mb-6">
      <span class="fixed-cost-label"
        ><FinanceIcon name="contracts" /><strong>Durchschnittliche Fixkosten / Monat</strong
        ><UBadge variant="soft">Planwert</UBadge></span
      >
      <strong class="fixed-cost-value amount-expense">{{ money(summary.monthlyCents) }}</strong>
      <span class="muted"
        >{{ summary.count }} {{ summary.count === 1 ? 'Vertrag' : 'Verträge' }} · Analyse öffnen ›</span
      >
    </UButton>
    <SectionPanel title="Deine Verträge" icon="contracts" class="mb-5">
      <p v-if="!records.length" class="empty-copy">
        Noch keine Verträge. Bestätige einen Vorschlag oder lege einen Vertrag an.
      </p>
      <UButton
        v-for="contract in records"
        :key="contract.id"
        :to="`/contracts/${contract.id}`"
        color="neutral"
        variant="link"
        class="contract-list-row"
        ><span class="contract-identity"
          ><span class="contract-kind-icon" :style="{ '--kind-color': contractKinds[contract.kind].color }"
            ><FinanceIcon :name="contractKinds[contract.kind].icon" /></span
          ><span
            ><strong>{{ contract.name }}</strong
            ><small>{{ kinds[contract.kind] }} · {{ contract.provider }}</small></span
          ></span
        ><span
          ><strong :class="contract.active ? 'amount-expense' : 'muted'">{{
            contract.nextAmountCents ? money(contract.nextAmountCents) : '—'
          }}</strong
          ><small>{{
            contract.nextDueDate
              ? calendarDate(contract.nextDueDate)
              : contract.active
                ? 'Keine offene Fälligkeit'
                : 'Beendet'
          }}</small></span
        ></UButton
      >
    </SectionPanel>
    <SectionPanel title="Vertragsvorschläge" icon="contracts"
      ><ContractReview
        :suggestions="suggestions"
        :accounts="accounts"
        :categories="categories"
        @open-change="reviewing = $event"
        @changed="load"
    /></SectionPanel>
  </template>
  <UModal
    v-model:open="editorOpen"
    :title="editing ? 'Vertrag bearbeiten' : suggestion ? 'Vertragsvorschlag bestätigen' : 'Vertrag anlegen'"
    description="Vertragsprognosen erzeugen keine zusätzlichen Buchungen. Bestehende eindeutige Zahlungen werden nach Bestätigung verknüpft."
    ><template #body
      ><ContractForm
        :contract="editing ? detail : null"
        :suggestion="suggestion"
        :accounts="accounts"
        :categories="categories"
        @saved="saved" /></template
  ></UModal>
  <UModal
    v-model:open="deleteOpen"
    title="Vertrag löschen?"
    description="Vertrag und Zahlungszuordnungen werden entfernt. Alle Bankbuchungen, Beträge und manuellen Kategorien bleiben erhalten."
    ><template #footer
      ><UButton color="error" :loading="busy" @click="remove()">Vertrag endgültig löschen</UButton
      ><UButton color="neutral" variant="outline" :disabled="busy" @click="deleteOpen = false"
        >Abbrechen</UButton
      ></template
    ></UModal
  >
  <UModal
    v-model:open="unlinkOpen"
    title="Zahlungszuordnung entfernen?"
    description="Die Buchung bleibt erhalten und wird nicht sofort erneut automatisch zugeordnet. Eine spätere ausdrückliche manuelle Zuordnung ist möglich."
    ><template #footer
      ><UButton color="error" :loading="busy" @click="remove(unlinkId!)">Zuordnung entfernen</UButton
      ><UButton color="neutral" variant="outline" :disabled="busy" @click="unlinkId = null"
        >Abbrechen</UButton
      ></template
    ></UModal
  >
</template>
