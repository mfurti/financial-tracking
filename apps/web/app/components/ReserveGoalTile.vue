<script setup lang="ts">
import { z } from 'zod';
import * as c from '@financial-tracking/contracts';
const props = defineProps<{ account?: c.Account }>();
const api = useApi();
const goal = ref<z.infer<typeof c.reserveGoalSchema> | null>(null);
const loading = ref(true);
const error = ref('');
const saving = ref(false);
const editing = ref(false);
const designation = ref(false);
const targetEuro = ref('');
const notice = ref('');
let generation = 0;
let disposed = false;
const observationDates = computed(
  /** Show the full range of contributing source times without implying a single fresh combined balance. */ () =>
    (
      goal.value?.components.flatMap(
        /** Missing observations contribute no fabricated timestamp. */ (item) =>
          item.observedAt ? [item.observedAt] : [],
      ) ?? []
    ).sort(),
);
const staleCount = computed(
  /** Keep old source coverage visible even while the detail disclosure is closed. */ () =>
    goal.value?.components.filter(/** Count only observed sources marked stale by the server. */ (item) => item.stale)
      .length ?? 0,
);
const progress = computed(
  /** Convert only bounded display basis points to Number; exact money never leaves integer cents. */ () => {
    if (!goal.value || goal.value.currentCents === null) return 0;
    const points = (BigInt(goal.value.currentCents) * 10000n) / BigInt(goal.value.targetCents);
    return Number(points < 0n ? 0n : points > 10000n ? 10000n : points) / 100;
  },
);
/** Read confirmed settings/observations without retaining stale successful financial values after failure. */
async function load() {
  const request = ++generation;
  loading.value = true;
  error.value = '';
  goal.value = null;
  try {
    const result = await api.request('/reserve-goal', c.reserveGoalSchema);
    if (disposed || request !== generation) return;
    goal.value = result;
    designation.value = result.presentations.some(
      /** Restore only the selected account's actual designation. */ (item) =>
        item.accountId === props.account?.id && item.reserveEligible,
    );
  } catch (cause) {
    if (!disposed && request === generation) error.value = userErrorMessage(cause);
  } finally {
    if (!disposed && request === generation) loading.value = false;
  }
}
/** Begin a fresh target draft without changing persisted progress. */
function editTarget() {
  if (!goal.value) return;
  targetEuro.value = editableEuro(goal.value.targetCents);
  error.value = '';
  editing.value = true;
}
/** Persist only positive exact target cents; rejected saves retain the entered Euro draft. */
async function saveTarget() {
  if (saving.value) return;
  saving.value = true;
  error.value = '';
  try {
    const body = c.reserveGoalInputSchema.parse({ targetCents: euroCents(targetEuro.value) });
    const result = await api.request('/reserve-goal', c.reserveGoalSchema, { method: 'PUT', body });
    if (disposed) return;
    goal.value = result;
    editing.value = false;
    notice.value = 'Reserveziel gespeichert.';
  } catch (cause) {
    if (!disposed)
      error.value =
        cause instanceof z.ZodError
          ? 'Bitte ein positives Reserveziel in Euro eingeben.'
          : cause instanceof Error && cause.message.startsWith('Betrag als Euro')
            ? cause.message
            : userErrorMessage(cause);
  } finally {
    if (!disposed) saving.value = false;
  }
}
/** Save the explicit Tagesgeld choice without modifying account identity or any balance observation. */
async function saveDesignation() {
  if (!props.account || saving.value) return;
  saving.value = true;
  error.value = '';
  notice.value = '';
  try {
    await api.request(`/accounts/${props.account.id}/presentation`, c.accountPresentationSchema, {
      method: 'PATCH',
      body: c.accountPresentationInputSchema.parse({ reserveEligible: designation.value }),
    });
    if (disposed) return;
    await load();
    if (!disposed && !error.value) notice.value = 'Reserve-Zuordnung gespeichert.';
  } catch (cause) {
    if (!disposed) error.value = userErrorMessage(cause);
  } finally {
    if (!disposed) saving.value = false;
  }
}
onMounted(load);
onBeforeUnmount(
  /** Revoke source/setting responses owned by an abandoned account view. */ () => {
    disposed = true;
    generation++;
  },
);
</script>

<template>
  <SectionPanel title="Reserve" icon="accounts" class="my-5" bare compact>
    <FinanceTile v-if="loading" label="Beobachtete Reserve" state="loading" />
    <FinanceTile v-else-if="!goal" label="Beobachtete Reserve" state="error" :error-text="error" @retry="load" />
    <FinanceTile
      v-else
      label="Beobachtete Reserve"
      :value="goal.currentCents === null ? 'Keine beobachtete Reserve' : money(goal.currentCents)"
      :financial="goal.currentCents !== null"
      variant="insight"
    >
      <template #context
        ><span
          >Ziel: <span data-financial>{{ money(goal.targetCents) }}</span></span
        ><span class="block mt-2"
          >{{ goal.observedCount }} von {{ goal.eligibleCount }} ausgewählten aktiven EUR-Konten mit gebuchtem Saldo ·
          {{ goal.coverage === 'COMPLETE' ? 'Beobachtungen vollständig' : 'Unvollständige Beobachtungen' }}</span
        ><span v-if="observationDates.length" class="block mt-2"
          >Quellenbeobachtungen: {{ observedTime(observationDates[0]!)
          }}<template v-if="observationDates.at(-1) !== observationDates[0]">
            bis {{ observedTime(observationDates.at(-1)!) }}</template
          ></span
        >
        <span v-if="staleCount" class="block mt-2"
          >{{ staleCount }} {{ staleCount === 1 ? 'Quelle' : 'Quellen' }} älter als 48 Stunden</span
        >
      </template>
      <template #actions>
        <UProgress
          v-if="goal.currentCents !== null"
          :model-value="progress"
          aria-label="Fortschritt der bekannten Reserve zum Ziel"
          class="mb-4"
        />
        <UButton variant="soft" :disabled="saving" @click="editTarget">Reserveziel bearbeiten</UButton>
        <DisclosurePanel title="Reservequellen anzeigen" class="mt-4">
          <p class="muted my-3">
            Nur ausdrücklich als Tagesgeld markierte, aktive EUR-Konten tragen bei. Neuester beobachteter gebuchter
            Saldo; CSV-Umsätze ersetzen keinen Kontostand. Stand der Prüfung: {{ observedTime(goal.asOf) }}.
          </p>
          <p v-if="!goal.components.length" class="muted">Noch keine geeigneten Reservequellen ausgewählt.</p>
          <div v-for="item in goal.components" :key="item.accountId" class="reserve-source">
            <NuxtLink :to="`/accounts/${item.accountId}`"
              ><strong>{{ item.name }}</strong></NuxtLink
            >
            <p v-if="item.amountCents !== null" data-financial>{{ money(item.amountCents) }}</p>
            <p v-else>Kein beobachteter gebuchter Saldo</p>
            <p v-if="item.observedAt" class="muted">
              {{ observedTime(item.observedAt) }} · {{ item.source
              }}<span v-if="item.stale"> · älter als 48 Stunden</span>
            </p>
          </div>
          <p v-for="item in goal.excludedAccounts" :key="item.accountId" class="muted">
            {{ item.name }}:
            {{ item.reason === 'NON_EUR' ? 'Andere Währung, nicht mitgerechnet' : 'Inaktiv, nicht mitgerechnet' }}
          </p>
        </DisclosurePanel>
      </template>
    </FinanceTile>
  </SectionPanel>
  <UAlert v-if="error && goal && !editing" role="alert" color="error" :description="error" class="mb-4" />
  <p v-if="notice" role="status" class="muted my-3">{{ notice }}</p>
  <SectionPanel v-if="account && goal && !loading" title="Tagesgeld-Zuordnung" icon="settings" compact class="mb-5">
    <p class="muted mb-4">
      Die Auswahl ändert keine Bankdaten.
      {{
        account.currency !== 'EUR'
          ? 'Dieses Konto ist kein EUR-Konto und trägt nicht zur Reserve bei.'
          : !account.isActive
            ? 'Dieses Konto ist inaktiv und trägt derzeit nicht zur Reserve bei.'
            : 'Bestätige nur ein Konto, das du bewusst als Tagesgeld für deine Reserve verwenden möchtest.'
      }}
    </p>
    <UCheckbox
      v-model="designation"
      label="Dieses Konto ausdrücklich als Tagesgeld für die Reserve markieren."
      :disabled="saving || (account.currency !== 'EUR' && !designation)"
    />
    <UButton variant="soft" class="mt-4" :loading="saving" @click="saveDesignation"
      >Reserve-Zuordnung speichern</UButton
    >
  </SectionPanel>
  <FinanceDialog
    v-model:open="editing"
    title="Reserveziel bearbeiten"
    description="Positiver Zielbetrag; vorhandene Kontostände und aufgezeichnete Werte bleiben unverändert."
    :dismissible="!saving"
    :close="!saving"
  >
    <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-4" />
    <form class="grid gap-4" @submit.prevent="saveTarget">
      <UFormField label="Reserveziel in Euro"
        ><UInput v-model="targetEuro" aria-label="Reserveziel in Euro" inputmode="decimal" :disabled="saving"
      /></UFormField>
      <div class="toolbar">
        <UButton type="submit" :loading="saving">Reserveziel speichern</UButton
        ><UButton variant="ghost" :disabled="saving" @click="editing = false">Abbrechen</UButton>
      </div>
    </form>
  </FinanceDialog>
</template>

<style scoped>
.reserve-source {
  border-top: 1px solid var(--line);
  padding: 12px 0;
  overflow-wrap: anywhere;
}
</style>
