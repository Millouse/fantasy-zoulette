// src/services/liveGameCache.js
//
// Shared cache stored in Firestore so ALL users benefit from the same fetch.
// Only one client will actually call the Riot API per minute per player —
// everyone else just reads the cached Firestore document.
//
// Schema: liveGameCache/{puuid} → { gameData, isLive, fetchedAt, fetchedBy }

import {
  doc, getDoc, setDoc, onSnapshot, collection, getDocs
} from 'firebase/firestore'
import { db } from '../firebase'
import { getLiveGame } from './riot'

const CACHE_TTL_MS = 55_000 // refresh if older than 55s (gives margin before 60s poll)

// In-memory lock to avoid multiple tabs on the same browser racing
const _fetching = new Set()

/**
 * Subscribe to the live game cache for a player.
 * Automatically refreshes if cache is stale (> 55s old).
 * Returns an unsubscribe function.
 *
 * @param {string} puuid
 * @param {string} userId  — used to tag who triggered the fetch
 * @param {function} onUpdate — called with { gameData, isLive, fetchedAt, stale }
 */
export function subscribeLiveGame(puuid, userId, onUpdate) {
  const ref = doc(db, 'liveGameCache', puuid)

  const unsub = onSnapshot(ref, async (snap) => {
    const data = snap.data()
    const now = Date.now()

    if (data) {
      const age = now - data.fetchedAt
      const stale = age > CACHE_TTL_MS

      // Deliver current cache immediately to the UI
      onUpdate({ gameData: data.gameData, isLive: data.isLive, fetchedAt: data.fetchedAt, stale })

      // If stale and no other tab is already fetching this puuid, we do it
      if (stale && !_fetching.has(puuid)) {
        await _doFetch(puuid, userId)
      }
    } else {
      // No cache entry yet — fetch immediately
      onUpdate({ gameData: null, isLive: false, fetchedAt: null, stale: true })
      if (!_fetching.has(puuid)) {
        await _doFetch(puuid, userId)
      }
    }
  })

  return unsub
}

/**
 * Force a refresh for a specific puuid (called on manual Refresh click).
 */
export async function forceRefreshLiveGame(puuid, userId) {
  if (_fetching.has(puuid)) return
  await _doFetch(puuid, userId)
}

/**
 * Force refresh all players in the cache (called from Betting.vue Refresh button).
 */
export async function forceRefreshAll(userId) {
  const snap = await getDocs(collection(db, 'liveGameCache'))
  const puuids = snap.docs.map(d => d.id)
  await Promise.all(puuids.map(puuid => forceRefreshLiveGame(puuid, userId)))
}

// Internal: fetch from Riot API and write to Firestore
async function _doFetch(puuid, userId) {
  _fetching.add(puuid)
  try {
    const game = await getLiveGame(puuid)
    await setDoc(doc(db, 'liveGameCache', puuid), {
      gameData: game ?? null,
      isLive: !!game,
      fetchedAt: Date.now(),
      fetchedBy: userId || 'unknown',
    })
  } catch (e) {
    // On rate limit or error, write a null entry with current time
    // so other clients don't immediately retry
    console.warn(`[liveGameCache] fetch failed for ${puuid}:`, e?.message)
    await setDoc(doc(db, 'liveGameCache', puuid), {
      gameData: null,
      isLive: false,
      fetchedAt: Date.now(),
      fetchedBy: userId || 'unknown',
      error: e?.message || 'unknown error',
    }).catch(() => {})
  } finally {
    _fetching.delete(puuid)
  }
}

/**
 * Start the 60s auto-poll for all tracked players.
 * SINGLETON — safe to call multiple times, only one poller ever runs.
 * Returns a stop function.
 */
let _pollerTimer = null
let _pollerGetPuuids = null
let _pollerUserId = null

export function startLiveGamePoller(getPlayerPuuids, userId) {
  // Update the puuid getter and userId in case players list changed
  _pollerGetPuuids = getPlayerPuuids
  _pollerUserId = userId

  // Already running — don't create another interval
  if (_pollerTimer !== null) {
    console.log('[liveGameCache] Poller already running, skipping restart')
    return stopLiveGamePoller
  }

  async function poll() {
    const puuids = _pollerGetPuuids?.() ?? []
    if (!puuids.length) return

    const now = Date.now()
    await Promise.all(puuids.map(async (puuid) => {
      if (_fetching.has(puuid)) return
      try {
        const snap = await getDoc(doc(db, 'liveGameCache', puuid))
        const data = snap.data()
        if (!data || now - data.fetchedAt > CACHE_TTL_MS) {
          await _doFetch(puuid, _pollerUserId)
        }
      } catch {
        await _doFetch(puuid, _pollerUserId)
      }
    }))
  }

  console.log('[liveGameCache] Poller started')
  poll() // initial poll immediately
  _pollerTimer = setInterval(poll, 60_000)

  return stopLiveGamePoller
}

export function stopLiveGamePoller() {
  if (_pollerTimer !== null) {
    clearInterval(_pollerTimer)
    _pollerTimer = null
    _pollerGetPuuids = null
    _pollerUserId = null
    console.log('[liveGameCache] Poller stopped')
  }
}