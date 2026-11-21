<script setup lang="ts">
import { demoPrice } from '../../../utils/demo-finance';
import type { DemoState } from '../../../utils/demo-state';
import { euroCents, editableEuro } from '../../../utils/euro-input';
/** Editable terms belong only to a device-local synthetic plan. */
type Plan = DemoState['plans'][number];
const { state, status, saving, error, execute, reload } = useDemoPortfolio();
const editing = ref(false),
  deleting = ref<Plan | null>(null),
  executing = ref<Plan | null>(null);
const planId = ref(''),
  name = ref(''),
  amount = ref(''),
  day = ref('1');
const accountId = ref(state.value.accounts[0]!.id),
  securityId = ref(state.value.securities[0]!.id);
const period = ref(
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit' })
    .format(new Date())
    .slice(0, 7),
);
const invalid = ref(''),
  notice = ref('');
const formId = useId();
const blocked = computed(
  /** Recovery precedes plan changes or explicit execution. */ () =>
    saving.value || !['ready', 'memory'].includes(status.value),
);
const planned = computed(
  /** Synthetic budgets are not booked payments. */ () =>
    state.value.plans.reduce(/** Accumulate exact planned cents. */ (sum, plan) => sum + BigInt(plan.amountCents), 0n),
);
/** Open fresh or existing terms without changing committed state. */
function edit(plan?: Plan) {
  planId.value = plan?.id ?? `demo-${crypto.randomUUID()}`;
  name.value = plan?.name ?? '';
  amount.value = plan ? editableEuro(plan.amountCents) : '';
  day.value = String(plan?.day ?? 1);
  accountId.value = plan?.accountId ?? state.value.accounts[0]!.id;
  securityId.value = plan?.securityId ?? state.value.securities[0]!.id;
  invalid.value = '';
  error.value = '';
  editing.value = true;
}
/** Validate positive budget/day before replacing one entire synthetic plan. */
async function save() {
  invalid.value = '';
  let amountCents: string;
  try {
    amountCents = euroCents(amount.value);
    if (BigInt(amountCents) <= 0n) throw new Error(tr('Positiven Demo-Sparbetrag eingeben.'));
    if (!/^(?:[1-9]|[12]\d|3[01])$/.test(day.value)) throw new Error(tr('Ausführungstag von 1 bis 31 eingeben.'));
  } catch (caught) {
    invalid.value = caught instanceof Error ? caught.message : tr('Demo-Plan prüfen.');
    return;
  }
  if (
    await execute({
      kind: 'plan-save',
      plan: {
        id: planId.value,
        name: name.value,
        accountId: accountId.value,
        securityId: securityId.value,
        amountCents,
        day: Number(day.value),
      },
    })
  ) {
    editing.value = false;
    notice.value = tr('Demo-Sparplan gespeichert. Keine automatische Ausführung.');
  }
}
/** Remove synthetic terms while retaining executed-period receipts. */
async function remove() {
  if (deleting.value && (await execute({ kind: 'plan-delete', planId: deleting.value.id }))) {
    deleting.value = null;
    notice.value = tr('Demo-Sparplan gelöscht.');
  }
}
/** Execute the explicitly selected month exactly once. */
async function run() {
  if (executing.value && (await execute({ kind: 'plan-execute', planId: executing.value.id, period: period.value }))) {
    executing.value = null;
    notice.value = tr('Demo-Sparplan für diesen Monat simuliert.');
  }
}
/** Resolve synthetic names without looking up real financial metadata. */
function accountName(id: string) {
  return (
    state.value.accounts.find(/** Match a validated demo reference. */ (account) => account.id === id)?.name ??
    tr('Demo-Konto')
  );
}
</script>
<template>
  <UButton to="/wealth" variant="link">{{ tr('Zurück zu Vermögen') }}</UButton>
  <div class="page-heading">
    <h1>{{ tr('Demo-Sparpläne') }}</h1>
    <UButton :disabled="blocked" @click="edit()">{{ tr('Demo-Sparplan anlegen') }}</UButton>
  </div>
  <p>
    {{
      tr(
        'Nur Simulation auf diesem Gerät. Kein automatischer Auftrag; Ausführung ausschließlich nach Bestätigung. Tage 29–31 werden bei Bedarf auf das Monatsende in Berlin begrenzt.',
      )
    }}
  </p>
  <p v-if="status !== 'ready'" role="status">
    {{
      status === 'memory'
        ? tr('Nur im Arbeitsspeicher; Änderungen gehen beim Neuladen verloren.')
        : tr('Demo-Speicher prüfen und neu laden, bevor Änderungen gespeichert werden.')
    }}<UButton v-if="status === 'conflict'" variant="soft" @click="reload">{{ tr('Demo neu laden') }}</UButton>
  </p>
  <p v-if="notice" role="status">{{ notice }}</p>
  <FinanceTile
    :label="tr('Monatliches Demo-Budget')"
    :value="money(planned)"
    :context="tr('Geplante Simulation · keine echte Zahlung')"
    financial
  />
  <SectionPanel :title="tr('Deine Demo-Sparpläne')"
    ><p v-if="!state.plans.length">{{ tr('Noch keine Demo-Sparpläne.') }}</p>
    <article v-for="plan in state.plans" :key="plan.id" class="demo-plan" :data-demo-plan="plan.id">
      <div>
        <h3>{{ plan.name }}</h3>
        <p>{{ accountName(plan.accountId) }} {{ tr('· Tag') }} {{ plan.day }}</p>
        <p data-financial>
          <template v-if="!amountsMasked()"
            >{{ money(plan.amountCents) }} {{ tr('Budget ·') }} {{ money(demoPrice(state, plan.securityId)) }}
            {{ tr('simulierter Stückpreis') }}</template
          ><template v-else>{{ tr('Betrag ausgeblendet') }}</template>
        </p>
        <p>{{ tr('Nur ganze Anteile; nicht verbrauchtes Budget bleibt im Demo-Guthaben.') }}</p>
      </div>
      <div class="demo-plan-actions">
        <UButton :disabled="blocked" variant="soft" @click="edit(plan)">{{ tr('Bearbeiten') }}</UButton
        ><UButton
          :disabled="blocked"
          variant="soft"
          @click="
            executing = plan;
            error = '';
          "
          >{{ tr('Monat simulieren') }}</UButton
        ><UButton
          :disabled="blocked"
          variant="ghost"
          @click="
            deleting = plan;
            error = '';
          "
          >{{ tr('Löschen') }}</UButton
        >
      </div>
    </article></SectionPanel
  >
  <FinanceDialog
    v-model:open="editing"
    :title="tr('Demo-Sparplan bearbeiten')"
    :description="tr('Fiktives Budget, keine echte Order.')"
    :dismissible="!saving"
    ><form class="demo-plan-form" @submit.prevent="save">
      <p v-if="invalid || error" role="alert">{{ invalid || error }}</p>
      <fieldset :disabled="blocked">
        <label :for="`${formId}-name`">{{ tr('Demo-Planname') }}</label
        ><input :id="`${formId}-name`" v-model="name" required maxlength="80" /><label :for="`${formId}-account`">{{
          tr('Demo-Verrechnungskonto')
        }}</label
        ><select :id="`${formId}-account`" v-model="accountId">
          <option v-for="account in state.accounts" :key="account.id" :value="account.id">
            {{ account.name }}
          </option></select
        ><label :for="`${formId}-security`">{{ tr('Demo-Wertpapier') }}</label
        ><select :id="`${formId}-security`" v-model="securityId">
          <option v-for="security in state.securities" :key="security.id" :value="security.id">
            {{ security.name }}
          </option></select
        ><label :for="`${formId}-amount`">{{ tr('Demo-Sparbetrag in Euro') }}</label
        ><input
          :id="`${formId}-amount`"
          v-model="amount"
          :type="amountsMasked() ? 'password' : 'text'"
          inputmode="decimal"
          required
        /><label :for="`${formId}-day`">{{ tr('Demo-Ausführungstag') }}</label
        ><input :id="`${formId}-day`" v-model="day" inputmode="numeric" required /><UButton
          type="submit"
          :loading="saving"
          >{{ tr('Demo-Sparplan speichern') }}</UButton
        >
      </fieldset>
      <UButton variant="ghost" :disabled="saving" @click="editing = false">{{ tr('Abbrechen') }}</UButton>
    </form></FinanceDialog
  >
  <FinanceDialog
    :open="Boolean(deleting)"
    :title="tr('Demo-Sparplan löschen')"
    :description="tr('Nur synthetische Planbedingungen entfernen.')"
    :dismissible="!saving"
    @update:open="!$event && (deleting = null)"
    ><p>{{ deleting?.name }} {{ tr('löschen? Bereits simulierte Aktivitäten bleiben erhalten.') }}</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <UButton :disabled="blocked" :loading="saving" @click="remove">{{ tr('Demo-Sparplan löschen') }}</UButton
    ><UButton variant="ghost" :disabled="saving" @click="deleting = null">{{ tr('Abbrechen') }}</UButton></FinanceDialog
  >
  <FinanceDialog
    :open="Boolean(executing)"
    :title="tr('Demo-Monat simulieren')"
    :description="tr('Ausdrückliche Simulation mit vorhandenen Demo-Mitteln.')"
    :dismissible="!saving"
    @update:open="!$event && (executing = null)"
    ><form class="demo-plan-form" @submit.prevent="run">
      <p>{{ tr('Jeder Plan kann pro Monat nur einmal ausgeführt werden. Keine Bankaktion.') }}</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <fieldset :disabled="blocked">
        <label :for="`${formId}-period`">{{ tr('Demo-Ausführungsmonat') }}</label
        ><input :id="`${formId}-period`" v-model="period" type="month" required /><UButton
          type="submit"
          :loading="saving"
          >{{ tr('Diesen Demo-Monat ausführen') }}</UButton
        >
      </fieldset>
      <UButton variant="ghost" :disabled="saving" @click="executing = null">{{ tr('Abbrechen') }}</UButton>
    </form></FinanceDialog
  >
</template>
<style scoped>
.demo-plan {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  padding-block: 16px;
  border-bottom: 1px solid var(--line);
}
.demo-plan:last-child {
  border-bottom: 0;
}
.demo-plan-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: start;
  gap: 8px;
}
.demo-plan-form,
fieldset {
  display: grid;
  gap: 12px;
  min-width: 0;
}
select,
input {
  width: 100%;
  min-width: 0;
  padding: 9px 12px;
  border: 1px solid var(--control-border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink);
}
@media (max-width: 700px) {
  .demo-plan {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
