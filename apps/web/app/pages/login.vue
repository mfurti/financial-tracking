<script setup lang="ts">
import { loginSchema, sessionSchema } from '@financial-tracking/contracts';

definePageMeta({ layout: false });
const api = useApi();
const { validation, formError } = useFormFeedback();
const form = reactive({ username: '', password: '' });
const error = ref('');
const busy = ref(false);
/** Validate using the shared contract and erase the password after every attempt. */
async function login() {
  busy.value = true;
  error.value = '';
  try {
    api.session.value = await api.request('/auth/login', sessionSchema, {
      method: 'POST',
      body: loginSchema.parse(form),
    });
    await navigateTo('/');
  } catch (cause) {
    error.value = formError(cause);
  } finally {
    form.password = '';
    busy.value = false;
  }
}
</script>

<template>
  <main class="login-page finance-login">
    <div class="login-theme"><ThemeToggle /></div>
    <section class="login-card">
      <div class="brand-mark">H</div>
      <p class="eyebrow mt-6">HAUSHALTSBUCH</p>
      <h1>Anmelden</h1>
      <p class="muted mb-7">Dein privater Finanzbereich.</p>
      <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-4" /><UForm
        ref="validation"
        :schema="loginSchema"
        :state="form"
        class="space-y-5"
        @submit="login"
        ><UFormField label="Benutzername" name="username"
          ><UInput v-model="form.username" autocomplete="username" class="w-full" /></UFormField
        ><UFormField label="Passwort" name="password"
          ><UInput v-model="form.password" type="password" autocomplete="current-password" class="w-full" /></UFormField
        ><UButton type="submit" :loading="busy" block size="lg">Anmelden</UButton></UForm
      >
      <p class="muted text-xs mt-6">Zugang ausschließlich über dein Heimnetz oder VPN.</p>
    </section>
  </main>
</template>
