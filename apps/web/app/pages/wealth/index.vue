<template>
  <div class="page-heading wealth-heading">
    <h1>{{ tr('Vermögen') }}</h1>
    <UButton to="/accounts" variant="soft">{{ tr('Quellkonten verwalten') }}</UButton>
  </div>
  <nav class="toolbar wealth-links" :aria-label="tr('Vermögensbereiche')">
    <UButton href="#aufzeichnungen" variant="outline" color="neutral">{{ tr('Aufzeichnungen') }}</UButton>
    <UButton href="#reserve" variant="outline" color="neutral">{{ tr('Reserve') }}</UButton>
    <UButton href="#demo-depot" variant="ghost" color="neutral">{{ tr('Demo-Depot') }}</UButton>
  </nav>
  <div class="wealth-layout">
    <div id="aufzeichnungen" class="wealth-anchor"><RecordedWealth /></div>
    <aside id="reserve" class="wealth-anchor" :aria-label="tr('Reserve-Einstellungen')"><ReserveGoalTile /></aside>
  </div>
  <div id="demo-depot" class="wealth-demo wealth-anchor"><DemoPortfolio /></div>
</template>

<style scoped>
.wealth-links {
  margin-bottom: 24px;
}
.wealth-layout {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.wealth-layout > * {
  min-width: 0;
}
.wealth-anchor {
  scroll-margin-top: 136px;
}
.wealth-demo {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--finance-line);
}
@media (max-width: 1100px) {
  .wealth-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
}
@media (max-width: 700px) {
  .wealth-heading {
    flex-wrap: wrap;
    gap: 8px;
  }
  .wealth-anchor {
    scroll-margin-top: 82px;
  }
}
</style>
