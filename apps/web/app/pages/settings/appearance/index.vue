<template>
  <div class="page-heading flex-wrap">
    <h1>{{ tr('Darstellung') }}</h1>
    <UButton to="/settings" variant="link">{{ tr('Zurück zu Einstellungen') }}</UButton>
  </div>
  <p class="appearance-scope muted">
    {{
      tr(
        'Farben und Helligkeit gelten auf diesem Gerät. Hell/Dunkel und die vorhandenen Ayu-Varianten bleiben unabhängig vom Eigentümerprofil.',
      )
    }}
  </p>
  <AppearanceSettings />
</template>
<style scoped>
.appearance-scope {
  margin-bottom: 24px;
  max-width: 80ch;
}
</style>
