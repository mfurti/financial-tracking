import type { Transaction } from './generated/prisma/client.js';
import { AppError } from './errors.js';

/** Preserve user-owned metadata when two source identities become one transaction. */
export function mergeAnnotations(
  source: Transaction,
  candidate: Transaction,
  choices: { categoryChoice?: 'CSV' | 'BANK'; classificationChoice?: 'CSV' | 'BANK' },
) {
  const sourceManual =
    source.categoryOrigin === 'MANUAL' || (source.categoryOrigin === 'NONE' && source.categoryId !== null);
  const targetManual =
    candidate.categoryOrigin === 'MANUAL' || (candidate.categoryOrigin === 'NONE' && candidate.categoryId !== null);
  if (sourceManual && targetManual && source.categoryId !== candidate.categoryId && !choices.categoryChoice)
    throw new AppError(
      'ANNOTATION_CONFLICT',
      'Unterschiedliche manuelle Kategorien, einschließlich leerer Auswahl: Quelle ausdrücklich wählen.',
      409,
    );
  if (
    source.classification &&
    candidate.classification &&
    source.classification !== candidate.classification &&
    !choices.classificationChoice
  )
    throw new AppError('ANNOTATION_CONFLICT', 'Fix/Variabel unterscheidet sich. Quelle ausdrücklich wählen.', 409);
  const category =
    choices.categoryChoice === 'CSV'
      ? source
      : choices.categoryChoice === 'BANK'
        ? candidate
        : sourceManual && !targetManual
          ? source
          : targetManual
            ? candidate
            : candidate.categoryId
              ? candidate
              : source;
  const classification =
    choices.classificationChoice === 'CSV'
      ? source.classification
      : choices.classificationChoice === 'BANK'
        ? candidate.classification
        : (candidate.classification ?? source.classification);
  return {
    categoryId: category.categoryId,
    categoryOrigin:
      (sourceManual && category === source) || (targetManual && category === candidate)
        ? 'MANUAL'
        : category.categoryOrigin,
    categoryRuleId: category.categoryRuleId,
    categoryRuleName: category.categoryRuleName,
    categoryRuleConflict: category.categoryRuleConflict,
    classification,
  };
}
