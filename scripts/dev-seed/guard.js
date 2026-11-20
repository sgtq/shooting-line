const HOSTED_HOST = /^([a-z0-9-]+)\.supabase\.co$/
const MIN_PASSWORD_LENGTH = 12

/**
 * Reads the project reference from a hosted Supabase URL such as https://abcd.supabase.co.
 * @param {string} url
 * @returns {string | null} The reference, or null when the URL is not a hosted Supabase project.
 */
export function getProjectRef(url) {
  try {
    const { protocol, hostname } = new URL(url)
    const match = protocol === 'https:' ? HOSTED_HOST.exec(hostname) : null
    return match ? match[1] : null
  } catch {
    return null
  }
}

/**
 * The seed password creates real sign-ins, so it must be strong even on a dev project.
 * @param {string} password
 * @returns {boolean}
 */
export function isStrongPassword(password) {
  return (
    password.length >= MIN_PASSWORD_LENGTH &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  )
}

/**
 * Checks the environment and returns the seed settings. It throws unless the target is the development
 * project, so a wrong URL or key can never reach production.
 * @param {Record<string, string | undefined>} env
 * @returns {{ url: string, serviceRoleKey: string, password: string, projectRef: string }}
 */
export function readSeedConfig(env) {
  // The URL and the project id are separate values on purpose: the run only goes ahead when they agree.
  const url = (env.PAGES_DEV_SUPABASE_URL ?? '').trim()
  const serviceRoleKey = (env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  const password = env.SEED_USER_PASSWORD ?? ''
  const devProjectId = (env.SUPABASE_PROJECT_ID ?? '').trim()
  const prodUrl = (env.PAGES_PRD_SUPABASE_URL ?? '').trim()

  const missing = [
    ['PAGES_DEV_SUPABASE_URL', url],
    ['SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey],
    ['SEED_USER_PASSWORD', password],
    ['SUPABASE_PROJECT_ID', devProjectId],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name)
  if (missing.length) {
    throw new Error(`Set these variables before seeding: ${missing.join(', ')}.`)
  }

  const projectRef = getProjectRef(url)
  if (!projectRef) {
    throw new Error('PAGES_DEV_SUPABASE_URL must be a hosted Supabase project URL (https://<project-id>.supabase.co).')
  }
  // A production URL that cannot be read is refused, because a skipped check could let production through.
  const prodRef = prodUrl ? getProjectRef(prodUrl) : null
  if (prodUrl && !prodRef) {
    throw new Error('PAGES_PRD_SUPABASE_URL must be a hosted Supabase project URL, or be left empty.')
  }
  if (prodRef && (projectRef === prodRef || devProjectId === prodRef)) {
    throw new Error('Refusing to run: the target matches the production project.')
  }
  if (projectRef !== devProjectId) {
    throw new Error('Refusing to run: PAGES_DEV_SUPABASE_URL does not match SUPABASE_PROJECT_ID.')
  }
  if (!isStrongPassword(password)) {
    throw new Error(
      `SEED_USER_PASSWORD must have at least ${MIN_PASSWORD_LENGTH} characters with upper case, lower case, ` +
        'a digit, and a symbol.',
    )
  }

  return { url, serviceRoleKey, password, projectRef }
}
