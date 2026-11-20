<script setup lang="ts">
import { euroCents } from '../utils/euro-input';
const { state, status, saving, error, execute } = useDemoPortfolio();
const mode = ref<'transfer' | 'account' | 'category'>('transfer');
const open = ref(false),
  name = ref(''),
  amount = ref(''),
  invalid = ref(''),
  notice = ref('');
const fromId = ref(state.value.accounts[0]!.id),
  toId = ref(state.value.accounts[1]?.id ?? state.value.accounts[0]!.id);
const amountInput = ref<HTMLInputElement | null>(null);
const formId = useId();
const title = computed(
  /** Mutation titles disclose synthetic scope before submission. */ () =>
    mode.value === 'transfer'
      ? tr('Demo-Geld verschieben')
      : mode.value === 'account'
        ? tr('Demo-Konto anlegen')
        : tr('Demo-Kategorie anlegen'),
);
const blocked = computed(
  /** Stale device data cannot be overwritten by a draft. */ () =>
    saving.value || !['ready', 'memory'].includes(status.value),
);
/** Open an isolated action without modifying committed state. */
function show(next: typeof mode.value) {
  mode.value = next;
  invalid.value = '';
  error.value = '';
  open.value = true;
}
/** Commit one transfer or zero-funded metadata creation, preserving rejected drafts. */
async function submit() {
  invalid.value = '';
  let accepted = false;
  if (mode.value === 'transfer') {
    let amountCents: string;
    try {
      amountCents = euroCents(amount.value);
      if (BigInt(amountCents) <= 0n) throw new Error(tr('Positiven Demo-Betrag eingeben.'));
    } catch (caught) {
      invalid.value = caught instanceof Error ? caught.message : tr('Demo-Betrag prüfen.');
      await nextTick();
      amountInput.value?.focus();
      return;
    }
    accepted = await execute({ kind: 'transfer', fromId: fromId.value, toId: toId.value, amountCents });
  } else accepted = await execute({ kind: mode.value, name: name.value });
  if (accepted) {
    open.value = false;
    notice.value = tr('Demo-Aktion gespeichert. Keine echte Buchung erstellt.');
    name.value = '';
    amount.value = '';
  }
}
</script>
<template>
  <SectionPanel :title="tr('Demo-Konten verwalten')">
    <p>
      {{ tr('Neue Demo-Konten starten ohne Guthaben. Verschieben verteilt ausschließlich vorhandenes Demo-Guthaben.') }}
    </p>
    <div class="demo-account-buttons">
      <UButton :disabled="blocked" variant="soft" @click="show('transfer')">{{ tr('Demo-Geld verschieben') }}</UButton
      ><UButton :disabled="blocked" variant="soft" @click="show('account')">{{ tr('Demo-Konto anlegen') }}</UButton
      ><UButton :disabled="blocked" variant="soft" @click="show('category')">{{
        tr('Demo-Kategorie anlegen')
      }}</UButton>
    </div>
    <p v-if="notice" role="status">{{ notice }}</p>
    <details>
      <summary>{{ tr('Demo-Kategorien anzeigen') }}</summary>
      <ul>
        <li v-for="category in state.categories" :key="category.id">{{ category.name }}</li>
      </ul>
    </details>
    <FinanceDialog
      v-model:open="open"
      :title="title"
      :description="tr('Nur fiktive Daten auf diesem Gerät.')"
      :dismissible="!saving"
    >
      <form class="demo-account-form" @submit.prevent="submit">
        <p v-if="invalid || error" role="alert">{{ invalid || error }}</p>
        <fieldset :disabled="blocked">
          <template v-if="mode === 'transfer'">
            <label :for="`${formId}-from`">{{ tr('Von Demo-Konto') }}</label
            ><select :id="`${formId}-from`" v-model="fromId">
              <option v-for="account in state.accounts" :key="account.id" :value="account.id">
                {{ account.name }}
              </option>
            </select>
            <label :for="`${formId}-to`">{{ tr('Nach Demo-Konto') }}</label
            ><select :id="`${formId}-to`" v-model="toId">
              <option v-for="account in state.accounts" :key="account.id" :value="account.id">
                {{ account.name }}
              </option>
            </select>
            <label :for="`${formId}-amount`">{{ tr('Demo-Betrag in Euro') }}</label
            ><input
              :id="`${formId}-amount`"
              ref="amountInput"
              v-model="amount"
              :type="amountsMasked() ? 'password' : 'text'"
              inputmode="decimal"
              required
            />
          </template>
          <template v-else
            ><label :for="`${formId}-name`">{{ tr('Demo-Name') }}</label
            ><input :id="`${formId}-name`" v-model="name" required maxlength="80" />
            <p v-if="mode === 'account'">
              {{ tr('Anfangsguthaben:')
              }}<span data-financial
                ><template v-if="!amountsMasked()">{{ money('0') }}</template
                ><template v-else>{{ tr('Betrag ausgeblendet') }}</template></span
              >{{ tr('. Keine Verbindung zu echten Konten.') }}
            </p></template
          >
          <UButton type="submit" :loading="saving">{{ tr('Demo-Aktion speichern') }}</UButton>
        </fieldset>
        <UButton type="button" variant="ghost" :disabled="saving" @click="open = false">{{ tr('Abbrechen') }}</UButton>
      </form>
    </FinanceDialog>
  </SectionPanel>
</template>
<style scoped>
.demo-account-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-block: 16px;
}
.demo-account-form,
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
</style>
