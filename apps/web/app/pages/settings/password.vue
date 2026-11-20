<script setup lang="ts">
import { z } from 'zod';
import { passwordChangeSchema } from '@financial-tracking/contracts';
const api = useApi();
const { validation, formError, formInvalid } = useFormFeedback();
const form = reactive({ currentPassword: '', newPassword: '' });
const busy = ref(false);
const error = ref('');
/** Require the current password, revoke all sessions, and erase both form values. */
async function changePassword() {
  busy.value = true;
  error.value = '';
  try {
    await api.request('/auth/password', z.object({ ok: z.boolean() }), {
      method: 'POST',
      body: passwordChangeSchema.parse(form),
    });
    api.session.value = null;
    await navigateTo('/login');
  } catch (cause) {
    error.value = formError(cause);
  } finally {
    form.currentPassword = '';
    form.newPassword = '';
    busy.value = false;
  }
}
onBeforeUnmount(
  /** Never retain passwords after leaving settings. */ () => {
    form.currentPassword = '';
    form.newPassword = '';
  },
);
</script>

<template>
  <UButton to="/settings" variant="link">Zurück zu Einstellungen</UButton>
  <div class="page-heading"><h1>Passwort ändern</h1></div>
  <p>Die Änderung meldet alle bestehenden Sitzungen ab. Anmeldename und Finanzdaten bleiben erhalten.</p>
  <SectionPanel title="Passwort ändern" icon="settings" class="mt-6">
    <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-4" /><UForm
      ref="validation"
      :schema="passwordChangeSchema"
      :state="form"
      :validate-on="[]"
      :disabled="busy"
      class="form-row"
      @submit="changePassword"
      @error="formInvalid"
      ><UFormField label="Aktuelles Passwort" name="currentPassword"
        ><UInput v-model="form.currentPassword" type="password" autocomplete="current-password" /></UFormField
      ><UFormField label="Neues Passwort (mindestens 12 Zeichen)" name="newPassword"
        ><UInput v-model="form.newPassword" type="password" autocomplete="new-password" /></UFormField
      ><UButton type="submit" :loading="busy">Passwort ändern & abmelden</UButton></UForm
    >
  </SectionPanel>
</template>
