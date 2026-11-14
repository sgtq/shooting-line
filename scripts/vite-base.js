export function getBasePath(appPath = '') {
  const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]
  const siteBase =
    process.env.VITE_BASE_PATH || (process.env.GITHUB_ACTIONS && repositoryName ? `/${repositoryName}/` : '/')
  const normalizedBase = siteBase.endsWith('/') ? siteBase : `${siteBase}/`
  const normalizedAppPath = appPath.replace(/^\/+|\/+$/g, '')

  return normalizedAppPath ? `${normalizedBase}${normalizedAppPath}/` : normalizedBase
}
