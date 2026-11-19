<script setup lang="ts">
import { demoPrice } from '../utils/demo-finance';
const props = defineProps<{ securityId?: string }>();
const emit = defineEmits<{ completed: []; cancel: [] }>();
const { state, status, saving, error, execute } = useDemoPortfolio();
const accountId = ref(state.value.accounts[0]!.id);
const securityId = ref(props.securityId ?? state.value.securities[0]!.id);
const side = ref<'buy' | 'sell'>('buy');
const quantity = ref('1');
const invalid = ref('');
const quantityInput = ref<HTMLInputElement | null>(null);
const formId = useId();
const quote = computed(
  /** Quotes are simulated exact cents, never external financial observations. */ () =>
    demoPrice(state.value, securityId.value),
);
const orderValue = computed(
  /** Multiply only validated whole-share counts using BigInt. */ () =>
    /^(?:[1-9]\d{0,2}|1000)$/.test(quantity.value) ? quote.value * BigInt(quantity.value) : null,
);
const blocked = computed(
  /** Corrupt or conflicting device data requires explicit recovery before trading. */ () =>
    saving.value || !['ready', 'memory'].includes(status.value),
);

/** Validate an entire draft, then issue one isolated atomic synthetic command. */
async function submit() {
  invalid.value = '';
  if (orderValue.value === null) {
    invalid.value = '1 bis 1000 ganze Anteile eingeben.';
    await nextTick();
    quantityInput.value?.focus();
    return;
  }
  if (
    await execute({
      kind: side.value,
      accountId: accountId.value,
      securityId: securityId.value,
      quantity: Number(quantity.value),
    })
  )
    emit('completed');
}
</script>

<template>
  <form class="demo-order-form" @submit.prevent="submit">
    <p :id="`${formId}-help`">Nur Simulation auf diesem Gerät. Kein echter Auftrag, keine Live-Kurse.</p>
    <p v-if="invalid || error" role="alert">{{ invalid || error }}</p>
    <fieldset :disabled="blocked" :aria-describedby="`${formId}-help`">
      <label
        >Demo-Aktion<select v-model="side">
          <option value="buy">Kaufen</option>
          <option value="sell">Verkaufen</option>
        </select></label
      >
      <label
        >Demo-Verrechnungskonto<select v-model="accountId">
          <option v-for="account in state.accounts" :key="account.id" :value="account.id">{{ account.name }}</option>
        </select></label
      >
      <label
        >Demo-Wertpapier<select v-model="securityId">
          <option v-for="security in state.securities" :key="security.id" :value="security.id">
            {{ security.name }}
          </option>
        </select></label
      >
      <label
        >Ganze Anteile<input
          ref="quantityInput"
          v-model="quantity"
          inputmode="numeric"
          :aria-invalid="Boolean(invalid)"
          autocomplete="off"
      /></label>
      <dl class="demo-order-values">
        <div>
          <dt>Simulierter Stückpreis</dt>
          <dd data-financial>{{ money(quote) }}</dd>
        </div>
        <div>
          <dt>Simulierter Auftragswert</dt>
          <dd data-financial>{{ orderValue === null ? 'Ganze Anteile eingeben' : money(orderValue) }}</dd>
        </div>
      </dl>
      <UButton type="submit" :loading="saving">{{ side === 'buy' ? 'Kauf simulieren' : 'Verkauf simulieren' }}</UButton>
    </fieldset>
    <UButton type="button" variant="ghost" :disabled="saving" @click="emit('cancel')">Abbrechen</UButton>
  </form>
</template>

<style scoped>
.demo-order-form,
fieldset {
  display: grid;
  gap: 16px;
  min-width: 0;
}
label {
  display: grid;
  gap: 6px;
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
.demo-order-values {
  display: grid;
  gap: 10px;
}
.demo-order-values > div {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
}
dd {
  font-weight: 700;
  overflow-wrap: anywhere;
}
</style>
