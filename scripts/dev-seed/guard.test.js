// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { getProjectRef, isStrongPassword, readSeedConfig } from './guard.js'

const DEV_ID = 'devprojectid1234'
const PRD_ID = 'prdprojectid5678'
const STRONG_PASSWORD = 'Str0ng!Seed-Pass'

function validEnv(overrides = {}) {
  return {
    PAGES_DEV_SUPABASE_URL: `https://${DEV_ID}.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    SEED_USER_PASSWORD: STRONG_PASSWORD,
    SUPABASE_PROJECT_ID: DEV_ID,
    PAGES_PRD_SUPABASE_URL: `https://${PRD_ID}.supabase.co`,
    ...overrides,
  }
}

describe('getProjectRef', () => {
  it('reads the project id from a hosted URL', () => {
    expect(getProjectRef(`https://${DEV_ID}.supabase.co`)).toBe(DEV_ID)
  })

  it.each(['http://abc.supabase.co', 'https://abc.supabase.co.evil.com', 'https://localhost:54321', 'nope', ''])(
    'rejects %s',
    (url) => {
      expect(getProjectRef(url)).toBeNull()
    },
  )
})

describe('isStrongPassword', () => {
  it('accepts a long mixed password', () => {
    expect(isStrongPassword(STRONG_PASSWORD)).toBe(true)
  })

  it.each(['Sh0rt!a', 'alllowercase1234!', 'ALLUPPERCASE1234!', 'NoDigitsHere!!!!', 'NoSymbolsHere1234'])(
    'rejects %s',
    (password) => {
      expect(isStrongPassword(password)).toBe(false)
    },
  )
})

describe('readSeedConfig', () => {
  it('returns the settings for the development project', () => {
    expect(readSeedConfig(validEnv())).toEqual({
      url: `https://${DEV_ID}.supabase.co`,
      serviceRoleKey: 'service-key',
      password: STRONG_PASSWORD,
      projectRef: DEV_ID,
    })
  })

  it('works when the production id is not configured', () => {
    expect(readSeedConfig(validEnv({ PAGES_PRD_SUPABASE_URL: undefined })).projectRef).toBe(DEV_ID)
  })

  it('lists every missing variable', () => {
    expect(() => readSeedConfig({})).toThrow(
      'PAGES_DEV_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_USER_PASSWORD, SUPABASE_PROJECT_ID',
    )
  })

  it('refuses the production project', () => {
    const env = validEnv({ PAGES_DEV_SUPABASE_URL: `https://${PRD_ID}.supabase.co` })
    expect(() => readSeedConfig(env)).toThrow('production')
  })

  it('refuses when the development id is set to the production id', () => {
    const env = validEnv({ SUPABASE_PROJECT_ID: PRD_ID, PAGES_DEV_SUPABASE_URL: `https://${PRD_ID}.supabase.co` })
    expect(() => readSeedConfig(env)).toThrow('production')
  })

  it('refuses a production URL it cannot read', () => {
    const env = validEnv({ PAGES_PRD_SUPABASE_URL: 'not a url' })
    expect(() => readSeedConfig(env)).toThrow('PAGES_PRD_SUPABASE_URL')
  })

  it('refuses any project that is not the development one', () => {
    const env = validEnv({ PAGES_DEV_SUPABASE_URL: 'https://someotherproject.supabase.co' })
    expect(() => readSeedConfig(env)).toThrow('does not match SUPABASE_PROJECT_ID')
  })

  it('refuses a URL that is not a hosted project', () => {
    expect(() => readSeedConfig(validEnv({ PAGES_DEV_SUPABASE_URL: 'http://localhost:54321' }))).toThrow(
      'hosted Supabase',
    )
  })

  it('refuses a weak password', () => {
    expect(() => readSeedConfig(validEnv({ SEED_USER_PASSWORD: 'password' }))).toThrow('SEED_USER_PASSWORD')
  })
})
