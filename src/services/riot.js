// src/services/riot.js
import { RIOT_API_KEY, RIOT_PLATFORM, RIOT_REGION } from '../config'

async function riotFetch(url) {
  try {
    const res = await fetch(url, {
      headers: { 'X-Riot-Token': RIOT_API_KEY }
    });

    if (res.status === 404) {
      return null; 
    }

    if (!res.ok) {
      console.error(`Riot API Error: ${res.status}`);
      return null;
    }

    return await res.json();
  } catch (e) {
    console.error("Network error:", e);
    return null;
  }
}

// Resolve PUUID from Riot ID (gameName + tagLine) — uses Account v1
export async function getAccountByRiotId(gameName, tagLine) {
  return riotFetch(
    `${RIOT_REGION}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
  )
}

// Get summoner by PUUID — to fetch summonerId, profileIconId, level
export async function getSummonerByPuuid(puuid) {
  return riotFetch(
    `${RIOT_PLATFORM}/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`
  )
}

// Check if a player is currently in a live game — spectator v5 supports puuid directly
export async function getLiveGame(puuid) {
  const live = await riotFetch(
    `${RIOT_PLATFORM}/lol/spectator/v5/active-games/by-summoner/${encodeURIComponent(puuid)}`
  );
  
  return live;
}

// Get last match result — used to resolve bets
export async function getLastMatchResult(puuid) {
  const matchIds = await riotFetch(
    `${RIOT_REGION}/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=0&count=1`
  )
  if (!matchIds || matchIds.length === 0) return null

  const match = await riotFetch(
    `${RIOT_REGION}/lol/match/v5/matches/${matchIds[0]}`
  )
  if (!match) return null

  const participant = match.info.participants.find(p => p.puuid === puuid)
  return participant ? { win: participant.win, gameId: match.metadata.matchId } : null
}

export function profileIconUrl(profileIconId) {
    return `/assets/14.6.1/img/profileicon/${profileIconId}.png`
}