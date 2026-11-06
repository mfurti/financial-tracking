/** Seed choices for the initial account; subsequent edits remain user-owned. */
export const defaultCategories = [
  ...[
    'Lebensmittel',
    'Wohnen',
    'Mobilität',
    'Versicherungen',
    'Gesundheit',
    'Freizeit',
    'Shopping',
    'Abonnements',
    'Sonstige Ausgaben',
  ].map(
    /** Add an expense starter category. */ (name, sortOrder) => ({ name, kind: 'EXPENSE', sortOrder, isSystem: true }),
  ),
  ...['Gehalt', 'Erstattung', 'Zinsen', 'Sonstige Einnahmen'].map(
    /** Add an income starter category after expenses. */ (name, index) => ({
      name,
      kind: 'INCOME',
      sortOrder: index + 9,
      isSystem: true,
    }),
  ),
];
