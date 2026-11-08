<script setup lang="ts">
import { z } from 'zod';
import { userErrorMessage } from '../utils/api-error';
import {
  assignmentPreviewSchema,
  assignmentPreviewInputSchema,
  assignmentInputSchema,
  assignmentResultSchema,
  type Account,
  type Category,
} from '@financial-tracking/contracts';

const props = defineProps<{ transactionIds: string[]; accounts: Account[]; categories: Category[] }>();
const emit = defineEmits<{ complete: [result: z.infer<typeof assignmentResultSchema>] }>();
const api = useApi();
const accountId = ref('');
const preview = ref<z.infer<typeof assignmentPreviewSchema> | null>(null);
const error = ref('');
const busy = ref(false);
const requestId = ref<string | null>(null);
const choices = reactive<
  Record<
    string,
    {
      action: '' | 'BANK' | 'CSV' | 'SEPARATE' | 'SKIP';
      candidateId: string;
      categoryChoice: '' | 'BANK' | 'CSV';
      classificationChoice: '' | 'BANK' | 'CSV';
    }
  >
>({});
const targets = computed(
  /** Do not offer inactive import targets. */ () =>
    props.accounts.filter(
      /** Existing data remains visible elsewhere, but new assignment needs an active account. */ (account) =>
        account.isActive,
    ),
);

/** Resolve a manual category label for the side-by-side comparison. */
function category(id: string | null) {
  return (
    props.categories.find(/** Keep IDs out of normal labels. */ (entry) => entry.id === id)?.name ??
    'Nicht kategorisiert'
  );
}
/** Read the currently selected offered candidate without guessing one. */
function candidate(id: string) {
  return preview.value?.items
    .find(/** Locate the reviewed source. */ (item) => item.incoming.transaction.id === id)
    ?.candidates.find(
      /** Only IDs supplied by the server are shown. */ (entry) => entry.transaction.id === choices[id]?.candidateId,
    );
}
/** Both nonempty categories require an explicit conflict decision. */
function categoryConflict(id: string) {
  const source = preview.value?.items.find(
    /** Read the selected source annotation. */ (item) => item.incoming.transaction.id === id,
  )?.incoming.transaction;
  const target = candidate(id)?.transaction;
  return (
    !!source &&
    !!target &&
    (source.categoryOrigin === 'MANUAL' || !!source.categoryId) &&
    (target.categoryOrigin === 'MANUAL' || !!target.categoryId) &&
    source.categoryId !== target.categoryId
  );
}
/** Describe bank/CSV/legacy observations without claiming an inferred source as verified. */
function sources(value: z.infer<typeof assignmentPreviewSchema>['items'][number]['incoming']) {
  return (
    [...new Set(value.references.map(/** Deduplicate repeated observations for readability. */ (ref) => ref.source))]
      .map(
        /** Legacy provenance is explicitly unknown. */ (source) =>
          source === 'FINTS' ? 'Bank' : source === 'CSV' ? 'CSV' : 'Bestand',
      )
      .join(', ') || 'Bestand'
  );
}
/** Revoke a preview when selection or target changes. */
function reset() {
  preview.value = null;
  requestId.value = null;
  error.value = '';
  for (const id of Object.keys(choices)) delete choices[id];
}
watch(/** Observe stable selection content rather than array identity. */ () => props.transactionIds.join(','), reset);
/** Fetch current versions and let the user decide before any write. */
async function compare() {
  busy.value = true;
  error.value = '';
  try {
    const input = assignmentPreviewInputSchema.parse({
      accountId: accountId.value,
      transactionIds: props.transactionIds,
    });
    const response = await api.request('/transactions/assignment-preview', assignmentPreviewSchema, {
      method: 'POST',
      body: input,
    });
    if (input.accountId !== accountId.value || input.transactionIds.join(',') !== props.transactionIds.join(','))
      return;
    preview.value = response;
    requestId.value = crypto.randomUUID();
    for (const item of preview.value.items)
      choices[item.incoming.transaction.id] = {
        action: item.candidates.length ? '' : 'SEPARATE',
        candidateId: '',
        categoryChoice: '',
        classificationChoice: '',
      };
  } catch (cause) {
    error.value = userErrorMessage(cause);
  } finally {
    busy.value = false;
  }
}
/** Keep the same confirmation identity on retry; the server rejects conflicting replays. */
async function confirm() {
  if (!preview.value || !requestId.value) return;
  busy.value = true;
  error.value = '';
  try {
    const body = assignmentInputSchema.parse({
      requestId: requestId.value,
      accountId: preview.value.accountId,
      decisions: preview.value.items.map(
        /** Bind each explicit decision to the reviewed complete comparison. */ (item) => {
          const id = item.incoming.transaction.id,
            choice = choices[id]!;
          return {
            transactionId: id,
            token: item.token,
            action: choice.action,
            candidateId: choice.candidateId || undefined,
            categoryChoice: choice.categoryChoice || undefined,
            classificationChoice: choice.classificationChoice || undefined,
          };
        },
      ),
    });
    const result = await api.request('/transactions/assign', assignmentResultSchema, { method: 'POST', body });
    reset();
    emit('complete', result);
  } catch (cause) {
    error.value = userErrorMessage(cause);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section v-if="transactionIds.length" class="panel mb-5" aria-label="Kontozuordnung">
    <h2>Ohne-Konto-Buchungen zuordnen</h2>
    <p class="muted">
      {{ transactionIds.length }} ausgewählt. Erst vergleichen, dann zuordnen oder bewusst zusammenführen.
    </p>
    <UAlert v-if="error" color="error" :description="error" class="mb-4" />
    <p v-if="!targets.length">
      Lege für die spätere Zuordnung zuerst ein Zielkonto an. Deine CSV ist bereits auswertbar.
    </p>
    <div v-else class="toolbar mb-4">
      <label
        >Zielkonto für Zuordnung<ChoiceSelect
          v-model="accountId"
          :disabled="busy"
          aria-label="Zielkonto für Zuordnung"
          :searchable="true"
          :items="[
            { label: `Konto wählen`, value: '' },
            ...targets.map(
              /** Build a persisted choice. */ (account) => ({ label: `${account.name}`, value: account.id }),
            ),
          ]"
          @update:model-value="reset"
      /></label>
      <UButton :disabled="!accountId || transactionIds.length > 100" :loading="busy" variant="soft" @click="compare"
        >Zuordnung vergleichen</UButton
      >
    </div>
    <form v-if="preview" @submit.prevent="confirm">
      <article v-for="item in preview.items" :key="item.incoming.transaction.id" class="review-card">
        <h3>{{ item.incoming.transaction.description }}</h3>
        <p>
          CSV · Ohne Konto · {{ calendarDate(item.incoming.transaction.bookingDate) }} ·
          {{ money(item.incoming.transaction.amountCents) }}
        </p>
        <p>
          Kategorie: {{ category(item.incoming.transaction.categoryId) }} ·
          {{ item.incoming.transaction.status === 'BOOKED' ? 'Gebucht' : 'Vorgemerkt'
          }}<span v-if="item.incoming.transaction.isTransfer"> · Umbuchung</span>
        </p>
        <p>
          Gegenpartei: {{ item.incoming.transaction.counterpartyName ?? 'Nicht geliefert' }} ·
          {{ item.incoming.transaction.counterpartyIban ?? 'Keine Gegenkonto-IBAN' }}
        </p>
        <p v-if="item.hasMoreCandidates" class="muted">
          Weitere mögliche Treffer vorhanden. Es wird niemals automatisch zusammengeführt.
        </p>
        <template v-if="item.candidates.length">
          <label
            >Zielbuchung für {{ item.incoming.transaction.description
            }}<ChoiceSelect
              v-model="choices[item.incoming.transaction.id]!.candidateId"
              :required="['BANK', 'CSV'].includes(choices[item.incoming.transaction.id]!.action)"
              :searchable="true"
              :items="[
                { label: `Treffer wählen`, value: '' },
                ...item.candidates.map(
                  /** Build a persisted choice. */ (entry) => ({
                    label: `${calendarDate(entry.transaction.bookingDate)} · ${entry.transaction.description} · ${money(entry.transaction.amountCents)}`,
                    value: entry.transaction.id,
                  }),
                ),
              ]"
          /></label>
          <div v-if="candidate(item.incoming.transaction.id)" class="mt-4">
            <p>
              {{ candidate(item.incoming.transaction.id)!.transaction.description }} ·
              {{ calendarDate(candidate(item.incoming.transaction.id)!.transaction.bookingDate) }}
            </p>
            <p>
              Ziel: {{ candidate(item.incoming.transaction.id)!.accountName }} ·
              {{ sources(candidate(item.incoming.transaction.id)!) }} ·
              {{ money(candidate(item.incoming.transaction.id)!.transaction.amountCents) }}
            </p>
            <p>
              Gegenpartei:
              {{ candidate(item.incoming.transaction.id)!.transaction.counterpartyName ?? 'Nicht geliefert' }} ·
              {{ candidate(item.incoming.transaction.id)!.transaction.counterpartyIban ?? 'Keine Gegenkonto-IBAN' }}
            </p>
            <p>
              Kategorie: {{ category(candidate(item.incoming.transaction.id)!.transaction.categoryId) }} ·
              {{ candidate(item.incoming.transaction.id)!.transaction.status === 'BOOKED' ? 'Gebucht' : 'Vorgemerkt'
              }}<span v-if="candidate(item.incoming.transaction.id)!.transaction.isTransfer"> · Umbuchung</span>
            </p>
            <DisclosurePanel title="Quellreferenzen vergleichen"
              ><p v-for="(reference, index) in item.incoming.references" :key="`csv-${index}`" class="reference-copy">
                CSV · {{ reference.type }}: {{ reference.value }}
              </p>
              <p
                v-for="(reference, index) in candidate(item.incoming.transaction.id)!.references"
                :key="`target-${index}`"
                class="reference-copy"
              >
                {{ reference.source }} · {{ reference.type }}: {{ reference.value }}
              </p></DisclosurePanel
            >
          </div>
        </template>
        <p v-else>Keine mögliche Überschneidung gefunden.</p>
        <label
          >Entscheidung für {{ item.incoming.transaction.description
          }}<ChoiceSelect
            v-model="choices[item.incoming.transaction.id]!.action"
            required
            :searchable="false"
            :items="[
              { label: `Entscheidung wählen`, value: '' },
              ...(item.candidates.length
                ? [{ label: `Bank-/Zieldaten übernehmen und zusammenführen`, value: 'BANK' }]
                : []),
              ...(item.candidates.length ? [{ label: `CSV-Daten übernehmen und zusammenführen`, value: 'CSV' }] : []),
              { label: `Separat behalten und zuordnen`, value: 'SEPARATE' },
              { label: `Zuordnung überspringen`, value: 'SKIP' },
            ]"
        /></label>
        <label
          v-if="
            ['BANK', 'CSV'].includes(choices[item.incoming.transaction.id]!.action) &&
            categoryConflict(item.incoming.transaction.id)
          "
          >Abweichende manuelle Kategorie<ChoiceSelect
            v-model="choices[item.incoming.transaction.id]!.categoryChoice"
            required
            :searchable="false"
            :items="[
              { label: `Kategorie ausdrücklich wählen`, value: '' },
              { label: `CSV-Kategorie: ${category(item.incoming.transaction.categoryId)}`, value: 'CSV' },
              {
                label: `Zielkategorie: ${category(candidate(item.incoming.transaction.id)!.transaction.categoryId)}`,
                value: 'BANK',
              },
            ]"
        /></label>
        <UFormField
          v-if="
            ['BANK', 'CSV'].includes(choices[item.incoming.transaction.id]!.action) &&
            item.incoming.transaction.classification &&
            candidate(item.incoming.transaction.id)?.transaction.classification &&
            item.incoming.transaction.classification !==
              candidate(item.incoming.transaction.id)?.transaction.classification
          "
          label="Abweichende Fix/Variabel-Kennzeichnung"
          help="Beide Buchungen wurden unterschiedlich eingeordnet. Wähle, welche Entscheidung erhalten bleibt."
        >
          <ChoiceSelect
            v-model="choices[item.incoming.transaction.id]!.classificationChoice"
            :searchable="false"
            :items="[
              { label: 'Kennzeichnung ausdrücklich wählen', value: '' },
              {
                label: `CSV: ${item.incoming.transaction.classification === 'FIXED' ? 'Fix' : 'Variabel'}`,
                value: 'CSV',
              },
              {
                label: `Ziel: ${candidate(item.incoming.transaction.id)?.transaction.classification === 'FIXED' ? 'Fix' : 'Variabel'}`,
                value: 'BANK',
              },
            ]"
          />
        </UFormField>
      </article>
      <p class="muted">
        Zusammenführen zählt die verbleibende Buchung einmal. „Separat behalten“ erhält beide Buchungen; „Überspringen“
        lässt die CSV-Buchung ohne Konto.
      </p>
      <UButton type="submit" :loading="busy">Zuordnung bestätigen</UButton>
    </form>
  </section>
</template>

<style scoped>
.reference-copy {
  overflow-wrap: anywhere;
}
</style>
