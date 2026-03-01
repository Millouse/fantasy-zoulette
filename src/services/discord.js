// src/services/discord.js
import { DISCORD_WEBHOOK_URL } from '../config'

/**
 * Envoie un récap Discord quand les paris sont fermés (10min écoulées).
 * Tag le joueur concerné s'il a un discord username.
 *
 * @param {Object} p
 * p.playerName      — gameName du joueur
 * p.discordUsername — pseudo discord du joueur (optionnel)
 * p.gameId          — Riot game ID
 * p.totalZC         — total de ZC misés
 * p.totalYesZC      — ZC misés sur WIN
 * p.totalNoZC       — ZC misés sur LOSE
 * p.totalBets       — nombre de paris
 */
export async function notifyBetsLocked({ playerName, discordUsername, gameId, totalZC, totalYesZC, totalNoZC, totalBets }) {
  if (!DISCORD_WEBHOOK_URL) return

  const yesPercent = totalZC > 0 ? Math.round((totalYesZC / totalZC) * 100) : 50
  const noPercent = 100 - yesPercent

  const barLength = 20
  const yesFill = Math.round((yesPercent / 100) * barLength)
  const noFill = barLength - yesFill
  const bar = '🟩'.repeat(yesFill) + '🟥'.repeat(noFill)

  const mention = discordUsername ? `<@${discordUsername}>` : `**${playerName}**`

  const embed = {
    title: `:alert: BETS FERMÉS — ${playerName} :alert:`,
    color: 0xFF6600,
    description: `Les paris sont fermés ! Voici le récap des mises sur la game de ${mention}.`,
    fields: [
      {
        name: '🪙 TOTAL MISÉ',
        value: `**${totalZC.toLocaleString()} ZC** sur ${totalBets} pari${totalBets > 1 ? 's' : ''}`,
        inline: false,
      },
      {
        name: `✅ WIN — ${yesPercent}%`,
        value: `${totalYesZC.toLocaleString()} ZC`,
        inline: true,
      },
      {
        name: `❌ LOSE — ${noPercent}%`,
        value: `${totalNoZC.toLocaleString()} ZC`,
        inline: true,
      },
      {
        name: '📊 RÉPARTITION',
        value: bar,
        inline: false,
      },
    ],
    footer: { text: `ZouletteGG • Game ${gameId}` },
    timestamp: new Date().toISOString(),
  }

  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: discordUsername ? `@${discordUsername} les paris sur ta game sont fermés !` : null,
        embeds: [embed],
      }),
    })
  } catch (e) {
    console.warn('[Discord] Failed to send notification:', e)
  }
}