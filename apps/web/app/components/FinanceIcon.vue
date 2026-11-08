<script setup lang="ts">
const paths = {
  calendar: 'M4 5h16v16H4Zm0 5h16M8 3v4m8-4v4',
  contracts: 'M6 3h12v18H6Zm3 5h6m-6 4h6m-6 4h4',
  home: 'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  transactions: 'M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4',
  categories: 'M4 20h16M7 16v-5m5 5V4m5 12V8',
  upload: 'M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5',
  accounts: 'M3 6h18v14H3Zm0 3h18m-5 5h2M4 6V4h15v2',
  bank: 'm3 8 9-5 9 5H3Zm2 3v7m5-7v7m4-7v7m5-7v7M3 21h18',
  history: 'M12 8v5l3 2M3 10a9 9 0 1 1 1 7M3 4v6h6',
  settings:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM9.5 2.5h5l.6 2.5 2 .9 2.3-.8 2.5 4.3-1.7 1.8v2.6l1.7 1.8-2.5 4.3-2.3-.8-2 .9-.6 2.5h-5l-.6-2.5-2-.9-2.3.8-2.5-4.3 1.7-1.8v-2.6L2.6 9.4l2.5-4.3 2.3.8 2-.9.6-2.5Z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
} as const;
defineProps<{ name: keyof typeof paths }>();
</script>

<template>
  <svg
    class="finance-icon"
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path :d="paths[name]" />
  </svg>
</template>
