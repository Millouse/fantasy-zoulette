// src/services/bets.js
import {
  collection, doc, addDoc, updateDoc, getDocs,
  query, where, serverTimestamp, increment, getDoc, writeBatch
} from 'firebase/firestore'
import { db } from '../firebase'

// Place a bet
export async function placeBet({ userId, playerId, playerName, prediction, amount, gameId }) {
  const batch = writeBatch(db)

  // Deduct coins from user
  const userRef = doc(db, 'users', userId)
  batch.update(userRef, { coins: increment(-amount) })

  // Create bet document
  const betRef = doc(collection(db, 'bets'))
  batch.set(betRef, {
    userId,
    playerId,       // Firestore player doc id
    playerName,
    prediction,     // 'yes' | 'no'
    amount,
    gameId,         // Riot match/spectator game id to avoid double-betting
    status: 'pending',  // pending | won | lost
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

    const payout = correctPrediction ? Math.floor(bet.amount * 1.9) : 0
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

// Check if user already bet on this game+player combo
export async function hasUserBetOnGame(userId, gameId) {
  const q = query(
    collection(db, 'bets'),
    where('userId', '==', userId),
    where('gameId', '==', String(gameId))
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
