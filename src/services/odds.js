// src/services/odds.js
// Calcule les cotes dynamiques en fonction de l'elo du joueur et du volume de paris
// Utilise le cache Firestore (liveGameCache) au lieu d'appeler l'API Riot directement

import { RIOT_PLATFORM, RIOT_API_KEY } from '../config'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { forceRefreshLiveGame } from './liveGameCache'

const CACHE_TTL_MS = 55_000

const TIER_WEIGHT = {
  IRON: 0, BRONZE: 1, SILVER: 2, GOLD: 3, PLATINUM: 4,
  EMERALD: 5, DIAMOND: 6, MASTER: 7, GRANDMASTER: 8, CHALLENGER: 9,
}
const RANK_WEIGHT = { I: 3, II: 2, III: 1, IV: 0 }

function eloScore(tier, rank) {
  const t = TIER_WEIGHT[tier] ?? 3
  const r = RANK_WEIGHT[rank] ?? 0
  return t * 4 + r
}

// Read live game from Firestore cache — refresh if stale
async function getLiveGameFromCache(puuid, userId) {
  const ref = doc(db, 'liveGameCache', puuid)
  const snap = await getDoc(ref)
  const data = snap.data()
  const now = Date.now()

  if (!data || now - data.fetchedAt > CACHE_TTL_MS) {
    await forceRefreshLiveGame(puuid, userId)
    const fresh = await getDoc(ref)
    return fresh.data() ?? null
  }
  return data
}

// Fetch rank via League v4 by puuid directly
async function getSummonerRankByPuuid(puuid) {
  if (!puuid) return null
  try {
    const res = await fetch(
      `${RIOT_PLATFORM}/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`,
      { headers: { 'X-Riot-Token': RIOT_API_KEY } }
    )
    if (!res.ok) return null
    const entries = await res.json()
    return entries.find(e => e.queueType === 'RANKED_SOLO_5x5') || entries[0] || null
  } catch {
    return null
  }
}

// Volume de paris YES/NO pour un gameId
async function getBetVolume(gameId) {
  const q = query(
    collection(db, 'bets'),
    where('gameId', '==', String(gameId)),
    where('status', '==', 'pending')
  )
  const snap = await getDocs(q)
  let totalYes = 0
  let totalNo = 0
  for (const d of snap.docs) {
    const b = d.data()
    if (b.prediction === 'yes') totalYes += b.amount
    else totalNo += b.amount
  }
  return { totalYes, totalNo, total: totalYes + totalNo }
}

/**
 * Calcule les cotes pour un joueur dans une partie.
 * Lit le cache Firestore au lieu d'appeler getLiveGame directement.
 */
export async function computeOdds(player, gameId, userId) {
  // 1. Read live game from cache
  const cached = await getLiveGameFromCache(player.puuid, userId)

  if (!cached?.isLive || !cached.gameData?.participants) {
    return { yes: 1.5, no: 1.5, tier: 'UNRANKED', rank: '', totalBets: 0, totalYes: 0, totalNo: 0 }
  }

  const liveGame = cached.gameData

  // 2. Fetch all participant ranks in parallel
  const ranks = await Promise.all(
    liveGame.participants.map(async p => {
      const rankEntry = await getSummonerRankByPuuid(p.puuid)
      return {
        puuid: p.puuid,
        rank: rankEntry,
        team: p.teamId === 100 ? 'blue' : 'red',
      }
    })
  )

  // 3. Identify player's team & rank
  const playerData = ranks.find(r => r.puuid === player.puuid)
  const playerTeam = playerData?.team ?? null
  const rankEntry = playerData?.rank ?? null

  let tier = 'UNRANKED'
  let rank = ''
  let baseYesOdds = 1.9

  // 4. Compute team average scores and adjust odds
  if (rankEntry && playerTeam) {
    tier = rankEntry.tier
    rank = rankEntry.rank
    let score = eloScore(tier, rank)

    let blueTotal = 0, blueCount = 0
    let redTotal = 0, redCount = 0

    for (const r of ranks) {
      if (!r.rank) continue
      const s = eloScore(r.rank.tier, r.rank.rank)
      if (r.team === 'blue') { blueTotal += s; blueCount++ }
      else { redTotal += s; redCount++ }
    }

    const blueAvg = blueCount ? blueTotal / blueCount : 0
    const redAvg = redCount ? redTotal / redCount : 0

    // Penalize score if player's team is stronger (they're favored = lower WIN odds)
    if (
      (playerTeam === 'blue' && blueAvg > redAvg) ||
      (playerTeam === 'red' && redAvg > blueAvg)
    ) {
      score -= Math.abs(blueAvg - redAvg) * 0.3
    }

    score = Math.max(0, Math.min(39, score))
    baseYesOdds = +(3.2 - (score / 39) * 2.0).toFixed(2)
  }

  const baseNoOdds = +(5.0 - baseYesOdds).toFixed(2)

  // 5. Volume-based adjustment
  const { totalYes, totalNo, total } = await getBetVolume(gameId)

  let yesOdds = baseYesOdds
  let noOdds = baseNoOdds

  if (total > 0) {
    const adjustment = (totalYes / total - 0.5) * 0.6
    yesOdds = Math.max(1.1, +(baseYesOdds - adjustment).toFixed(2))
    noOdds = Math.max(1.1, +(baseNoOdds + adjustment).toFixed(2))
  }

  return { yes: yesOdds, no: noOdds, tier, rank, totalBets: total, totalYes, totalNo }
}