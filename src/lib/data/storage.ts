import type { Session } from '../domain/types'

let database: Promise<IDBDatabase> | undefined
function openDatabase(): Promise<IDBDatabase> {
  if (!database)
    database = new Promise((resolve, reject) => {
      // Keep the original database name so the rebrand preserves local sessions.
      const request = indexedDB.open('trueflight', 1)
      request.onupgradeneeded = () =>
        request.result.createObjectStore('sessions', { keyPath: 'id' })
      request.onsuccess = () => {
        const db = request.result
        db.onversionchange = () => {
          db.close()
          database = undefined
        }
        resolve(db)
      }
      request.onerror = () => {
        database = undefined
        reject(request.error)
      }
      request.onblocked = () => {
        database = undefined
        reject(new Error('Close other ShotQuiver tabs and retry.'))
      }
    })
  return database
}

export async function loadSessions(): Promise<Session[]> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = db.transaction('sessions').objectStore('sessions').getAll()
    request.onsuccess = () =>
      resolve(
        request.result.sort((a: Session, b: Session) =>
          b.updatedAt.localeCompare(a.updatedAt)
        )
      )
    request.onerror = () => reject(request.error)
  })
}

// Imports are a single atomic transaction. Existing local IDs win, so a backup
// cannot silently overwrite a newer practice session.
export async function saveSessions(
  sessions: Session[],
  onlyNew = false
): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sessions', 'readwrite')
    const store = tx.objectStore('sessions')
    for (const session of sessions) {
      if (!onlyNew) store.put(session)
      else {
        const request = store.getKey(session.id)
        request.onsuccess = () => {
          if (request.result === undefined) store.add(session)
        }
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('Saving was interrupted.'))
  })
}

export async function deleteSession(id: string): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sessions', 'readwrite')
    tx.objectStore('sessions').delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
