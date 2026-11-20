<script setup lang="ts">
import { z } from 'zod';
import * as c from '@financial-tracking/contracts';
import { userErrorMessage } from '../../utils/api-error';
const api = useApi();
const { validation, formError, formInvalid } = useFormFeedback();
const form = reactive({ displayName: '', contactEmail: '' });
const formSchema = c.workspaceProfileInputSchema.extend({
  contactEmail: c.workspaceProfileInputSchema.shape.contactEmail.or(z.literal('')),
});
const loading = ref(true),
  busy = ref(false),
  ready = ref(false);
const loadError = ref(''),
  error = ref(''),
  notice = ref('');
let generation = 0;
/** Restore only confirmed server metadata; a failed read never overwrites a typed save draft. */
async function load() {
  if (busy.value) return;
  const current = ++generation;
  loading.value = true;
  loadError.value = '';
  try {
    const profile = await api.request('/workspace/profile', c.workspaceProfileSchema);
    if (current !== generation) return;
    form.displayName = profile.displayName;
    form.contactEmail = profile.contactEmail ?? '';
    ready.value = true;
  } catch (caught) {
    if (current === generation) loadError.value = userErrorMessage(caught);
  } finally {
    if (current === generation) loading.value = false;
  }
}
/** Submit only display/contact metadata, retaining all input values on a failed request. */
async function save() {
  if (busy.value) return;
  ++generation;
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    const saved = await api.request('/workspace/profile', c.workspaceProfileSchema, {
      method: 'PATCH',
      body: c.workspaceProfileInputSchema.parse({
        displayName: form.displayName,
        contactEmail: form.contactEmail.trim() || null,
      }),
    });
    form.displayName = saved.displayName;
    form.contactEmail = saved.contactEmail ?? '';
    notice.value = 'Profil gespeichert. Anmeldename und Zugang bleiben unverändert.';
  } catch (caught) {
    error.value = formError(caught);
  } finally {
    busy.value = false;
  }
}
onMounted(load);
onBeforeUnmount(
  /** Ignore a read response after this profile page has been left. */ () => {
    generation++;
  },
);
</script>
<template>
  <UButton to="/settings" variant="link">Zurück zu Einstellungen</UButton>
  <div class="page-heading"><h1>Mein Profil</h1></div>
  <p>
    Persönliche Anzeige- und Kontaktdaten des bestehenden Eigentümers. Die Kontakt-E-Mail ändert weder Anmeldung noch
    Passwortwiederherstellung.
  </p>
  <p v-if="loading" role="status">Profil wird geladen …</p>
  <div v-if="loadError" role="alert">
    <p>{{ loadError }}</p>
    <UButton variant="soft" @click="load">Profil erneut laden</UButton>
  </div>
  <SectionPanel v-if="ready" title="Eigentümerprofil"
    ><p>Anmeldename: {{ api.session.value?.username }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <UAlert v-if="error" role="alert" color="error" :description="error" />
    <UForm
      ref="validation"
      :schema="formSchema"
      :state="form"
      :validate-on="[]"
      class="profile-form"
      @submit="save"
      @error="formInvalid"
      ><fieldset :disabled="busy || loading">
        <UFormField label="Anzeigename" name="displayName"
          ><UInput v-model="form.displayName" autocomplete="name" maxlength="80" class="w-full" /></UFormField
        ><UFormField label="Kontakt-E-Mail (optional)" name="contactEmail"
          ><UInput
            v-model="form.contactEmail"
            type="email"
            autocomplete="email"
            maxlength="254"
            class="w-full" /></UFormField
        ><UButton type="submit" :loading="busy">Profil speichern</UButton>
      </fieldset></UForm
    >
  </SectionPanel>
</template>
<style scoped>
.profile-form,
fieldset {
  display: grid;
  gap: 16px;
  min-width: 0;
  margin-top: 16px;
}
.profile-form {
  max-width: 640px;
}
</style>
