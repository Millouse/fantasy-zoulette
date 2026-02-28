// src/services/odds.js
// Calcule les cotes dynamiques en fonction de l'elo du joueur et du volume de paris

import { RIOT_PLATFORM, RIOT_API_KEY } from '../config'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../firebase'

// Poids de chaque tier (plus haut = meilleur joueur = favori pour WIN)
const TIER_WEIGHT = {
  IRON: 0,
  BRONZE: 1,
  SILVER: 2,
  GOLD: 3,
  PLATINUM: 4,
  EMERALD: 5,
  DIAMOND: 6,
  MASTER: 7,
  GRANDMASTER: 8,
  CHALLENGER: 9,
}

const RANK_WEIGHT = { I: 3, II: 2, III: 1, IV: 0 }

// Convertit tier+rank en score numérique 0-39
function eloScore(tier, rank) {
  const t = TIER_WEIGHT[tier] ?? 3 // défaut: GOLD
  const r = RANK_WEIGHT[rank] ?? 0
  return t * 4 + r
}

// Récupère le rank solo/duo du joueur via son summonerId
async function getSummonerRank(summonerId) {
  if (!summonerId) return null
  try {
    const res = await fetch(
      `${RIOT_PLATFORM}/lol/league/v4/entries/by-summoner/${encodeURIComponent(summonerId)}`,
      { headers: { 'X-Riot-Token': RIOT_API_KEY } }
    )
    if (!res.ok) return null
    const entries = await res.json()
    return entries.find(e => e.queueType === 'RANKED_SOLO_5x5') || entries[0] || null
  } catch {
    return null
  }
}

// Récupère le volume de paris YES/NO pour un gameId donné
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
 * Retourne { yes: number, no: number, tier, rank, totalBets }
 *
 * Formule :
 * 1. Cote de base depuis l'elo (WIN entre 1.2x et 3.5x)
 * 2. Ajustement par le volume : si beaucoup parient YES → cote YES baisse, NO monte
 */
export async function computeOdds(player, gameId) {
  // Étape 1 : récupérer le rang
  const rankEntry = await getSummonerRank(player.summonerId)
  let baseYesOdds = 1.9 // défaut si pas de rank

  let tier = 'UNRANKED'
  let rank = ''

  if (rankEntry) {
    tier = rankEntry.tier
    rank = rankEntry.rank
    const score = eloScore(tier, rank) // 0 (Iron IV) → 39 (Challenger I)
    // Plus le score est haut → joueur fort → WIN plus probable → cote WIN basse
    // Score 0 → cote YES 3.2x (underdog)
    // Score 39 → cote YES 1.2x (favori)
    baseYesOdds = +(3.2 - (score / 39) * 2.0).toFixed(2)
  }

  const baseNoOdds = +(5.0 - baseYesOdds).toFixed(2) // cotes opposées qui somment ~4.2

  // Étape 2 : ajustement par volume de paris
  const { totalYes, totalNo, total } = await getBetVolume(gameId)

  let yesOdds = baseYesOdds
  let noOdds = baseNoOdds

  if (total > 0) {
    const yesFraction = totalYes / total // 0 = personne parie YES, 1 = tout le monde parie YES
    // Si beaucoup parient YES : cote YES baisse (jusqu'à -30%), cote NO monte
    const adjustment = (yesFraction - 0.5) * 0.6 // entre -0.3 et +0.3
    yesOdds = Math.max(1.1, +(baseYesOdds - adjustment).toFixed(2))
    noOdds = Math.max(1.1, +(baseNoOdds + adjustment).toFixed(2))
  }

  return {
    yes: yesOdds,
    no: noOdds,
    tier,
    rank,
    totalBets: total,
    totalYes,
    totalNo,
  }
}