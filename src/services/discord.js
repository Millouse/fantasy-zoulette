// src/services/discord.js
import { DISCORD_WEBHOOK_URL } from '../config'

const TIER_COLOR = {
  CHALLENGER: 0x00d4ff,
  GRANDMASTER: 0xef5350,
  MASTER: 0xab47bc,
  DIAMOND: 0x4fc3f7,
  EMERALD: 0x00ff88,
  PLATINUM: 0x00c9b1,
  GOLD: 0xffc800,
  SILVER: 0xc0c0c0,
  BRONZE: 0xcd7f32,
  IRON: 0x8a8a8a,
  UNRANKED: 0x444466,
}

/**
 * Send a Discord embed when a user places a bet.
 * @param {Object} p
 * p.userName       — display name of the bettor
 * p.playerName     — gameName of the tracked player
 * p.prediction     — 'yes' | 'no'
 * p.amount         — coins wagered
 * p.odds           — odds at time of bet
 * p.payout         — potential payout
 * p.gameId         — Riot game ID
 * p.tier           — player rank tier (e.g. 'GOLD')
 * p.rank           — player rank division (e.g. 'II')
 */
export async function notifyBetPlaced({ userName, discordUsername, playerName, prediction, amount, odds, payout, gameId, tier, rank }) {
  if (!DISCORD_WEBHOOK_URL) return

  const won = prediction === 'yes'
  const predLabel = won ? '✅ WIN' : '❌ LOSE'

  const embed = {
    title: `🚨🚨🚨🚨🚨 NOUVEAU BET 🚨🚨🚨🚨🚨`,
    color: 0xFF6600,
    fields: [
      { name: '👤 BETTOR', value: userName, inline: true },
      { name: '🎮 PLAYER', value: playerName, inline: true },
      { name: '📊 PREDICTION', value: predLabel, inline: true },
      { name: '🪙 ZOULETTESCOINS', value: `${amount.toLocaleString()} ZC`, inline: true },
      { name: '💰 POTENTIAL PAYOUT', value: `+${payout.toLocaleString()} ZC @ ${odds}x`, inline: true },
    ],
    footer: { text: 'ZouletteGG • Bet placed' },
    timestamp: new Date().toISOString(),
  }

  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: discordUsername ? `@${discordUsername} quelqu'un bet sur toi !` : null,
        embeds: [embed],
      }),
    })
  } catch (e) {
    console.warn('[Discord] Failed to send notification:', e)
  }
}