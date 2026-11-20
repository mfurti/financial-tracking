<script setup lang="ts">
import { z } from 'zod';
import * as c from '@financial-tracking/contracts';
const props = withDefaults(
  defineProps<{
    accounts: readonly c.Account[];
    label?: string;
    allowUnassigned?: boolean;
    disabled?: boolean;
    searchable?: boolean;
  }>(),
  { label: 'Konto', allowUnassigned: true, disabled: false, searchable: true },
);
const accountId = defineModel<string>('accountId', { default: '' });
const groupId = defineModel<string>('groupId', { default: '' });
const emit = defineEmits<{ change: [] }>();
const api = useApi();
const groups = ref<z.infer<typeof c.accountGroupSchema>[]>([]),
  error = ref('');
let disposed = false;
const selection = computed({
  get: /** Encode one UI selection while keeping account/group transport fields independent. */ () =>
    groupId.value ? `group:${groupId.value}` : accountId.value,
  set: /** Update both identities before publishing one effective scope change. */ (value: string) => {
    if (value.startsWith('group:')) {
      accountId.value = '';
      groupId.value = value.slice(6);
    } else {
      groupId.value = '';
      accountId.value = value;
    }
    emit('change');
  },
});
const choices = computed(
  /** Preserve an unresolved active group rather than silently broadening it to all accounts. */ () => [
    { label: 'Alle Konten', value: '' },
    ...(props.allowUnassigned ? [{ label: 'Ohne Konto', value: 'UNASSIGNED' }] : []),
    ...props.accounts.map(
      /** Existing account labels and UUIDs retain their previous behavior. */ (account) => ({
        label: account.name,
        value: account.id,
      }),
    ),
    ...groups.value.map(
      /** Prefix group labels so a same-named account cannot be mistaken for a group. */ (group) => ({
        label: `Kontogruppe: ${group.name}`,
        value: `group:${group.id}`,
      }),
    ),
    ...(groupId.value &&
    !groups.value.some(
      /** A missing group remains explicitly selected until changed. */ (group) => group.id === groupId.value,
    )
      ? [{ label: 'Gewählte Kontogruppe (Name nicht verfügbar)', value: `group:${groupId.value}` }]
      : []),
  ],
);
/** Load membership labels independently; a label failure never replaces the active financial scope. */
async function load() {
  error.value = '';
  try {
    const result = await api.request('/account-groups', z.array(c.accountGroupSchema));
    if (!disposed) groups.value = result;
  } catch {
    if (!disposed) error.value = 'Kontogruppen konnten nicht geladen werden.';
  }
}
onMounted(load);
onBeforeUnmount(
  /** Ignore late group label responses after this filter is removed. */ () => {
    disposed = true;
  },
);
</script>
<template>
  <div class="account-scope-select">
    <ChoiceSelect
      v-model="selection"
      :aria-label="label"
      :items="choices"
      :disabled="disabled"
      :searchable="searchable"
    />
    <div v-if="error" role="alert">
      <p>{{ error }}</p>
      <UButton variant="soft" @click="load">Kontogruppen erneut laden</UButton>
    </div>
  </div>
</template>
<style scoped>
.account-scope-select {
  min-width: 0;
  width: 100%;
}
</style>
