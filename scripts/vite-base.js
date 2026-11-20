/**
 * Builds the Vite `base` for an app. The site is served from the domain root unless
 * `VITE_BASE_PATH` says otherwise (for example a GitHub Pages project site).
 * @param {string} [appPath] Sub-path of the app under the site base, such as `manager`.
 * @returns {string} A base path that starts and ends with `/`.
 */
export function getBasePath(appPath = '') {
  const siteBase = process.env.VITE_BASE_PATH || '/'
  const normalizedBase = siteBase.endsWith('/') ? siteBase : `${siteBase}/`
  const normalizedAppPath = appPath.replace(/^\/+|\/+$/g, '')

  return normalizedAppPath ? `${normalizedBase}${normalizedAppPath}/` : normalizedBase
}
