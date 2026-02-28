<template>
  <div class="bet-card" :class="{ 'is-live': liveGame, 'is-offline': !liveGame && !checking }">
    <!-- Header -->
    <div class="card-header">
      <img :src="`/src/assets/16.4.1/img/profileicon/${player.profileIconId}.png`" class="player-icon" alt="icon" />
      <div class="player-info">
        <div class="player-name">{{ player.gameName }}</div>
        <div class="player-level">LVL {{ player.summonerLevel }}</div>
      </div>
      <div class="live-indicator" v-if="liveGame">
        <span class="live-dot"></span> LIVE
      </div>
      <div class="offline-indicator" v-else-if="!checking">
        NOT IN GAME
      </div>
      <div class="checking-indicator" v-else>
        <span class="checking-dot"></span>
      </div>
    </div>

    <!-- Live game info -->
    <div v-if="liveGame" class="game-info">
      <div class="game-detail">
        <span class="detail-label">Game Mode</span>
        <span class="detail-val">{{ gameMode }}</span>
      </div>
      <div class="game-detail">
        <span class="detail-label">Duration</span>
        <span class="detail-val">{{ formatGameDuration(gameDuration) }}</span>
      </div>
      <div class="game-detail">
        <span class="detail-label">Champion</span>
        <img :src="`/src/assets/16.4.1/img/champion/${championIdToName(liveGame.participants[0].championId)}.png`" class="champ-icon" />
      </div>
    </div>

    <!-- Bet already placed -->
    <div v-if="existingBet" class="existing-bet">
      <div class="existing-bet-label">Your bet</div>
      <div class="existing-bet-choice" :class="existingBet.prediction">
        {{ existingBet.prediction === 'yes' ? '✓ WIN' : '✗ LOSE' }}
        — {{ existingBet.amount.toLocaleString() }} ZC
      </div>
      <div class="existing-bet-note">Resolves when the game ends</div>
    </div>

    <!-- Bet form (only if live and no existing bet) -->
    <div v-else-if="liveGame && !existingBet" class="bet-form">
      <div class="question">Will <strong>{{ player.gameName }}</strong> win?</div>
      <div class="prediction-buttons">
        <button
          class="btn-yes" :class="{ active: prediction === 'yes' }"
          @click="prediction = 'yes'"
        >✓ YES</button>
        <button
          class="btn-no" :class="{ active: prediction === 'no' }"
          @click="prediction = 'no'"
        >✗ NO</button>
      </div>

      <br/>
      <div class="amount-row">
        <div class="amount-input-wrap">
          <span class="coin-sym">🪙</span>
          <input
            v-model.number="betAmount"
            type="number"
            min="1"
            :max="userCoins"
            placeholder="Amount"
            class="amount-input"
          />
        </div>
        <div class="quick-amounts">
          <button v-for="q in quickAmounts" :key="q" class="quick-btn" @click="betAmount = Math.min(q, userCoins)">
            {{ q >= 1000 ? q/1000 + 'k' : q }}
          </button>
          <button class="quick-btn" @click="betAmount = userCoins">MAX</button>
        </div>
      </div>
      <br/>
      <div class="payout-preview" v-if="betAmount > 0">
        Potential win: <span class="payout-amt">+{{ Math.floor(betAmount * 1.9).toLocaleString() }} ZC</span>
      </div>
      <br/>
      <div v-if="betError" class="error-msg" style="margin-top:10px;font-size:12px">{{ betError }}</div>

      <button
        class="btn-place"
        @click="placeBet"
        :disabled="!prediction || !betAmount || betAmount < 1 || placing || betAmount > userCoins"
      >
        {{ placing ? 'Placing…' : '⚡ Place Bet' }}
      </button>
    </div>

    <!-- Not in game -->
    <div v-else-if="!liveGame && !checking" class="no-game">
      <span>{{ player.gameName }} is not in a game right now.</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { getLiveGame } from '../services/riot'
import { placeBet as placeBetService, hasUserBetOnGame, getUserBets } from '../services/bets'

const props = defineProps({
  player: Object,
  userCoins: Number,
  userId: String,
  refreshTick: Number,
})
const emit = defineEmits(['bet-placed'])

const liveGame = ref(null)
const checking = ref(true)
const existingBet = ref(null)
const prediction = ref('')
const betAmount = ref(null)
const placing = ref(false)
const betError = ref('')

const quickAmounts = [50, 100, 250, 500]

const gameMode = computed(() => {
  if (!liveGame.value) return ''
  const modes = { CLASSIC: "Summoner's Rift", ARAM: 'ARAM', URF: 'URF' }
  return modes[liveGame.value.gameMode] || liveGame.value.gameMode
})

const gameDuration = computed(() => {
  if (!liveGame.value) return ''
  const s = Math.floor(liveGame.value.gameLength)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
})

function formatGameDuration(duration) {
  const [m, s] = duration.split(':').map(Number)
  const totalSeconds = m * 60 + s + 120
  const newM = Math.floor(totalSeconds / 60)
  const newS = totalSeconds % 60
  return `${newM}:${String(newS).padStart(2, '0')}`
}

function championIdToName(champId) {
  const champs = {
    266: 'Aatrox', 103: 'Ahri', 84: 'Akali', 166: 'Akshan', 12: 'Alistar',
    32: 'Amumu', 34: 'Anivia', 1: 'Annie', 523: 'Aphelios', 22: 'Ashe',
    136: 'AurelionSol', 268: 'Azir', 432: 'Bard', 200: 'BelVeth', 53: 'Blitzcrank',
    63: 'Brand', 201: 'Braum', 233: 'Briar', 51: 'Caitlyn', 164: 'Camille',
    69: 'Cassiopeia', 31: 'Chogath', 42: 'Corki', 122: 'Darius', 131: 'Diana',
    119: 'Draven', 36: 'DrMundo', 245: 'Ekko', 60: 'Elise', 28: 'Evelynn',
    81: 'Ezreal', 9: 'Fiddlesticks', 114: 'Fiora', 105: 'Fizz', 3: 'Galio',
    41: 'Gangplank', 86: 'Garen', 150: 'Gnar', 79: 'Gragas', 104: 'Graves',
    887: 'Gwen', 120: 'Hecarim', 74: 'Heimerdinger', 420: 'Illaoi', 39: 'Irelia',
    427: 'Ivern', 40: 'Janna', 59: 'JarvanIV', 24: 'Jax', 126: 'Jayce',
    202: 'Jhin', 222: 'Jinx', 145: 'Kaisa', 429: 'Kalista', 43: 'Karma',
    30: 'Karthus', 38: 'Kassadin', 55: 'Katarina', 10: 'Kayle', 141: 'Kayn',
    85: 'Kennen', 121: 'Khazix', 203: 'Kindred', 240: 'Kled', 96: 'KogMaw',
    897: 'KSante', 7: 'LeBlanc', 64: 'LeeSin', 89: 'Leona', 876: 'Lillia',
    117: 'Lulu', 99: 'Lux', 54: 'Malphite', 90: 'Malzahar', 57: 'Maokai',
    11: 'MasterYi', 902: 'Milio', 21: 'MissFortune', 62: 'MonkeyKing', 82: 'Mordekaiser',
    25: 'Morgana', 950: 'Naafiri', 267: 'Nami', 75: 'Nasus', 111: 'Nautilus',
    518: 'Neeko', 76: 'Nidalee', 895: 'Nilah', 56: 'Nocturne', 20: 'Nunu',
    2: 'Olaf', 61: 'Orianna', 516: 'Ornn', 80: 'Pantheon', 78: 'Poppy',
    555: 'Pyke', 246: 'Qiyana', 133: 'Quinn', 497: 'Rakan', 33: 'Rammus',
    421: 'RekSai', 526: 'Rell', 888: 'Renata', 58: 'Renekton', 107: 'Rengar',
    92: 'Riven', 68: 'Rumble', 13: 'Ryze', 360: 'Samira', 113: 'Sejuani',
    235: 'Senna', 147: 'Seraphine', 875: 'Sett', 35: 'Shaco', 98: 'Shen',
    102: 'Shyvana', 27: 'Singed', 14: 'Sion', 15: 'Sivir', 72: 'Skarner',
    37: 'Sona', 16: 'Soraka', 50: 'Swain', 517: 'Sylas', 134: 'Syndra',
    223: 'TahmKench', 163: 'Taliyah', 91: 'Talon', 44: 'Taric', 17: 'Teemo',
    412: 'Thresh', 18: 'Tristana', 48: 'Trundle', 23: 'Tryndamere', 4: 'TwistedFate',
    29: 'Twitch', 77: 'Udyr', 6: 'Urgot', 110: 'Varus', 67: 'Vayne',
    45: 'Veigar', 161: 'VelKoz', 711: 'Vex', 254: 'Vi', 234: 'Viego',
    112: 'Viktor', 8: 'Vladimir', 106: 'Volibear', 19: 'Warwick', 498: 'Xayah',
    101: 'Xerath', 5: 'XinZhao', 157: 'Yasuo', 777: 'Yone', 83: 'Yorick',
    350: 'Yuumi', 154: 'Zac', 238: 'Zed', 221: 'Zeri', 115: 'Ziggs',
    26: 'Zilean', 142: 'Zoe', 143: 'Zyra',
  }
  return champs[champId] || 'Aatrox'
}

async function checkLiveGame() {
  checking.value = true
  try {
    const game = await getLiveGame(props.player.puuid)
    liveGame.value = game

    if (game) {
      const alreadyBet = await hasUserBetOnGame(props.userId, String(game.gameId))
      if (alreadyBet) {
        const bets = await getUserBets(props.userId)
        existingBet.value = bets.find(b => b.gameId === String(game.gameId) && b.playerId === props.player.id) || null
      }
    }
  } catch (e) {
    liveGame.value = null
  } finally {
    checking.value = false
  }
}

async function placeBet() {
  betError.value = ''
  if (!prediction.value) { betError.value = 'Choose YES or NO.'; return }
  if (!betAmount.value || betAmount.value < 1) { betError.value = 'Enter a valid amount.'; return }
  if (betAmount.value > props.userCoins) { betError.value = 'Not enough ZouletteCoins.'; return }

  placing.value = true
  try {
    await placeBetService({
      userId: props.userId,
      playerId: props.player.id,
      playerName: props.player.gameName,
      prediction: prediction.value,
      amount: betAmount.value,
      gameId: String(liveGame.value.gameId),
    })
    existingBet.value = { prediction: prediction.value, amount: betAmount.value }
    emit('bet-placed')
  } catch (e) {
    console.error('placeBet error:', e)
    betError.value = e?.message || 'Failed to place bet. Try again.'
  } finally {
    placing.value = false
  }
}

onMounted(checkLiveGame)

watch(() => props.refreshTick, (val) => {
  if (val > 0) checkLiveGame()
})
</script>

<style scoped>
.bet-card {
  animation: fadeUp 0.4s ease both;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
  padding: 20px;
  transition: border-color 0.2s;
}
.bet-card.is-live {
  border-color: rgba(0, 255, 136, 0.3);
  box-shadow: 0 0 20px rgba(0,255,136,0.06);
}
.bet-card.is-offline { opacity: 0.6; }

.card-header { align-items: center; display: flex; gap: 14px; }
.player-icon { border-radius: 50%; height: 48px; width: 48px; border: 2px solid var(--border-bright); }
.champ-icon { border-radius: 6px; height: 36px; width: 36px; border: 1px solid var(--border-bright); }
.player-info { flex: 1; }
.player-name { font-family: 'Rajdhani', sans-serif; font-size: 18px; font-weight: 700; letter-spacing: 0.04em; }
.player-level { color: var(--text-muted); font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; }

.live-indicator {
  align-items: center;
  background: rgba(0,255,136,0.1);
  border: 1px solid rgba(0,255,136,0.4);
  border-radius: 20px;
  color: var(--green);
  display: flex;
  font-size: 11px;
  font-weight: 700;
  gap: 6px;
  letter-spacing: 0.08em;
  padding: 4px 10px;
}
.live-dot {
  animation: blink 1s ease infinite;
  background: var(--green);
  border-radius: 50%;
  height: 7px;
  width: 7px;
}
@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.2; } }

.offline-indicator {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 20px;
  color: var(--text-dim);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 4px 10px;
}
.checking-indicator { padding: 4px 10px; }
.checking-dot {
  animation: blink 0.8s ease infinite;
  background: var(--text-muted);
  border-radius: 50%;
  display: block;
  height: 8px;
  width: 8px;
}

.game-info {
  background: var(--surface2);
  border-radius: 8px;
  display: flex;
  gap: 0;
  overflow: hidden;
}
.game-detail {
  align-items: center;
  border-right: 1px solid var(--border);
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  padding: 10px 12px;
}
.game-detail:last-child { border-right: none; }
.detail-label { color: var(--text-dim); display: block; font-size: 10px; letter-spacing: 0.08em; margin-bottom: 4px; text-transform: uppercase; }
.detail-val { font-size: 13px; font-weight: 600; }

.question {
  color: var(--text-muted);
  font-size: 14px;
  margin-bottom: 2px;
  text-align: center;
}
.question strong { color: var(--text); font-weight: 700; }

.prediction-buttons { display: grid; gap: 10px; grid-template-columns: 1fr 1fr; }

.amount-row { display: flex; flex-direction: column; gap: 8px; }
.amount-input-wrap { align-items: center; display: flex; gap: 8px; position: relative; }
.coin-sym { font-size: 18px; position: absolute; left: 12px; pointer-events: none; }
.amount-input { padding-left: 36px !important; }

.quick-amounts { display: flex; gap: 6px; }
.quick-btn {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-muted);
  flex: 1;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 5px;
  transition: border-color 0.2s, color 0.2s;
}
.quick-btn:hover { border-color: var(--cyan); color: var(--cyan); }

.payout-preview {
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
}
.payout-amt { color: var(--green); font-weight: 700; }

.btn-place {
  background: linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,255,136,0.1));
  border: 1px solid var(--cyan);
  border-radius: 8px;
  color: var(--cyan);
  font-family: 'Rajdhani', sans-serif;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 12px;
  text-transform: uppercase;
  transition: background 0.2s, box-shadow 0.2s;
  width: 100%;
}
.btn-place:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(0,212,255,0.25), rgba(0,255,136,0.2));
  box-shadow: 0 0 20px rgba(0,212,255,0.2);
}
.btn-place:disabled { opacity: 0.35; cursor: not-allowed; }

.existing-bet {
  background: var(--surface2);
  border: 1px solid var(--border-bright);
  border-radius: 10px;
  padding: 14px;
  text-align: center;
}
.existing-bet-label { color: var(--text-muted); font-size: 11px; letter-spacing: 0.08em; margin-bottom: 6px; text-transform: uppercase; }
.existing-bet-choice {
  font-family: 'Rajdhani', sans-serif;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.06em;
  margin-bottom: 4px;
}
.existing-bet-choice.yes { color: var(--green); }
.existing-bet-choice.no { color: var(--red); }
.existing-bet-note { color: var(--text-dim); font-size: 11px; }

.no-game {
  color: var(--text-dim);
  font-size: 13px;
  padding: 8px 0;
  text-align: center;
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>