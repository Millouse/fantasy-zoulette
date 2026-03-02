// src/services/bets.js
import {
  collection, doc, addDoc, updateDoc, getDocs,
  query, where, serverTimestamp, increment, getDoc, writeBatch
} from 'firebase/firestore'
import { db } from '../firebase'

// Place a bet
export async function placeBet({ userId, playerId, playerName, prediction, amount, gameId, odds }) {
  const batch = writeBatch(db)

  // Deduct coins from user
  const userRef = doc(db, 'users', userId)
  batch.update(userRef, { coins: increment(-amount) })

  // Create bet document — store the odds at the time of the bet
  const betRef = doc(collection(db, 'bets'))
  batch.set(betRef, {
    userId,
    playerId,
    playerName,
    prediction,     // 'yes' | 'no'
    amount,
    odds: odds ?? 1.9, // cote au moment du pari
    gameId,
    status: 'pending',
    payout: 0,
    createdAt: serverTimestamp(),
  })

  await batch.commit()
  return betRef.id
}

// Get all bets for a user
export async function getUserBets(userId) {
  const q = query(collection(db, 'bets'), where('userId', '==', userId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// Get pending bets for a specific game (used to resolve)
export async function getPendingBetsForGame(gameId) {
  const q = query(
    collection(db, 'bets'),
    where('gameId', '==', String(gameId)),
    where('status', '==', 'pending')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// Resolve bets after a game ends
// win: boolean — did the tracked player win?
export async function resolveBets(gameId, playerWon) {
  const bets = await getPendingBetsForGame(gameId)
  if (bets.length === 0) return 0

  const batch = writeBatch(db)
  let resolved = 0

  for (const bet of bets) {
    const correctPrediction =
      (bet.prediction === 'yes' && playerWon) ||
      (bet.prediction === 'no' && !playerWon)

    const payout = correctPrediction ? Math.floor(bet.amount * (bet.odds ?? 1.9)) : 0
    const status = correctPrediction ? 'won' : 'lost'

    batch.update(doc(db, 'bets', bet.id), { status, payout })

    if (correctPrediction) {
      batch.update(doc(db, 'users', bet.userId), { coins: increment(payout) })
    }
    resolved++
  }

  await batch.commit()
  return resolved
}

// Check if user already placed an outcome bet (WIN/LOSE) on this game+player combo
export async function hasUserBetOnGame(userId, gameId) {
  const q = query(
    collection(db, 'bets'),
    where('userId', '==', userId),
    where('gameId', '==', String(gameId)),
    where('type', '!=', 'stat')
  )
  const snap = await getDocs(q)
  return !snap.empty
}

// Admin: grant coins to a user
export async function grantCoins(userId, amount) {
  await updateDoc(doc(db, 'users', userId), { coins: increment(amount) })
}

// Admin: get all users
export async function getAllUsers() {
  const snap = await getDocs(collection(db, 'users'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ── Stat Bets ──────────────────────────────────────────────────────────────────
// Stat bet schema:
//   type: 'stat'
//   statType: 'kda' | 'duration' | 'cspm'
//   targetValue: number  — the value the user bets OVER
//   amount: number
//   odds: number
//   gameId, playerId, playerName, userId
//   status: 'pending' | 'won' | 'lost'
//   payout: number

export async function placeStatBet({ userId, playerId, playerName, gameId, statType, targetValue, amount, odds }) {
  const batch = writeBatch(db)
  const userRef = doc(db, 'users', userId)
  batch.update(userRef, { coins: increment(-amount) })

  const betRef = doc(collection(db, 'bets'))
  batch.set(betRef, {
    type: 'stat',
    userId, playerId, playerName, gameId,
    statType,      // 'kda' | 'duration' | 'cspm'
    targetValue,   // user bets the stat will be ABOVE this value
    amount,
    odds,
    status: 'pending',
    payout: 0,
    createdAt: serverTimestamp(),
  })

  await batch.commit()
  return betRef.id
}

// Check if user already has a stat bet of a given type on a given game
export async function hasUserStatBet(userId, gameId, statType) {
  const q = query(
    collection(db, 'bets'),
    where('userId', '==', userId),
    where('gameId', '==', String(gameId)),
    where('type', '==', 'stat'),
    where('statType', '==', statType),
  )
  const snap = await getDocs(q)
  return !snap.empty
}

// Get all pending stat bets for a game (used by autoResolve)
export async function getPendingStatBetsForGame(gameId) {
  const q = query(
    collection(db, 'bets'),
    where('gameId', '==', String(gameId)),
    where('type', '==', 'stat'),
    where('status', '==', 'pending'),
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// Resolve stat bets for a finished game given final stats
// finalStats: { kda: number, durationSeconds: number, cspm: number }
export async function resolveStatBets(gameId, finalStats) {
  const bets = await getPendingStatBetsForGame(gameId)
  if (bets.length === 0) return 0

  const batch = writeBatch(db)
  let resolved = 0

  for (const bet of bets) {
    let actualValue = null
    if (bet.statType === 'kda') actualValue = finalStats.kda
    else if (bet.statType === 'duration') actualValue = finalStats.durationSeconds / 60 // minutes
    else if (bet.statType === 'cspm') actualValue = finalStats.cspm

    const won = actualValue !== null && actualValue >= bet.targetValue
    const payout = won ? Math.floor(bet.amount * bet.odds) : 0
    const status = won ? 'won' : 'lost'

    batch.update(doc(db, 'bets', bet.id), { status, payout, actualValue })
    if (won) batch.update(doc(db, 'users', bet.userId), { coins: increment(payout) })
    resolved++
  }

  await batch.commit()
  return resolved
}