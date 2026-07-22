const DB_NAME = 'agnes_agent_canvas'
const DB_VERSION = 1
const ASSETS_STORE = 'assets'
const MAX_SAVED_ASSETS = 160

function openDatabase() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available'))
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(ASSETS_STORE)) {
        const store = db.createObjectStore(ASSETS_STORE, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt')
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'))
  })
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'))
  })
}

async function pruneAssets(db) {
  const readTransaction = db.transaction(ASSETS_STORE, 'readonly')
  const assets = await requestToPromise(readTransaction.objectStore(ASSETS_STORE).getAll())
  const sorted = assets.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  const extraAssets = sorted.slice(MAX_SAVED_ASSETS)

  if (!extraAssets.length) return

  const writeTransaction = db.transaction(ASSETS_STORE, 'readwrite')
  const store = writeTransaction.objectStore(ASSETS_STORE)
  extraAssets.forEach((asset) => store.delete(asset.id))
  await new Promise((resolve, reject) => {
    writeTransaction.oncomplete = resolve
    writeTransaction.onerror = () => reject(writeTransaction.error || new Error('Asset prune failed'))
  })
}

export async function getSavedAssets() {
  try {
    const db = await openDatabase()
    const transaction = db.transaction(ASSETS_STORE, 'readonly')
    const assets = await requestToPromise(transaction.objectStore(ASSETS_STORE).getAll())
    return assets.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  } catch {
    return []
  }
}

export async function saveSavedAsset(asset) {
  try {
    const db = await openDatabase()
    const transaction = db.transaction(ASSETS_STORE, 'readwrite')
    transaction.objectStore(ASSETS_STORE).put(asset)
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve
      transaction.onerror = () => reject(transaction.error || new Error('Asset save failed'))
    })
    await pruneAssets(db)
    return true
  } catch {
    return false
  }
}

export async function saveSavedAssets(assets) {
  try {
    const db = await openDatabase()
    const transaction = db.transaction(ASSETS_STORE, 'readwrite')
    const store = transaction.objectStore(ASSETS_STORE)
    assets.forEach((asset) => store.put(asset))
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve
      transaction.onerror = () => reject(transaction.error || new Error('Assets save failed'))
    })
    await pruneAssets(db)
    return true
  } catch {
    return false
  }
}

export async function deleteSavedAsset(assetId) {
  try {
    const db = await openDatabase()
    const transaction = db.transaction(ASSETS_STORE, 'readwrite')
    transaction.objectStore(ASSETS_STORE).delete(assetId)
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve
      transaction.onerror = () => reject(transaction.error || new Error('Asset delete failed'))
    })
    return true
  } catch {
    return false
  }
}
