<script setup lang="ts">
import { z } from 'zod';
import * as c from '@financial-tracking/contracts';
const api = useApi();
const { validation, formError, formInvalid } = useFormFeedback();
const accounts = ref<c.Account[]>([]),
  groups = ref<z.infer<typeof c.accountGroupSchema>[]>([]);
const loading = ref(true),
  saving = ref(false),
  editing = ref(false);
const deleting = ref<z.infer<typeof c.accountGroupSchema> | null>(null);
const editingId = ref<string | null>(null);
const form = reactive({ name: '', sortOrder: 0, accountIds: [] as string[] });
const error = ref(''),
  saveError = ref(''),
  notice = ref('');
let generation = 0;
/** Load confirmed groups and account references without overwriting an open editing draft. */
async function load() {
  if (editing.value || deleting.value) return;
  const request = ++generation;
  loading.value = true;
  error.value = '';
  try {
    const [saved, choices] = await Promise.all([
      api.request('/account-groups', z.array(c.accountGroupSchema)),
      api.request('/accounts', z.array(c.accountSchema)),
    ]);
    if (request !== generation) return;
    groups.value = saved;
    accounts.value = choices;
  } catch (caught) {
    if (request === generation) error.value = userErrorMessage(caught);
  } finally {
    if (request === generation) loading.value = false;
  }
}
/** Open a copied draft; membership changes require an explicit save. */
function edit(group?: z.infer<typeof c.accountGroupSchema>) {
  ++generation;
  editingId.value = group?.id ?? null;
  form.name = group?.name ?? '';
  form.sortOrder = group?.sortOrder ?? 0;
  form.accountIds = [...(group?.accountIds ?? [])];
  saveError.value = '';
  editing.value = true;
}
/** Save one atomic group membership set and preserve the complete draft on failure. */
async function save() {
  if (saving.value) return;
  saving.value = true;
  saveError.value = '';
  try {
    const input = c.accountGroupInputSchema.parse(form);
    const saved = await api.request(
      editingId.value ? `/account-groups/${editingId.value}` : '/account-groups',
      c.accountGroupSchema,
      { method: editingId.value ? 'PATCH' : 'POST', body: input },
    );
    groups.value = [
      ...groups.value.filter(/** Replace only the confirmed edited identity. */ (group) => group.id !== saved.id),
      saved,
    ].sort(
      /** Preserve the server's primary stable display order locally. */ (a, b) =>
        a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    );
    editing.value = false;
    notice.value = 'Kontogruppe gespeichert. Konten und Buchungen bleiben unverändert.';
  } catch (caught) {
    saveError.value = formError(caught);
  } finally {
    saving.value = false;
  }
}
/** Confirm removal of metadata only; failed deletion retains its context. */
async function remove() {
  if (!deleting.value || saving.value) return;
  saving.value = true;
  saveError.value = '';
  try {
    const id = deleting.value.id;
    await api.request(`/account-groups/${id}`, z.object({ ok: z.boolean() }), {
      method: 'DELETE',
      body: { confirm: true },
    });
    groups.value = groups.value.filter(/** Remove only the deleted group card. */ (group) => group.id !== id);
    deleting.value = null;
    notice.value = 'Kontogruppe gelöscht. Die Konten bleiben erhalten.';
  } catch (caught) {
    saveError.value = userErrorMessage(caught);
  } finally {
    saving.value = false;
  }
}
/** Label stored references, retaining inactive historical members without inventing a match. */
function accountName(id: string) {
  const account = accounts.value.find(/** Match only the persisted account identity. */ (item) => item.id === id);
  return account ? `${account.name}${account.isActive ? '' : ' (inaktiv)'}` : 'Entferntes Konto';
}
onMounted(load);
onBeforeUnmount(
  /** Revoke late metadata reads after leaving settings. */ () => {
    generation++;
  },
);
</script>
<template>
  <UButton to="/settings" variant="link">Zurück zu Einstellungen</UButton>
  <div class="page-heading">
    <h1>Kontogruppen</h1>
    <UButton :disabled="loading || saving || Boolean(error)" @click="edit()">Kontogruppe anlegen</UButton>
  </div>
  <p>
    Konten dürfen mehreren Gruppen angehören. Eine Auswertung zählt jedes ausgewählte Konto einmal. Leere Gruppen finden
    keine Buchungen; Konten ohne Zuordnung gehören keiner Gruppe an.
  </p>
  <p v-if="loading" role="status">Kontogruppen werden geladen …</p>
  <div v-if="error" role="alert">
    <p>{{ error }}</p>
    <UButton variant="soft" @click="load">Kontogruppen erneut laden</UButton>
  </div>
  <p v-if="notice" role="status">{{ notice }}</p>
  <SectionPanel v-if="!loading && !error" title="Gespeicherte Kontogruppen"
    ><p v-if="!groups.length">Noch keine Kontogruppen.</p>
    <article v-for="group in groups" :key="group.id" class="account-group-row" :data-account-group="group.id">
      <div>
        <h3>{{ group.name }}</h3>
        <p>{{ group.accountIds.length }} Mitgliedskonten · Reihenfolge {{ group.sortOrder }}</p>
        <p v-if="!group.accountIds.length">Leere Gruppe: Auswertungen finden keine Konten.</p>
        <ul>
          <li v-for="id in group.accountIds" :key="id">{{ accountName(id) }}</li>
        </ul>
      </div>
      <div class="account-group-actions">
        <UButton :disabled="saving" variant="soft" @click="edit(group)">Bearbeiten</UButton
        ><UButton :to="`/analytics?groupId=${group.id}`" variant="soft">Gruppenanalyse</UButton
        ><UButton :to="`/contracts/calendar?groupId=${group.id}`" variant="soft">Gruppenkalender</UButton
        ><UButton :to="`/contracts/analysis?groupId=${group.id}`" variant="soft">Gruppenvertragskosten</UButton
        ><UButton
          :disabled="saving"
          variant="ghost"
          @click="
            deleting = group;
            saveError = '';
          "
          >Löschen</UButton
        >
      </div>
    </article></SectionPanel
  >
  <FinanceDialog
    v-model:open="editing"
    title="Kontogruppe bearbeiten"
    description="Nur Name, Reihenfolge und Mitgliedschaften speichern."
    :dismissible="!saving"
    ><UAlert v-if="saveError" role="alert" color="error" :description="saveError" /><UForm
      ref="validation"
      :schema="c.accountGroupInputSchema"
      :state="form"
      :validate-on="[]"
      class="account-group-form"
      @submit="save"
      @error="formInvalid"
      ><fieldset :disabled="saving">
        <UFormField label="Gruppenname" name="name"
          ><UInput v-model="form.name" maxlength="60" class="w-full" /></UFormField
        ><UFormField label="Reihenfolge" name="sortOrder"
          ><UInput v-model.number="form.sortOrder" type="number" min="0" max="2147483647" class="w-full" /></UFormField
        ><UFormField label="Mitgliedskonten" name="accountIds"
          ><div class="account-group-members">
            <label v-for="account in accounts" :key="account.id"
              ><input v-model="form.accountIds" type="checkbox" :value="account.id" />{{
                accountName(account.id)
              }}</label
            >
          </div></UFormField
        >
        <p v-if="!form.accountIds.length">Leere Gruppe: Auswertungen finden keine Konten.</p>
        <UButton type="submit" :loading="saving">Kontogruppe speichern</UButton>
      </fieldset></UForm
    ><UButton variant="ghost" :disabled="saving" @click="editing = false">Abbrechen</UButton></FinanceDialog
  >
  <FinanceDialog
    :open="Boolean(deleting)"
    title="Kontogruppe löschen"
    description="Nur die Gruppierung entfernen, keine Konten oder Buchungen."
    :dismissible="!saving"
    @update:open="!$event && (deleting = null)"
    ><p>{{ deleting?.name }} löschen? Zugeordnete Konten, Salden und Buchungen bleiben erhalten.</p>
    <p v-if="saveError" role="alert">{{ saveError }}</p>
    <template #footer
      ><UButton variant="ghost" :disabled="saving" @click="deleting = null">Abbrechen</UButton
      ><UButton :disabled="saving" :loading="saving" @click="remove">Kontogruppe löschen</UButton></template
    ></FinanceDialog
  >
</template>
<style scoped>
.account-group-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  padding-block: 16px;
  border-bottom: 1px solid var(--line);
}
.account-group-row:last-child {
  border-bottom: 0;
}
.account-group-row h3,
li {
  overflow-wrap: anywhere;
}
.account-group-actions {
  display: flex;
  flex-wrap: wrap;
  align-content: start;
  gap: 8px;
}
.account-group-form,
fieldset,
.account-group-members {
  display: grid;
  gap: 12px;
  min-width: 0;
}
.account-group-form {
  margin-block: 16px;
}
.account-group-members label {
  display: flex;
  align-items: start;
  gap: 10px;
}
.account-group-members input {
  margin-top: 5px;
  flex: none;
}
@media (max-width: 700px) {
  .account-group-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
