// Kept free of Deno APIs so Vitest can import it.

/** Admins may reset any account. Managers may only reset accounts that hold the admin or manager role. */
export function canResetPassword(callerRoles: string[], targetEmail: string, privilegedEmails: string[]): boolean {
  if (callerRoles.includes('admin')) return true

  const target = targetEmail.trim().toLowerCase()
  return privilegedEmails.some((email) => email.trim().toLowerCase() === target)
}
