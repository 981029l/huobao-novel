// Copyright (c) 2026 左岚. All rights reserved.
import localforage from 'localforage'

// Configure localforage
localforage.config({
    driver: localforage.INDEXEDDB, // Force IndexedDB
    name: 'huobao_novel_generator',
    version: 1.0,
    storeName: 'novel_data',
    description: 'Storage for novel generator application'
})

export const storage = {
    /**
     * Get item from storage
     * @param {string} key 
     * @param {any} defaultValue 
     */
    async getItem(key, defaultValue = null) {
        try {
            const value = await localforage.getItem(key)
            return value !== null ? value : defaultValue
        } catch (err) {
            console.error(`Storage getItem error: ${err}`)
            return defaultValue
        }
    },

    /**
     * Set item in storage
     * @param {string} key 
     * @param {any} value 
     */
    async setItem(key, value) {
        try {
            await localforage.setItem(key, value)
            return true
        } catch (err) {
            console.error(`Storage setItem error: ${err}`)
            return false
        }
    },

    /**
     * Remove item from storage
     * @param {string} key 
     */
    async removeItem(key) {
        try {
            await localforage.removeItem(key)
            return true
        } catch (err) {
            console.error(`Storage removeItem error: ${err}`)
            return false
        }
    },

    /**
     * Clear all storage
     */
    async clear() {
        try {
            await localforage.clear()
            return true
        } catch (err) {
            console.error(`Storage clear error: ${err}`)
            return false
        }
    },

    /**
     * Migrate data from localStorage to IndexedDB
     * @param {string} key 
     */
    async migrateFromLocalStorage(key) {
        try {
            // Check if data exists in IndexedDB already
            const dbData = await localforage.getItem(key)
            if (dbData !== null) {
                // Data already exists in DB, verified.
                return dbData
            }

            // Check localStorage
            const localDataRaw = localStorage.getItem(key)
            if (localDataRaw) {
                try {
                    const localData = JSON.parse(localDataRaw)
                    // Save to IndexedDB
                    await localforage.setItem(key, localData)
                    console.log(`Migrated ${key} from localStorage to IndexedDB`)

                    // Mark as migrated by renaming the localStorage key
                    // This prevents future "zombie data" loading if IndexedDB has issues
                    localStorage.setItem(`migrated_${key}`, localDataRaw)
                    localStorage.removeItem(key)

                    return localData
                } catch (e) {
                    console.error(`Migration parse error for ${key}:`, e)
                }
            }
            return null
        } catch (err) {
            console.error(`Storage migration error: ${err}`)
            return null
        }
    }
}

export default storage
