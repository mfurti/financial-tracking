<script setup lang="ts">
import { z } from 'zod';
import { passwordChangeSchema } from '@financial-tracking/contracts';
const api = useApi();
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
    error.value = (cause as Error).message;
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
  <div class="page-heading">
    <div>
      <p class="eyebrow">DEIN PRIVATER ARBEITSBEREICH</p>
      <h1>Einstellungen</h1>
      <p class="muted">Bewusst einfach. Vollständig unter deiner Kontrolle.</p>
    </div>
  </div>
  <section class="panel">
    <dl class="detail-list">
      <dt>Benutzer</dt>
      <dd>{{ api.session.value?.username }}</dd>
      <dt>Währung</dt>
      <dd>EUR · Cent-genaue Berechnung</dd>
      <dt>Zeitzone</dt>
      <dd>Europe/Berlin</dd>
      <dt>Bankabruf</dt>
      <dd>Manuell · keine dauerhaft gespeicherte Bank-PIN</dd>
      <dt>Datensicherung</dt>
      <dd>
        Tägliches verschlüsseltes Backup auf deinem Server konfigurieren; Wiederherstellung vor Produktivbetrieb prüfen.
      </dd>
      <dt>Zugang</dt>
      <dd>Ausschließlich Heimnetz/VPN mit HTTPS.</dd>
    </dl>
    <p class="muted mt-5">
      Anleitungen für Installation, Updates und Wiederherstellung liegen in der Projektdokumentation.
    </p>
  </section>
  <section class="panel mt-6">
    <h2 class="mb-5">Passwort ändern</h2>
    <UAlert v-if="error" color="error" :description="error" class="mb-4" /><UForm
      :schema="passwordChangeSchema"
      :state="form"
      class="form-row"
      @submit="changePassword"
      ><UFormField label="Aktuelles Passwort" name="currentPassword"
        ><UInput v-model="form.currentPassword" type="password" autocomplete="current-password" /></UFormField
      ><UFormField label="Neues Passwort (mindestens 12 Zeichen)" name="newPassword"
        ><UInput v-model="form.newPassword" type="password" autocomplete="new-password" /></UFormField
      ><UButton type="submit" :loading="busy">Passwort ändern & abmelden</UButton></UForm
    >
  </section>
</template>
