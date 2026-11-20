import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBasePath } from './vite-base.js'

describe('getBasePath', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('serves from the domain root by default', () => {
    vi.stubEnv('VITE_BASE_PATH', '')

    expect(getBasePath()).toBe('/')
    expect(getBasePath('manager')).toBe('/manager/')
  })

  it('ignores the GitHub repository name when no base is set', () => {
    vi.stubEnv('VITE_BASE_PATH', '')
    vi.stubEnv('GITHUB_ACTIONS', 'true')
    vi.stubEnv('GITHUB_REPOSITORY', 'sgtq/shooting-line')

    expect(getBasePath()).toBe('/')
    expect(getBasePath('manager')).toBe('/manager/')
  })

  it('uses VITE_BASE_PATH as the site base', () => {
    vi.stubEnv('VITE_BASE_PATH', '/shooting-line/develop/')

    expect(getBasePath()).toBe('/shooting-line/develop/')
    expect(getBasePath('manager')).toBe('/shooting-line/develop/manager/')
  })

  it('adds the missing trailing slash to the site base', () => {
    vi.stubEnv('VITE_BASE_PATH', '/shooting-line')

    expect(getBasePath()).toBe('/shooting-line/')
    expect(getBasePath('manager')).toBe('/shooting-line/manager/')
  })

  it('trims slashes around the app path', () => {
    vi.stubEnv('VITE_BASE_PATH', '/')

    expect(getBasePath('/manager/')).toBe('/manager/')
    expect(getBasePath('///')).toBe('/')
  })
})
