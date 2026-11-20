/** @returns {string} A new random id for a record created in the browser. */
export function makeId() {
  return crypto.randomUUID()
}
