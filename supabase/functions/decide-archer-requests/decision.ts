// Kept free of Deno APIs so Vitest can import it.

export type DecisionAction = 'approve' | 'reject'

export type DecisionRequest = { action: DecisionAction; requestIds: string[] }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// One call can decide a whole club, but the cap keeps a single request from running too long.
export const MAX_REQUESTS_PER_CALL = 100

/** Only admins and managers can decide a request. */
export function canDecide(callerRoles: string[]): boolean {
  return callerRoles.some((role) => role === 'admin' || role === 'manager')
}

export function isValidEmail(email: string): boolean {
  return EMAIL.test(email.trim())
}

/** Returns the checked request, or an error message that is safe to show to the caller. */
export function parseDecision(payload: unknown): DecisionRequest | { error: string } {
  const body = (payload ?? {}) as { action?: unknown; requestIds?: unknown }
  if (body.action !== 'approve' && body.action !== 'reject') {
    return { error: 'The action must be approve or reject' }
  }
  if (!Array.isArray(body.requestIds) || !body.requestIds.length) {
    return { error: 'Choose at least one request' }
  }
  if (body.requestIds.length > MAX_REQUESTS_PER_CALL) {
    return { error: `Decide at most ${MAX_REQUESTS_PER_CALL} requests at a time` }
  }
  if (!body.requestIds.every((id) => typeof id === 'string' && UUID.test(id))) {
    return { error: 'Every request id must be valid' }
  }
  return { action: body.action, requestIds: [...new Set(body.requestIds as string[])] }
}

/** True when an invite failed because the email already has a login. */
export function isAlreadyRegistered(error: { code?: string; status?: number; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === 'email_exists') return true
  return /already (been )?registered|already exists/i.test(error.message ?? '')
}

/** Finds a login by email, ignoring case and surrounding spaces. */
export function findUserByEmail<T extends { email?: string | null }>(users: T[], email: string): T | null {
  const wanted = email.trim().toLowerCase()
  return users.find((user) => (user.email ?? '').trim().toLowerCase() === wanted) ?? null
}
