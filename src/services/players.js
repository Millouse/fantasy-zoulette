// src/services/players.js
import {
  collection, doc,
  deleteDoc, getDocs, setDoc
} from 'firebase/firestore'
import { db } from '../firebase'
import { getAccountByRiotId, getSummonerByPuuid } from './riot'

// Get all tracked players from Firestore
export async function getPlayers() {
  const snap = await getDocs(collection(db, 'players'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// Admin: add a player by Riot ID (gameName + tagLine)
export async function addPlayer(gameName, tagLine) {
  // Step 1: resolve PUUID from Riot ID
  const account = await getAccountByRiotId(gameName, tagLine)
  if (!account) throw new Error(`Riot ID "${gameName}#${tagLine}" introuvable.`)

  // Step 2: get summoner data for profileIconId and level (summonerId may be absent)
  const summoner = await getSummonerByPuuid(account.puuid)

  const ref = doc(collection(db, 'players'))
  await setDoc(ref, {
    gameName: account.gameName,
    tagLine: account.tagLine,
    displayName: `${account.gameName}#${account.tagLine}`,
    puuid: account.puuid,
    // summonerId only stored if available (not needed for spectator v5)
    ...(summoner?.id ? { summonerId: summoner.id } : {}),
    profileIconId: summoner?.profileIconId ?? 29,
    summonerLevel: summoner?.summonerLevel ?? '—',
    addedAt: new Date().toISOString(),
  })
  return ref.id
}

// Admin: remove a player
export async function removePlayer(playerId) {
  await deleteDoc(doc(db, 'players', playerId))
}