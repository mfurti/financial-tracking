<script setup lang="ts">
import { z } from 'zod';
import * as c from '@financial-tracking/contracts';
import { contractKinds, contractIntervalOptions } from '../../utils/contract-presentation';
const api = useApi();
const route = useRoute();
const records = ref<z.infer<typeof c.contractSchema>[]>([]);
const reviewing = ref(false);
const contractActionsOpen = ref(false);
const directionFilter = ref<'EXPENSE' | 'INCOME' | 'ALL'>('EXPENSE');
const directions = [
  { value: 'EXPENSE', label: 'Ausgaben' },
  { value: 'INCOME', label: 'Einnahmen' },
  { value: 'ALL', label: 'Alle' },
] as const;
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
const editorSaving = ref(false);
const editing = ref(false);
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
const contractGroups = computed(
  /** Group the already next-due-ordered records by their effective payment rhythm, preserving order within each group. */ () =>
    contractIntervalOptions
      .map(
        /** Label only rhythms supported by the existing recurrence contract. */ (option) => ({
          label: option.label,
          interval: option.value,
          contracts: records.value.filter(
            /** Keep direction and effective rhythm in the same visible scope. */ (contract) =>
              (directionFilter.value === 'ALL' || contract.direction === directionFilter.value) &&
              contract.revisions
                .filter(
                  /** Keep later price/rhythm changes out of earlier dues. */ (rule) =>
                    rule.effectiveDate <= (contract.nextDueDate ?? '9999-12-31'),
                )
                .at(-1)?.intervalMonths === option.value,
          ),
        }),
      )
      .filter(/** Empty rhythms do not become invented obligations. */ (group) => group.contracts.length),
);
const selected = computed(
  /** Show the chosen actual booking beside the expected forecast. */ () =>
    candidates.value.find(/** Match an offered identity only. */ (row) => row.id === selectedTransaction.value),
);
/** Load list or detail with a stale-response guard across route changes. */
async function load() {
  if (reviewing.value || editorOpen.value) return;
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
      summary.value = null;
      suggestions.value = [];
      error.value = userErrorMessage(cause);
    }
  } finally {
    if (current === generation) loading.value = false;
  }
}
/** Open manual creation or metadata editing; suggestions are handled by ContractReview. */
function openEditor(edit = false) {
  contractActionsOpen.value = false;
  editorSaving.value = false;
  editing.value = edit;
  editorOpen.value = true;
}
/** Refresh persisted state after confirmation and navigate to the saved contract. */
async function saved(id: string) {
  editorSaving.value = false;
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
      cause instanceof Error && cause.message.startsWith(tr('Betrag als Euro'))
        ? cause.message
        : userErrorMessage(cause);
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
        direction: detail.value?.direction ?? 'EXPENSE',
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
  <div class="page-heading finance-contract-heading">
    <div>
      <h1>{{ detail?.name ?? tr('Verträge') }}</h1>
    </div>
    <div class="toolbar">
      <ContractCalendarPreview :contracts="records" />
      <UPopover v-if="!route.params.id" v-model:open="contractActionsOpen">
        <UButton variant="ghost" color="neutral" :aria-label="tr('Weitere Aktionen')"
          ><FinanceIcon name="filter"
        /></UButton>
        <template #content>
          <div class="finance-overview-actions">
            <UButton :disabled="loading || reviewing" variant="soft" @click="openEditor()">{{
              tr('Vertrag anlegen')
            }}</UButton>
            <UButton to="/contracts/analysis" variant="ghost">{{ tr('Geplante Vertragskosten') }}</UButton>
          </div>
        </template>
      </UPopover>
    </div>
  </div>
  <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-5" />
  <UButton v-if="error && !loading" variant="soft" @click="load">{{ tr('Erneut laden') }}</UButton>
  <p v-if="loading" role="status">{{ tr('Verträge werden geladen …') }}</p>
  <UButton v-if="route.params.id" to="/contracts" variant="link" class="mb-4">{{ tr('Alle Verträge') }}</UButton>
  <template v-if="detail && !loading && !error">
    <SectionPanel :title="detail.provider" icon="contracts" compact class="mb-5">
      <template #actions
        ><UButton color="neutral" variant="soft" @click="openEditor(true)">{{
          tr('Vertrag bearbeiten')
        }}</UButton></template
      >
      <UBadge color="neutral" variant="soft">{{ contractKinds[detail.kind].label }}</UBadge>
      <p v-if="nextRule" class="muted">
        {{ tr('Planwert:') }} {{ money(plannedEquivalent(nextRule.amountCents, nextRule.intervalMonths, 1)) }}
        {{ tr('/ Monat (gerundet) ·') }}
        {{ money(plannedEquivalent(nextRule.amountCents, nextRule.intervalMonths, 12)) }}
        {{ tr('/ Jahr. Keine tatsächlichen Ausgaben.') }}
      </p>
      <FinanceTile
        variant="insight"
        :label="tr('Nächster Planbetrag')"
        :value="detail.nextAmountCents ? money(detail.nextAmountCents) : tr('Keine weitere Fälligkeit')"
        financial
        class="my-4"
      />
      <p>
        {{
          detail.nextDueDate
            ? tr('Nächste offene Fälligkeit: {0}', [calendarDate(detail.nextDueDate)])
            : tr('Für diesen Vertrag steht keine weitere Zahlung an.')
        }}
      </p>
      <p class="muted">
        {{ tr('Beginn:') }} {{ calendarDate(detail.startDate)
        }}<span v-if="detail.endDate"> {{ tr('· einschließlich Ende:') }} {{ calendarDate(detail.endDate) }}</span
        ><span v-if="detail.cancellationDate">
          {{ tr('· Kündigungsdatum:') }} {{ calendarDate(detail.cancellationDate) }}</span
        >
      </p>
    </SectionPanel>
    <SectionPanel
      :help="
        tr(
          'Nicht zugeordnet bedeutet: keine eindeutige Buchung verknüpft. Es beweist keinen Zahlungsausfall. Frühere offene Termine blockieren die nächste Fälligkeit nicht.',
        )
      "
      :title="tr('Zahlungen & Historie')"
      icon="contracts"
      class="mb-5"
    >
      <div class="form-row">
        <UFormField :label="tr('Historie von')"><DatePicker v-model="from" :label="tr('Historie von')" /></UFormField
        ><UFormField :label="tr('Historie bis')"><DatePicker v-model="to" :label="tr('Historie bis')" /></UFormField
        ><UButton :loading="loading" @click="load">{{ tr('Historie aktualisieren') }}</UButton>
      </div>
      <div v-for="occurrence in history?.occurrences ?? []" :key="occurrence.dueDate" class="editable-row">
        <div>
          <strong>{{ calendarDate(occurrence.dueDate) }}</strong>
          <p data-financial>
            <template v-if="!amountsMasked()">{{ money(occurrence.amountCents) }} {{ tr('· Planwert') }}</template
            ><template v-else>{{ tr('Betrag ausgeblendet') }}</template>
          </p>
        </div>
        <template v-if="occurrence.payment"
          ><UButton size="xs" variant="soft" :to="`/transactions/${occurrence.payment.transactionId}`">{{
            occurrence.payment.source === 'AUTO' ? tr('Automatisch zugeordnet') : tr('Manuell zugeordnet')
          }}</UButton
          ><UButton color="error" variant="ghost" @click="unlinkId = occurrence.payment!.id">{{
            tr('Zuordnung entfernen')
          }}</UButton></template
        ><template v-else
          ><span class="muted">{{ tr('Nicht zugeordnet') }}</span
          ><UButton
            variant="soft"
            @click="
              dueDate = occurrence.dueDate;
              paymentOpen = true;
            "
            >{{ tr('Buchung zuordnen') }}</UButton
          ></template
        >
      </div>
      <p v-if="history && !history.occurrences.length" class="empty-copy">
        {{ tr('Keine Fälligkeiten im gewählten Zeitraum.') }}
      </p>
    </SectionPanel>
    <DisclosurePanel v-model:open="paymentOpen" :title="tr('Buchung manuell zuordnen')" class="panel mb-5">
      <form class="grid gap-4" @submit.prevent="link">
        <p class="muted">
          {{
            tr(
              'Wähle eine tatsächliche Ausgabe. Betrag und Prognose bleiben unverändert. Eine Buchung kann nur zu einem Vertrag gehören.',
            )
          }}
        </p>
        <UFormField :label="tr('Vertragsfälligkeit')"
          ><DatePicker v-model="dueDate" :label="tr('Vertragsfälligkeit')"
        /></UFormField>
        <div class="toolbar">
          <UInput
            v-model="searchText"
            :aria-label="tr('Zahlung suchen')"
            :placeholder="tr('Buchungstext oder Gegenpartei')"
          /><UButton variant="soft" :loading="busy" @click="search">{{ tr('Buchungen suchen') }}</UButton>
        </div>
        <UFormField :label="tr('Tatsächliche Buchung')"
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
          {{ selected.counterpartyName || tr('Keine Gegenpartei') }} · {{ selected.description }}
        </p>
        <UCheckbox
          v-model="confirmMismatch"
          :label="tr('Abweichenden Betrag, Datum, Gegenpartei oder Konto geprüft und ausdrücklich bestätigen')"
        />
        <UButton type="submit" :disabled="!selectedTransaction || !dueDate" :loading="busy">{{
          tr('Zahlung zuordnen')
        }}</UButton>
      </form>
    </DisclosurePanel>
    <DisclosurePanel :title="tr('Zahlungsregeln & zukünftige Änderung')" class="panel mb-5"
      ><p class="muted mb-4">
        {{
          tr(
            'Änderungen beginnen an einer bereits geplanten zukünftigen Fälligkeit. Historische Regeln und zugeordnete Zahlungen bleiben erhalten.',
          )
        }}
      </p>
      <ul class="mb-5">
        <li v-for="rule in detail.revisions" :key="rule.id">
          {{ tr('Ab') }} {{ calendarDate(rule.effectiveDate) }}: {{ money(rule.amountCents) }} {{ tr('· alle') }}
          {{ rule.intervalMonths }} {{ tr('Monate') }}
        </li>
      </ul>
      <form class="grid gap-4" @submit.prevent="revise">
        <UFormField :label="tr('Änderung ab Fälligkeit')"
          ><DatePicker v-model="revision.effectiveDate" :label="tr('Änderung ab Fälligkeit')" /></UFormField
        ><UFormField :label="tr('Neuer Betrag in Euro')"
          ><UInput
            v-model="revision.amountEuro"
            :type="amountsMasked() ? 'password' : 'text'"
            inputmode="decimal" /></UFormField
        ><UFormField :label="tr('Neuer Rhythmus')"
          ><ChoiceSelect
            v-model="revision.intervalMonths"
            :searchable="false"
            :items="contractIntervalOptions" /></UFormField
        ><UButton type="submit" :loading="busy">{{ tr('Zukünftige Zahlungsregel speichern') }}</UButton>
      </form></DisclosurePanel
    >
    <UButton color="error" variant="ghost" @click="deleteOpen = true">{{ tr('Vertrag löschen') }}</UButton>
  </template>
  <template v-else-if="!route.params.id && !loading && !error">
    <div class="toolbar finance-contract-directions" role="group" :aria-label="tr('Zahlungsrichtung')">
      <UButton
        v-for="option in directions"
        :key="option.value"
        :aria-pressed="directionFilter === option.value"
        color="neutral"
        :variant="directionFilter === option.value ? 'soft' : 'ghost'"
        @click="directionFilter = option.value"
        >{{ tr(option.label) }}</UButton
      >
    </div>
    <div v-if="summary" class="finance-summary-grid finance-contract-summary">
      <FinanceTile to="/contracts/analysis" variant="stat" :label="tr('Ausgaben / Monat')" financial>
        <template #value
          ><span class="negative">{{ money(summary.monthlyCents) }}</span></template
        >
      </FinanceTile>
      <FinanceTile variant="stat" :label="tr('Einnahmen / Monat')" financial>
        <template #value
          ><span class="positive">{{ money(summary.monthlyIncomeCents) }}</span></template
        >
      </FinanceTile>
      <FinanceTile
        variant="stat"
        :label="tr('Geplant übrig')"
        :value="money(summary.monthlyRemainderCents ?? String(-BigInt(summary.monthlyCents)))"
        financial
      />
    </div>
    <div class="toolbar mb-5">
      <UBadge variant="outline" color="neutral">{{ tr('Planwerte') }}</UBadge>
      <UButton to="/contracts/analysis" variant="ghost" size="sm">{{ tr('Geplante Vertragskosten') }} ↗</UButton>
    </div>
    <SectionPanel v-if="!contractGroups.length" :title="tr('Deine Verträge')" class="mb-5" compact>
      <p class="empty-copy">
        {{ tr(records.length ? 'Keine Verträge in dieser Zahlungsrichtung.' : 'Noch keine Verträge.') }}
      </p>
      <UButton :disabled="loading || reviewing" variant="soft" @click="openEditor()">{{
        tr('Vertrag anlegen')
      }}</UButton>
    </SectionPanel>
    <SectionPanel
      v-for="group in contractGroups"
      :key="group.interval"
      :title="`${group.label} · ${group.contracts.length}`"
      icon="contracts"
      class="contract-rhythm mb-5"
      compact
    >
      <UButton
        v-for="contract in group.contracts"
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
            ><small>{{ contractKinds[contract.kind].label }} · {{ contract.provider }}</small></span
          ></span
        ><span
          ><strong
            data-financial
            :class="contract.active ? (contract.direction === 'INCOME' ? 'positive' : 'negative') : 'muted'"
            ><template v-if="!amountsMasked()">{{
              contract.nextAmountCents
                ? money(
                    contract.direction === 'INCOME'
                      ? contract.nextAmountCents
                      : String(-BigInt(contract.nextAmountCents)),
                  )
                : '—'
            }}</template
            ><template v-else>{{ tr('Betrag ausgeblendet') }}</template></strong
          ><small>{{
            contract.nextDueDate
              ? calendarDate(contract.nextDueDate)
              : contract.active
                ? tr('Keine offene Fälligkeit')
                : tr('Beendet')
          }}</small></span
        ></UButton
      >
    </SectionPanel>
    <SectionPanel :title="tr('Vertragsvorschläge')" icon="contracts"
      ><ContractReview
        :suggestions="suggestions"
        :accounts="accounts"
        :categories="categories"
        @open-change="reviewing = $event"
        @changed="load"
    /></SectionPanel>
  </template>
  <FinanceDialog
    v-model:open="editorOpen"
    :title="editing ? tr('Vertrag bearbeiten') : tr('Vertrag anlegen')"
    :description="
      tr(
        'Vertragsprognosen erzeugen keine zusätzlichen Buchungen. Bestehende eindeutige Zahlungen werden nach Bestätigung verknüpft.',
      )
    "
    :dismissible="!editorSaving"
    :close="!editorSaving"
    ><ContractForm
      :contract="editing ? detail : null"
      :accounts="accounts"
      :categories="categories"
      @busy="editorSaving = $event"
      @saved="saved"
    />
  </FinanceDialog>
  <FinanceDialog
    v-model:open="deleteOpen"
    :title="tr('Vertrag löschen?')"
    :description="
      tr(
        'Vertrag und Zahlungszuordnungen werden entfernt. Alle Bankbuchungen, Beträge und manuellen Kategorien bleiben erhalten.',
      )
    "
    :dismissible="!busy"
    ><template #footer
      ><UButton color="error" :loading="busy" @click="remove()">{{ tr('Vertrag endgültig löschen') }}</UButton
      ><UButton color="neutral" variant="outline" :disabled="busy" @click="deleteOpen = false">{{
        tr('Abbrechen')
      }}</UButton></template
    ></FinanceDialog
  >
  <FinanceDialog
    v-model:open="unlinkOpen"
    :title="tr('Zahlungszuordnung entfernen?')"
    :description="
      tr(
        'Die Buchung bleibt erhalten und wird nicht sofort erneut automatisch zugeordnet. Eine spätere ausdrückliche manuelle Zuordnung ist möglich.',
      )
    "
    :dismissible="!busy"
    ><template #footer
      ><UButton color="error" :loading="busy" @click="remove(unlinkId!)">{{ tr('Zuordnung entfernen') }}</UButton
      ><UButton color="neutral" variant="outline" :disabled="busy" @click="unlinkId = null">{{
        tr('Abbrechen')
      }}</UButton></template
    ></FinanceDialog
  >
</template>

<style scoped>
.contract-rhythm {
  max-width: 1050px;
}
.contract-list-row {
  min-height: 72px;
  padding: 12px 0;
  gap: 16px;
}
.contract-list-row strong {
  overflow-wrap: anywhere;
}
</style>
