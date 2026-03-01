// src/services/autoResolve.js
// Runs every 60s — checks all pending bets, and auto-resolves when a game ends.
// Uses the shared liveGameCache (Firestore) instead of calling the Riot API directly.

import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { getLastMatchResult } from './riot'
import { resolveBets } from './bets'
import { forceRefreshLiveGame } from './liveGameCache'

const CACHE_TTL_MS = 55_000

let intervalId = null

// Read live game status from Firestore cache (never calls Riot directly)
// If cache is stale, trigger a refresh and read the fresh result
async function getLiveGameFromCache(puuid, userId) {
  const ref = doc(db, 'liveGameCache', puuid)
  const snap = await getDoc(ref)
  const data = snap.data()

  const now = Date.now()

  // If cache is missing or stale, force a fresh fetch then re-read
  if (!data || now - data.fetchedAt > CACHE_TTL_MS) {
    await forceRefreshLiveGame(puuid, userId)
    const fresh = await getDoc(ref)
    return fresh.data() ?? null
  }

  return data
}

// Get all unique (playerId, puuid, gameId) combos with pending bets
async function getPendingGameEntries() {
  const q = query(collection(db, 'bets'), where('status', '==', 'pending'))
  const snap = await getDocs(q)

  const map = {}
  for (const d of snap.docs) {
    const bet = d.data()
    if (!map[bet.gameId]) {
      const playerDoc = await getDoc(doc(db, 'players', bet.playerId))
      if (playerDoc.exists()) {
        map[bet.gameId] = {
          gameId: bet.gameId,
          puuid: playerDoc.data().puuid,
          playerId: bet.playerId,
        }
      }
    }
  }
  return Object.values(map)
}

async function checkAndResolve(userId) {
  console.log('[AutoResolve] Checking pending bets…')
  try {
    const entries = await getPendingGameEntries()
    if (entries.length === 0) {
      console.log('[AutoResolve] No pending bets.')
      return
    }

    for (const { gameId, puuid } of entries) {
      try {
        // Step 1: check cache — is the player still in this live game?
        const cached = await getLiveGameFromCache(puuid, userId)

        if (cached?.isLive && cached.gameData && String(cached.gameData.gameId) === String(gameId)) {
          console.log(`[AutoResolve] Game ${gameId} still in progress (from cache), skipping.`)
          continue
        }

        // Step 2: player not live anymore — fetch match result from Riot
        const result = await getLastMatchResult(puuid)
        if (!result) {
          console.log(`[AutoResolve] No match result yet for game ${gameId}.`)
          continue
        }

        // Step 3: match the finished game to the bet's gameId
        const matchNumericId = result.gameId.split('_').pop()
        const betNumericId = String(gameId).split('_').pop()

        if (matchNumericId !== betNumericId) {
          console.log(`[AutoResolve] Latest match ${result.gameId} doesn't match bet game ${gameId}, skipping.`)
          continue
        }

        // Step 4: resolve all bets for this game
        const count = await resolveBets(gameId, result.win)
        console.log(`[AutoResolve] ✅ Resolved ${count} bet(s) for game ${gameId} — player ${result.win ? 'WON' : 'LOST'}`)
      } catch (e) {
        console.warn(`[AutoResolve] Error checking game ${gameId}:`, e)
      }
    }
  } catch (e) {
    console.warn('[AutoResolve] Error fetching pending bets:', e)
  }
}

export function startAutoResolve(userId, intervalMs = 60_000) {
  if (intervalId) return
  console.log('[AutoResolve] Started — checking every', intervalMs / 1000, 'seconds')
  checkAndResolve(userId)
  intervalId = setInterval(() => checkAndResolve(userId), intervalMs)
}

export function stopAutoResolve() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
    console.log('[AutoResolve] Stopped')
  }
}