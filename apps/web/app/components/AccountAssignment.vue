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
let disposed = false;
let generation = 0;
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
    tr('Nicht kategorisiert')
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
          source === 'FINTS' ? tr('Bank') : source === 'CSV' ? 'CSV' : tr('Bestand'),
      )
      .join(', ') || tr('Bestand')
  );
}
/** Revoke a preview when selection or target changes. */
function reset() {
  generation++;
  preview.value = null;
  requestId.value = null;
  error.value = '';
  for (const id of Object.keys(choices)) delete choices[id];
}
watch(/** Observe stable selection content rather than array identity. */ () => props.transactionIds.join(','), reset);
/** Fetch current versions and let the user decide before any write. */
async function compare() {
  if (busy.value) return;
  const request = ++generation;
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
    if (
      disposed ||
      request !== generation ||
      input.accountId !== accountId.value ||
      input.transactionIds.join(',') !== props.transactionIds.join(',')
    )
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
    if (!disposed && request === generation) error.value = userErrorMessage(cause);
  } finally {
    if (!disposed) busy.value = false;
  }
}
/** Keep the same confirmation identity on retry; the server rejects conflicting replays. */
async function confirm() {
  if (!preview.value || !requestId.value || busy.value) return;
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
    if (disposed) return;
    reset();
    emit('complete', result);
  } catch (cause) {
    if (!disposed) error.value = userErrorMessage(cause);
  } finally {
    if (!disposed) busy.value = false;
  }
}
onBeforeUnmount(
  /** Late preview/assignment responses cannot overwrite a different selection view. */ () => {
    disposed = true;
    generation++;
  },
);
</script>

<template>
  <section v-if="transactionIds.length" :aria-label="tr('Kontozuordnung')">
    <SectionPanel :title="tr('Ohne-Konto-Buchungen zuordnen')" icon="accounts" class="mb-5" compact>
      <p class="muted">
        {{ transactionIds.length }} {{ tr('ausgewählt. Erst vergleichen, dann zuordnen oder bewusst zusammenführen.') }}
      </p>
      <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-4" />
      <p v-if="!targets.length">
        {{ tr('Lege für die spätere Zuordnung zuerst ein Zielkonto an. Deine CSV ist bereits auswertbar.') }}
      </p>
      <div v-else class="toolbar mb-4">
        <label
          >{{ tr('Zielkonto für Zuordnung')
          }}<ChoiceSelect
            v-model="accountId"
            :disabled="busy"
            :aria-label="tr('Zielkonto für Zuordnung')"
            :searchable="true"
            :items="[
              { label: tr('Konto wählen'), value: '' },
              ...targets.map(
                /** Build a persisted choice. */ (account) => ({ label: `${account.name}`, value: account.id }),
              ),
            ]"
            @update:model-value="reset"
        /></label>
        <UButton
          :disabled="!accountId || transactionIds.length > 100"
          :loading="busy"
          variant="soft"
          @click="compare"
          >{{ tr('Zuordnung vergleichen') }}</UButton
        >
      </div>
      <form v-if="preview" @submit.prevent="confirm">
        <fieldset
          v-for="item in preview.items"
          :key="item.incoming.transaction.id"
          :disabled="busy"
          class="review-card assignment-comparison"
        >
          <legend class="sr-only">{{ item.incoming.transaction.description }}</legend>
          <h3>{{ item.incoming.transaction.description }}</h3>
          <p>
            {{ tr('CSV · Ohne Konto ·') }} {{ calendarDate(item.incoming.transaction.bookingDate) }} ·
            {{ money(item.incoming.transaction.amountCents) }}
          </p>
          <p>
            {{ tr('Kategorie:') }} {{ category(item.incoming.transaction.categoryId) }} ·
            {{ item.incoming.transaction.status === 'BOOKED' ? tr('Gebucht') : tr('Vorgemerkt')
            }}<span v-if="item.incoming.transaction.isTransfer"> {{ tr('· Umbuchung') }}</span>
          </p>
          <p>
            {{ tr('Gegenpartei:') }} {{ item.incoming.transaction.counterpartyName ?? tr('Nicht geliefert') }} ·
            {{ item.incoming.transaction.counterpartyIban ?? tr('Keine Gegenkonto-IBAN') }}
          </p>
          <p v-if="item.hasMoreCandidates" class="muted">
            {{ tr('Weitere mögliche Treffer vorhanden. Es wird niemals automatisch zusammengeführt.') }}
          </p>
          <template v-if="item.candidates.length">
            <label
              >{{ tr('Zielbuchung für') }} {{ item.incoming.transaction.description
              }}<ChoiceSelect
                v-model="choices[item.incoming.transaction.id]!.candidateId"
                :required="['BANK', 'CSV'].includes(choices[item.incoming.transaction.id]!.action)"
                :searchable="true"
                :items="[
                  { label: tr('Treffer wählen'), value: '' },
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
                {{ tr('Ziel:') }} {{ candidate(item.incoming.transaction.id)!.accountName }} ·
                {{ sources(candidate(item.incoming.transaction.id)!) }} ·
                {{ money(candidate(item.incoming.transaction.id)!.transaction.amountCents) }}
              </p>
              <p>
                {{ tr('Gegenpartei:') }}
                {{ candidate(item.incoming.transaction.id)!.transaction.counterpartyName ?? tr('Nicht geliefert') }} ·
                {{
                  candidate(item.incoming.transaction.id)!.transaction.counterpartyIban ?? tr('Keine Gegenkonto-IBAN')
                }}
              </p>
              <p>
                {{ tr('Kategorie:') }} {{ category(candidate(item.incoming.transaction.id)!.transaction.categoryId) }} ·
                {{
                  candidate(item.incoming.transaction.id)!.transaction.status === 'BOOKED'
                    ? tr('Gebucht')
                    : tr('Vorgemerkt')
                }}<span v-if="candidate(item.incoming.transaction.id)!.transaction.isTransfer">
                  {{ tr('· Umbuchung') }}</span
                >
              </p>
              <DisclosurePanel :title="tr('Quellreferenzen vergleichen')"
                ><p v-for="(reference, index) in item.incoming.references" :key="`csv-${index}`" class="reference-copy">
                  {{ tr('CSV ·') }} {{ reference.type }}: {{ reference.value }}
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
          <p v-else>{{ tr('Keine mögliche Überschneidung gefunden.') }}</p>
          <label
            >{{ tr('Entscheidung für') }} {{ item.incoming.transaction.description
            }}<ChoiceSelect
              v-model="choices[item.incoming.transaction.id]!.action"
              required
              :searchable="false"
              :items="[
                { label: tr('Entscheidung wählen'), value: '' },
                ...(item.candidates.length
                  ? [{ label: tr('Bank-/Zieldaten übernehmen und zusammenführen'), value: 'BANK' }]
                  : []),
                ...(item.candidates.length
                  ? [{ label: tr('CSV-Daten übernehmen und zusammenführen'), value: 'CSV' }]
                  : []),
                { label: tr('Separat behalten und zuordnen'), value: 'SEPARATE' },
                { label: tr('Zuordnung überspringen'), value: 'SKIP' },
              ]"
          /></label>
          <label
            v-if="
              ['BANK', 'CSV'].includes(choices[item.incoming.transaction.id]!.action) &&
              categoryConflict(item.incoming.transaction.id)
            "
            >{{ tr('Abweichende manuelle Kategorie')
            }}<ChoiceSelect
              v-model="choices[item.incoming.transaction.id]!.categoryChoice"
              required
              :searchable="false"
              :items="[
                { label: tr('Kategorie ausdrücklich wählen'), value: '' },
                { label: tr('CSV-Kategorie: {0}', [category(item.incoming.transaction.categoryId)]), value: 'CSV' },
                {
                  label: tr('Zielkategorie: {0}', [
                    category(candidate(item.incoming.transaction.id)!.transaction.categoryId),
                  ]),
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
            :label="tr('Abweichende Fix/Variabel-Kennzeichnung')"
            :help="
              tr('Beide Buchungen wurden unterschiedlich eingeordnet. Wähle, welche Entscheidung erhalten bleibt.')
            "
          >
            <ChoiceSelect
              v-model="choices[item.incoming.transaction.id]!.classificationChoice"
              :searchable="false"
              :items="[
                { label: tr('Kennzeichnung ausdrücklich wählen'), value: '' },
                {
                  label: tr('CSV: {0}', [
                    item.incoming.transaction.classification === 'FIXED' ? tr('Fix') : tr('Variabel'),
                  ]),
                  value: 'CSV',
                },
                {
                  label: tr('Ziel: {0}', [
                    candidate(item.incoming.transaction.id)?.transaction.classification === 'FIXED'
                      ? tr('Fix')
                      : tr('Variabel'),
                  ]),
                  value: 'BANK',
                },
              ]"
            />
          </UFormField>
        </fieldset>
        <p class="muted">
          {{
            tr(
              'Zusammenführen zählt die verbleibende Buchung einmal. „Separat behalten“ erhält beide Buchungen; „Überspringen“ lässt die CSV-Buchung ohne Konto.',
            )
          }}
        </p>
        <UButton type="submit" :loading="busy">{{ tr('Zuordnung bestätigen') }}</UButton>
      </form>
    </SectionPanel>
  </section>
</template>

<style scoped>
.reference-copy {
  overflow-wrap: anywhere;
}
.assignment-comparison {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 18px;
  margin: 16px 0;
}
.assignment-comparison label {
  display: block;
  margin-top: 16px;
}
</style>
