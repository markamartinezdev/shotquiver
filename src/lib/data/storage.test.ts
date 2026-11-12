import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createSession } from '../domain/scoring'
import { deleteSession, loadSessions, saveSessions } from './storage'

describe('IndexedDB repository', () => {
  it('persists updates, merges imports without overwrites, and deletes sessions', async () => {
    const a = createSession()
    a.notes = 'Original local session'
    await saveSessions([a])
    expect((await loadSessions()).find((s) => s.id === a.id)?.notes).toBe(
      a.notes
    )
    const b = createSession()
    await saveSessions([{ ...a, notes: 'Old imported copy' }, b], true)
    const loaded = await loadSessions()
    expect(loaded).toHaveLength(2)
    expect(loaded.find((s) => s.id === a.id)?.notes).toBe(
      'Original local session'
    )
    a.notes = 'Updated locally'
    await saveSessions([a])
    expect((await loadSessions()).find((s) => s.id === a.id)?.notes).toBe(
      'Updated locally'
    )
    await deleteSession(a.id)
    await deleteSession(b.id)
    expect(await loadSessions()).toEqual([])
  })
})
