/**
 * A drag-select ends in a click on the card. Skipping the action lets the user copy the selected text.
 * @param {() => void} action What to do when the user simply clicked.
 * @returns {void}
 */
export function runUnlessSelecting(action) {
  if (window.getSelection()?.toString()) return
  action()
}
