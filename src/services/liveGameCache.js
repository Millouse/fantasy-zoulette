// src/services/liveGameCache.js
//
// Shared cache stored in Firestore so ALL users benefit from the same fetch.
// Only one client will actually call the Riot API per minute per player —
// everyone else just reads the cached Firestore document.
//
// Schema: liveGameCache/{puuid} → { gameData, isLive, fetchedAt, fetchedBy }

import {
  doc, getDoc, setDoc, onSnapshot, collection, getDocs, query, where
} from 'firebase/firestore'
import { db } from '../firebase'
import { getLiveGame } from './riot'
import { notifyBetsLocked } from './discord'

const CACHE_TTL_MS = 55_000
const BET_LOCK_SECONDS = 600

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
// Also detects the moment gameLength crosses 600s and sends Discord recap (once per game)
async function _doFetch(puuid, userId) {
  _fetching.add(puuid)
  try {
    const game = await getLiveGame(puuid)

    // Read previous cache to detect the lock threshold crossing
    const prevSnap = await getDoc(doc(db, 'liveGameCache', puuid))
    const prev = prevSnap.data()

    const newData = {
      gameData: game ?? null,
      isLive: !!game,
      fetchedAt: Date.now(),
      fetchedBy: userId || 'unknown',
      // Carry over betLockNotified flag if same game, reset if new/no game
      betLockNotified: _shouldCarryLockFlag(prev, game),
    }

    await setDoc(doc(db, 'liveGameCache', puuid), newData)

    // Detect crossing: was below 600s before, now at or above — and not yet notified
    const wasBeforeLock = !prev?.isLive || (prev?.gameData?.gameLength ?? 0) < BET_LOCK_SECONDS
    const isNowLocked = game && game.gameLength >= BET_LOCK_SECONDS
    const alreadyNotified = prev?.betLockNotified === true

    if (wasBeforeLock && isNowLocked && !alreadyNotified) {
      // Mark as notified immediately to prevent other tabs from double-sending
      await setDoc(doc(db, 'liveGameCache', puuid), { ...newData, betLockNotified: true })

      // Fetch player info (discordUsername) from players collection
      const playerSnap = await getDocs(query(collection(db, 'players'), where('puuid', '==', puuid)))
      const player = playerSnap.empty ? null : playerSnap.docs[0].data()

      // Aggregate pending bets for this game
      const betsSnap = await getDocs(query(
        collection(db, 'bets'),
        where('gameId', '==', String(game.gameId)),
        where('status', '==', 'pending')
      ))
      let totalYesZC = 0
      let totalNoZC = 0
      for (const d of betsSnap.docs) {
        const b = d.data()
        if (b.prediction === 'yes') totalYesZC += b.amount
        else totalNoZC += b.amount
      }
      const totalZC = totalYesZC + totalNoZC
      const totalBets = betsSnap.size

      if (totalBets > 0) {
        await notifyBetsLocked({
          playerName: player?.gameName ?? 'Unknown',
          discordUsername: player?.discordUsername ?? null,
          gameId: String(game.gameId),
          totalZC,
          totalYesZC,
          totalNoZC,
          totalBets,
        })
        console.log(`[liveGameCache] 🔒 Bet lock reached for ${player?.gameName} — Discord recap sent`)
      }
    }
  } catch (e) {
    console.warn(`[liveGameCache] fetch failed for ${puuid}:`, e?.message)
    await setDoc(doc(db, 'liveGameCache', puuid), {
      gameData: null,
      isLive: false,
      fetchedAt: Date.now(),
      fetchedBy: userId || 'unknown',
      betLockNotified: false,
      error: e?.message || 'unknown error',
    }).catch(() => {})
  } finally {
    _fetching.delete(puuid)
  }
}

// Keep betLockNotified=true only if we're still in the same game
function _shouldCarryLockFlag(prev, newGame) {
  if (!prev || !newGame) return false
  if (!prev.betLockNotified) return false
  // Same game = same gameId
  return String(prev.gameData?.gameId) === String(newGame.gameId)
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