export default defineAppConfig({
  ui: {
    colors: { primary: 'emerald', neutral: 'zinc' },
    card: {
      slots: {
        root: 'bg-[var(--finance-surface)] rounded-[var(--finance-surface-radius)] ring-0 shadow-none',
      },
    },
    modal: {
      slots: {
        overlay: 'bg-[var(--finance-overlay)] backdrop-blur-[5px]',
        content:
          'bg-[var(--finance-surface)] text-[var(--ink)] rounded-[var(--finance-dialog-radius)] ring-1 ring-[var(--line)]',
      },
    },
  },
});
