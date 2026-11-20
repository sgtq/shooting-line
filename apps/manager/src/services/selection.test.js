import { afterEach, describe, expect, it, vi } from 'vitest'
import { runUnlessSelecting } from './selection'

afterEach(() => vi.restoreAllMocks())

describe('runUnlessSelecting', () => {
  it('runs the action when nothing is selected', () => {
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => '' })
    const action = vi.fn()
    runUnlessSelecting(action)
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('skips the action while text is selected', () => {
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'copied text' })
    const action = vi.fn()
    runUnlessSelecting(action)
    expect(action).not.toHaveBeenCalled()
  })

  it('runs the action when the browser gives no selection object', () => {
    vi.spyOn(window, 'getSelection').mockReturnValue(null)
    const action = vi.fn()
    runUnlessSelecting(action)
    expect(action).toHaveBeenCalledTimes(1)
  })
})
