import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToast } from './useToast'

describe('useToast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('shows a message and clears it after a short time', () => {
    const { toast, notify } = useToast()
    notify('Saved')
    expect(toast.value).not.toBe('')
    vi.advanceTimersByTime(2800)
    expect(toast.value).toBe('')
  })

  it('keeps a newer message when an older timer ends', () => {
    const { toast, notify } = useToast()
    notify('First')
    vi.advanceTimersByTime(2000)
    notify('Second')
    vi.advanceTimersByTime(1000)
    expect(toast.value).toBe('Second')
    vi.advanceTimersByTime(2000)
    expect(toast.value).toBe('')
  })
})
