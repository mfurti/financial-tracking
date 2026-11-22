<script setup lang="ts">
import { z } from 'zod';
import * as c from '@financial-tracking/contracts';
import { userErrorMessage } from '../utils/api-error';
import { editableEuro, euroCents } from '../utils/euro-input';
import { budgetBalance, type BudgetList, type CategoryBudget } from '../utils/category-budget';

const props = defineProps<{
  month: string;
  showAllAccounts: boolean;
  budgetList: BudgetList;
  refreshBudgets: () => Promise<void>;
}>();
const api = useApi();
const budgets = computed(() => (props.budgetList.state === 'ready' ? props.budgetList.budgets : []));
const open = ref(false);
const mode = ref<'create' | 'detail' | 'edit'>('create');
const selected = ref<CategoryBudget>();
const categories = ref<c.Category[]>([]);
const loadingCategories = ref(false);
const categoryError = ref('');
const saving = ref(false);
const formError = ref('');
const fieldError = ref('');
const confirmRemoval = ref(false);
const categoryId = ref<string>();
const euros = ref('');
const addButton = useTemplateRef('addButton');
let trigger: HTMLElement | null = null;
const categoryOptions = computed(() =>
  categories.value
    .filter(
      (category) =>
        category.isActive &&
        category.kind !== 'INCOME' &&
        !budgets.value.some((budget) => budget.categoryId === category.id),
    )
    .map((category) => ({ label: category.name, value: category.id })),
);
const title = computed(() =>
  mode.value === 'create'
    ? tr('Budget anlegen')
    : mode.value === 'edit'
      ? tr('Budget bearbeiten')
      : (selected.value?.categoryName ?? tr('Kategorie-Budgets')),
);

function budgetStatus(budget: CategoryBudget) {
  const remaining = budgetBalance(budget);
  return remaining < 0n ? tr('{0} über Budget', [money(-remaining)]) : tr('{0} übrig', [money(remaining)]);
}

function progress(budget: CategoryBudget) {
  const limit = BigInt(budget.limitCents);
  const spent = BigInt(budget.spentCents);
  return spent >= limit ? 100 : Number((spent * 10_000n) / limit) / 100;
}

async function loadCategories() {
  loadingCategories.value = true;
  categoryError.value = '';
  try {
    categories.value = await api.request('/categories', z.array(c.categorySchema));
  } catch (cause) {
    categoryError.value = userErrorMessage(cause);
  } finally {
    loadingCategories.value = false;
  }
}

function begin(budget?: CategoryBudget) {
  trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  selected.value = budget;
  mode.value = budget ? 'detail' : 'create';
  formError.value = '';
  fieldError.value = '';
  confirmRemoval.value = false;
  categoryId.value = undefined;
  euros.value = '';
  open.value = true;
  if (!budget) void loadCategories();
}

function edit() {
  if (!selected.value) return;
  categoryId.value = selected.value.categoryId;
  euros.value = amountsMasked() ? '' : editableEuro(selected.value.limitCents);
  mode.value = 'edit';
}

function restoreFocus() {
  if (trigger?.isConnected && trigger !== document.body) trigger.focus({ preventScroll: true });
  else addButton.value?.$el.focus({ preventScroll: true });
}

async function save() {
  if (saving.value || !categoryId.value) return;
  formError.value = '';
  fieldError.value = '';
  let limitCents: string;
  try {
    limitCents = c.positiveCentsSchema.parse(euroCents(euros.value));
  } catch {
    fieldError.value = tr('Gib ein gültiges Budget über 0 € ein.');
    return;
  }
  saving.value = true;
  try {
    await api.request('/budgets', c.categoryBudgetSchema, {
      method: 'PUT',
      body: c.categoryBudgetInputSchema.parse({ month: props.month, categoryId: categoryId.value, limitCents }),
    });
    await props.refreshBudgets();
    open.value = false;
  } catch (cause) {
    formError.value = userErrorMessage(cause);
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (!selected.value || saving.value) return;
  saving.value = true;
  formError.value = '';
  try {
    await api.request(`/budgets/${selected.value.id}`, c.okSchema, {
      method: 'DELETE',
      body: { confirm: true },
    });
    await props.refreshBudgets();
    open.value = false;
  } catch (cause) {
    formError.value = userErrorMessage(cause);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <SectionPanel :title="tr('Kategorie-Budgets')" compact bare>
    <template #actions>
      <span v-if="showAllAccounts" class="muted budget-scope">{{ tr('Alle Konten') }}</span>
      <UButton
        ref="addButton"
        type="button"
        size="sm"
        variant="soft"
        :disabled="budgetList.state !== 'ready'"
        @click="begin()"
        >{{ tr('Budget anlegen') }}</UButton
      >
    </template>
    <p v-if="budgetList.state === 'loading'" role="status" class="muted">{{ tr('Wird geladen …') }}</p>
    <div v-else-if="budgetList.state === 'error'">
      <UAlert role="alert" color="error" :description="budgetList.message" />
      <UButton variant="soft" class="mt-2" @click="refreshBudgets">{{ tr('Erneut versuchen') }}</UButton>
    </div>
    <p v-else-if="!budgets.length" class="muted">{{ tr('Für diesen Monat gibt es noch keine Budgets.') }}</p>
    <div v-else class="budget-grid">
      <FinanceTile
        v-for="budget in budgets"
        :key="budget.id"
        :label="budget.categoryName"
        :value="tr('{0} von {1}', [money(budget.spentCents), money(budget.limitCents)])"
        variant="stat"
        financial
        actionable
        @activate="begin(budget)"
      >
        <template #context>
          <span
            v-if="!amountsMasked()"
            class="budget-meter"
            :class="{ 'budget-meter--over': budgetBalance(budget) < 0n }"
          >
            <progress :value="progress(budget)" max="100" :aria-label="tr('Budgetverbrauch')" />
            <span>{{ budgetStatus(budget) }}</span>
          </span>
        </template>
      </FinanceTile>
    </div>
  </SectionPanel>

  <FinanceDialog
    v-model:open="open"
    :title="title"
    :description="monthName(month)"
    :dismissible="!saving"
    @after:leave="restoreFocus"
  >
    <UAlert v-if="formError" role="alert" color="error" :description="formError" class="mb-3" />
    <template v-if="mode === 'detail' && selected">
      <div class="budget-dialog-summary">
        <strong data-financial>
          {{
            amountsMasked()
              ? tr('Betrag ausgeblendet')
              : tr('{0} von {1}', [money(selected.spentCents), money(selected.limitCents)])
          }}
        </strong>
        <small v-if="!amountsMasked()" :class="budgetBalance(selected) < 0n ? 'negative' : 'muted'" data-financial>
          {{ budgetStatus(selected) }}
        </small>
      </div>
      <BudgetBookings :month="month" :category-id="selected.categoryId" />
    </template>
    <template v-else>
      <p v-if="loadingCategories" role="status" class="muted">{{ tr('Wird geladen …') }}</p>
      <div v-else-if="mode === 'create' && categoryError">
        <UAlert role="alert" color="error" :description="categoryError" />
        <UButton variant="soft" class="mt-2" @click="loadCategories">{{ tr('Erneut versuchen') }}</UButton>
      </div>
      <p v-else-if="mode === 'create' && !categoryOptions.length" class="muted">
        {{ tr('Für diesen Monat sind keine weiteren Ausgabenkategorien verfügbar.') }}
      </p>
      <form v-else class="budget-form" @submit.prevent="save">
        <UFormField v-if="mode === 'create'" :label="tr('Kategorie')">
          <ChoiceSelect
            v-model="categoryId"
            :items="categoryOptions"
            :placeholder="tr('Kategorie wählen')"
            :aria-label="tr('Kategorie')"
            :portal="false"
          />
        </UFormField>
        <UFormField :label="tr('Monatslimit in Euro')" :error="fieldError || undefined">
          <UInput v-model="euros" required inputmode="decimal" :disabled="saving" class="w-full" />
        </UFormField>
        <div class="toolbar">
          <UButton type="submit" :loading="saving" :disabled="!categoryId">{{ tr('Speichern') }}</UButton>
          <UButton variant="ghost" :disabled="saving" @click="mode === 'edit' ? (mode = 'detail') : (open = false)">
            {{ tr('Abbrechen') }}
          </UButton>
        </div>
      </form>
    </template>
    <template v-if="mode === 'detail'" #footer>
      <div v-if="confirmRemoval" class="toolbar">
        <span>{{ tr('Budget für diesen Monat löschen?') }}</span>
        <UButton color="error" :loading="saving" @click="remove">{{ tr('Löschen') }}</UButton>
        <UButton variant="ghost" :disabled="saving" @click="confirmRemoval = false">{{ tr('Abbrechen') }}</UButton>
      </div>
      <div v-else class="toolbar">
        <UButton variant="soft" @click="edit">{{ tr('Bearbeiten') }}</UButton>
        <UButton variant="ghost" color="error" @click="confirmRemoval = true">{{ tr('Budget löschen') }}</UButton>
      </div>
    </template>
  </FinanceDialog>
</template>

<style scoped>
.budget-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 230px), 1fr));
  gap: var(--finance-tile-gap);
}
.budget-meter {
  display: grid;
  gap: 6px;
  margin-top: 8px;
}
.budget-meter progress {
  inline-size: 100%;
  block-size: 7px;
  accent-color: var(--accent);
}
.budget-meter--over {
  color: var(--negative);
}
.budget-meter--over progress {
  accent-color: var(--negative);
}
.budget-scope {
  font-size: 12px;
}
.budget-form,
.budget-dialog-summary {
  display: grid;
  gap: 8px;
}
.budget-dialog-summary {
  margin-bottom: 14px;
}
</style>
