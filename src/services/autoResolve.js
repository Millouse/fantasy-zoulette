// src/services/autoResolve.js
// Runs every 60s — checks all pending bets, fetches last match for each player,
// and auto-resolves bets if the game is finished.

import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { getLastMatchResult, getLiveGame } from './riot'
import { resolveBets } from './bets'

let intervalId = null

// Get all unique (playerId, puuid, gameId) combos that have pending bets
async function getPendingGameEntries() {
  const q = query(collection(db, 'bets'), where('status', '==', 'pending'))
  const snap = await getDocs(q)

  // Group by gameId — we only need one puuid per gameId
  const map = {}
  for (const d of snap.docs) {
    const bet = d.data()
    if (!map[bet.gameId]) {
      // Fetch player puuid from players collection by document ID
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

async function checkAndResolve() {
  console.log('[AutoResolve] Checking pending bets…')
  try {
    const entries = await getPendingGameEntries()
    if (entries.length === 0) {
      console.log('[AutoResolve] No pending bets.')
      return
    }

    for (const { gameId, puuid } of entries) {
      try {
        // Step 1: check if player is still in a live game with this gameId
        const live = await getLiveGame(puuid)
        if (live && String(live.gameId) === String(gameId)) {
          console.log(`[AutoResolve] Game ${gameId} still in progress, skipping.`)
          continue
        }

        // Step 2: player not in live game anymore — fetch last match result
        const result = await getLastMatchResult(puuid)
        if (!result) {
          console.log(`[AutoResolve] No match result yet for game ${gameId}.`)
          continue
        }

        // Step 3: match the finished game to the bet's gameId
        // Riot Match IDs: "EUW1_7123456789", spectator gameId is the numeric part
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

export function startAutoResolve(intervalMs = 60_000) {
  if (intervalId) return // already running
  console.log('[AutoResolve] Started — checking every', intervalMs / 1000, 'seconds')
  checkAndResolve() // run immediately on start
  intervalId = setInterval(checkAndResolve, intervalMs)
}

export function stopAutoResolve() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
    console.log('[AutoResolve] Stopped')
  }
}