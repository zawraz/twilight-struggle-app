import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useWakeLock } from './useWakeLock'

function fakeLock() {
  const sentinel = { released: false, release: vi.fn(async () => void (sentinel.released = true)) }
  return sentinel
}

const setVisibility = (state: DocumentVisibilityState) =>
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })

afterEach(() => {
  setVisibility('visible')
  // @ts-expect-error: the test's own wake lock, removed again
  delete navigator.wakeLock
})

describe('useWakeLock', () => {
  it('keeps the screen on, and takes the lock again when the app comes back to the front', async () => {
    const locks: ReturnType<typeof fakeLock>[] = []
    const request = vi.fn(async () => {
      const lock = fakeLock()
      locks.push(lock)
      return lock
    })
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } })

    const { unmount } = renderHook(() => useWakeLock())
    await act(async () => {})
    expect(request).toHaveBeenCalledWith('screen')

    // Hidden, the browser lets go of the lock; back in front, it is asked for again.
    locks[0].released = true
    setVisibility('hidden')
    await act(async () => void document.dispatchEvent(new Event('visibilitychange')))
    expect(request).toHaveBeenCalledTimes(1)
    setVisibility('visible')
    await act(async () => void document.dispatchEvent(new Event('visibilitychange')))
    expect(request).toHaveBeenCalledTimes(2)

    unmount()
    expect(locks[1].release).toHaveBeenCalled()
  })

  it('runs on without a wake lock, or when it is refused', async () => {
    renderHook(() => useWakeLock())
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request: vi.fn(async () => Promise.reject(new Error('NotAllowedError'))) },
    })
    renderHook(() => useWakeLock())
    await act(async () => {})
  })
})
