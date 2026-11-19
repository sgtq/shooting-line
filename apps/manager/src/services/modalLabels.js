import { t } from '@shooting-line/i18n'

/**
 * @typedef {'club'|'tournament'|'tournamentDates'|'tournamentType'|'category'|'userRole'|'profile'|'participant'} ModalType
 */

/**
 * @param {ModalType} type
 * @returns {string} The small heading above the title.
 */
function eyebrowFor(type) {
  switch (type) {
    case 'club':
      return t('CLUB DIRECTORY')
    case 'tournament':
    case 'tournamentDates':
    case 'tournamentType':
      return t('EVENT MANAGEMENT')
    case 'category':
      return t('CATEGORY DIRECTORY')
    case 'userRole':
      return t('SYSTEM SETTINGS')
    case 'profile':
      return t('ACCOUNT PROFILE')
    default:
      return t('ARCHER DIRECTORY')
  }
}

/**
 * @param {ModalType} type
 * @param {boolean} editing Whether an existing record is open, for the types that can be edited.
 * @returns {string} The dialog title.
 */
function titleFor(type, editing) {
  switch (type) {
    case 'club':
      return editing ? t('Edit club') : t('Add a club')
    case 'tournament':
      return t('Create tournament')
    case 'tournamentDates':
      return t('Edit tournament dates')
    case 'tournamentType':
      return editing ? t('Edit tournament type') : t('Create tournament type')
    case 'category':
      return editing ? t('Edit category') : t('Create category')
    case 'userRole':
      return t('Add manager')
    case 'profile':
      return t('Edit profile')
    default:
      return editing ? t('Edit archer') : t('Add archer')
  }
}

/**
 * @param {ModalType} type
 * @param {boolean} editing
 * @param {boolean} hasMatch Whether an existing archer was picked instead of creating a new one.
 * @returns {string} The label of the save button.
 */
function submitFor(type, editing, hasMatch) {
  switch (type) {
    case 'club':
      return editing ? t('Save changes') : t('Save club')
    case 'tournament':
      return t('Create tournament')
    case 'tournamentDates':
      return t('Save dates')
    case 'tournamentType':
      return editing ? t('Save type') : t('Create type')
    case 'category':
      return editing ? t('Save category') : t('Create category')
    case 'userRole':
      return t('Add manager')
    case 'profile':
      return t('Save profile')
    default:
      if (editing) return t('Save changes')
      return hasMatch ? t('Add to tournament') : t('Save archer')
  }
}

/**
 * @param {ModalType} type
 * @param {{ editing?: boolean, hasMatch?: boolean, hasParentForm?: boolean }} [state] `editing` is true when an
 * existing record is open. `hasParentForm` is true when the dialog was opened from inside another one.
 * @returns {{ eyebrow: string, title: string, submit: string, cancel: string }} The texts of the dialog.
 */
export function modalLabels(type, { editing = false, hasMatch = false, hasParentForm = false } = {}) {
  return {
    eyebrow: eyebrowFor(type),
    title: titleFor(type, editing),
    submit: submitFor(type, editing, hasMatch),
    cancel: hasParentForm ? t('Back') : t('Cancel'),
  }
}
