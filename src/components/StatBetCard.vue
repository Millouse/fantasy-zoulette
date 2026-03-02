<template>
  <div class="stat-card" :class="{ 'is-live': liveGame, 'is-offline': !liveGame && !checking }">

    <!-- Header -->
    <div class="card-header">
      <img :src="`/assets/16.4.1/img/profileicon/${player.profileIconId}.png`" class="player-icon" alt="icon" />
      <div class="player-info">
        <div class="player-name">{{ player.gameName }}</div>
        <div class="player-level">LVL {{ player.summonerLevel }}</div>
      </div>
      <div class="live-indicator" v-if="liveGame"><span class="live-dot"></span> LIVE</div>
      <div class="offline-indicator" v-else-if="!checking">NOT IN GAME</div>
      <div class="checking-indicator" v-else><span class="checking-dot"></span></div>
    </div>

    <!-- Game info bar -->
    <div v-if="liveGame" class="game-bar">
      <img
        :src="`/assets/16.4.1/img/champion/${championIdToName(liveGame.participants[0].championId)}.png`"
        class="champ-icon"
      />
      <span class="game-mode">{{ gameMode }}</span>
      <span class="game-sep">·</span>
      <span class="game-dur">⏱ {{ realtimeDuration }}</span>
    </div>

    <!-- Offline -->
    <div v-if="!liveGame && !checking" class="no-game">
      {{ player.gameName }} n'est pas en game.
    </div>

    <!-- Stat bet panels -->
    <div v-if="liveGame" class="stat-panels">
      <StatBetPanel
        v-for="stat in STATS"
        :key="stat.type"
        :stat="stat"
        :userCoins="userCoins"
        :existingBet="existingBets[stat.type]"
        :betLocked="betLocked"
        :timeUntilLock="timeUntilLock"
        @place="onPlace"
      />
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { subscribeLiveGame } from '../services/liveGameCache'
import { placeStatBet, hasUserStatBet, getUserBets } from '../services/bets'
import { useAuthStore } from '../stores/auth'
import StatBetPanel from './StatBetPanel.vue'

const authStore = useAuthStore()

const props = defineProps({
  player: Object,
  userCoins: Number,
  userId: String,
  refreshTick: Number,
})
const emit = defineEmits(['bet-placed'])

const liveGame = ref(null)
const checking = ref(true)
const now = ref(Date.now())
const existingBets = ref({}) // { kda: betObj, duration: betObj, cspm: betObj }

let unsubCache = null
let clockTimer = null

const BET_LOCK_SECONDS = 600

// Stat definitions with limits and label helpers
const STATS = [
  {
    type: 'kda',
    label: 'KDA',
    icon: '⚔️',
    unit: '',
    min: 2,
    max: Infinity,
    step: 0.5,
    defaultValue: 3,
    hint: 'Min 2.0 · Pas de limite max',
    format: v => v.toFixed(1),
  },
  {
    type: 'duration',
    label: 'Durée de game',
    icon: '⏱️',
    unit: 'min',
    min: 25,
    max: 90,
    step: 5,
    defaultValue: 30,
    hint: 'Min 25 min · Max 90 min',
    format: v => `${v} min`,
  },
  {
    type: 'cspm',
    label: 'CS / min',
    icon: '🌾',
    unit: 'cs/min',
    min: 7,
    max: 20,
    step: 0.5,
    defaultValue: 8,
    hint: 'Min 7 · Max 20 cs/min',
    format: v => v.toFixed(1),
  },
]

const realGameLength = computed(() => {
  if (!liveGame.value) return 0
  const fetchedAt = liveGame.value._fetchedAt || Date.now()
  return Math.floor(liveGame.value.gameLength) + Math.floor((now.value - fetchedAt) / 1000)
})

const betLocked = computed(() => realGameLength.value >= BET_LOCK_SECONDS)

const timeUntilLock = computed(() => {
  const remaining = BET_LOCK_SECONDS - realGameLength.value
  if (remaining <= 0) return null
  const m = Math.floor(remaining / 60)
  const s = Math.floor(remaining % 60)
  return `${m}:${String(s).padStart(2, '0')}`
})

const realtimeDuration = computed(() => {
  const total = realGameLength.value
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
})

const gameMode = computed(() => {
  if (!liveGame.value) return ''
  const modes = { CLASSIC: "Summoner's Rift", ARAM: 'ARAM', URF: 'URF' }
  return modes[liveGame.value.gameMode] || liveGame.value.gameMode
})

function championIdToName(id) {
  const m = {266:'Aatrox',103:'Ahri',84:'Akali',166:'Akshan',12:'Alistar',799:'Ambessa',32:'Amumu',34:'Anivia',1:'Annie',523:'Aphelios',22:'Ashe',136:'AurelionSol',893:'Aurora',268:'Azir',432:'Bard',200:'Belveth',53:'Blitzcrank',63:'Brand',201:'Braum',233:'Briar',51:'Caitlyn',164:'Camille',69:'Cassiopeia',31:'Chogath',42:'Corki',122:'Darius',131:'Diana',119:'Draven',36:'DrMundo',245:'Ekko',60:'Elise',28:'Evelynn',81:'Ezreal',9:'Fiddlesticks',114:'Fiora',105:'Fizz',3:'Galio',41:'Gangplank',86:'Garen',150:'Gnar',79:'Gragas',104:'Graves',887:'Gwen',120:'Hecarim',74:'Heimerdinger',910:'Hwei',420:'Illaoi',39:'Irelia',427:'Ivern',40:'Janna',59:'JarvanIV',24:'Jax',126:'Jayce',202:'Jhin',222:'Jinx',145:'Kaisa',429:'Kalista',43:'Karma',30:'Karthus',38:'Kassadin',55:'Katarina',10:'Kayle',141:'Kayn',85:'Kennen',121:'Khazix',203:'Kindred',240:'Kled',96:'KogMaw',897:'KSante',7:'Leblanc',64:'LeeSin',89:'Leona',876:'Lillia',127:'Lissandra',236:'Lucian',117:'Lulu',99:'Lux',54:'Malphite',90:'Malzahar',57:'Maokai',11:'MasterYi',800:'Mel',902:'Milio',21:'MissFortune',62:'MonkeyKing',82:'Mordekaiser',25:'Morgana',950:'Naafiri',267:'Nami',75:'Nasus',111:'Nautilus',518:'Neeko',76:'Nidalee',895:'Nilah',56:'Nocturne',20:'Nunu',2:'Olaf',61:'Orianna',516:'Ornn',80:'Pantheon',78:'Poppy',555:'Pyke',246:'Qiyana',133:'Quinn',497:'Rakan',33:'Rammus',421:'RekSai',526:'Rell',888:'Renata',58:'Renekton',107:'Rengar',92:'Riven',68:'Rumble',13:'Ryze',360:'Samira',113:'Sejuani',235:'Senna',147:'Seraphine',875:'Sett',35:'Shaco',98:'Shen',102:'Shyvana',27:'Singed',14:'Sion',15:'Sivir',72:'Skarner',901:'Smolder',37:'Sona',16:'Soraka',50:'Swain',517:'Sylas',134:'Syndra',223:'TahmKench',163:'Taliyah',91:'Talon',44:'Taric',17:'Teemo',412:'Thresh',18:'Tristana',48:'Trundle',23:'Tryndamere',4:'TwistedFate',29:'Twitch',77:'Udyr',6:'Urgot',110:'Varus',67:'Vayne',45:'Veigar',161:'Velkoz',711:'Vex',254:'Vi',234:'Viego',112:'Viktor',8:'Vladimir',106:'Volibear',19:'Warwick',498:'Xayah',101:'Xerath',5:'XinZhao',157:'Yasuo',777:'Yone',83:'Yorick',804:'Yunara',350:'Yuumi',904:'Zaahen',154:'Zac',238:'Zed',221:'Zeri',115:'Ziggs',26:'Zilean',142:'Zoe',143:'Zyra'}
  return m[id] || 'Aatrox'
}

async function onCacheUpdate({ gameData, isLive, fetchedAt }) {
  if (!props.userId) return
  liveGame.value = isLive && gameData ? { ...gameData, _fetchedAt: fetchedAt || Date.now() } : null
  checking.value = false

  if (isLive && gameData) {
    // Load existing stat bets for this game
    const allBets = await getUserBets(props.userId)
    const statBets = allBets.filter(b => b.type === 'stat' && b.gameId === String(gameData.gameId) && b.status === 'pending')
    const map = {}
    for (const b of statBets) map[b.statType] = b
    existingBets.value = map
  } else {
    existingBets.value = {}
  }
}

async function onPlace({ statType, targetValue, amount, odds }) {
  if (!liveGame.value || !props.userId) return
  await placeStatBet({
    userId: props.userId,
    playerId: props.player.id,
    playerName: props.player.gameName,
    gameId: String(liveGame.value.gameId),
    statType,
    targetValue,
    amount,
    odds,
  })
  // Mark locally
  existingBets.value = {
    ...existingBets.value,
    [statType]: { statType, targetValue, amount, odds, status: 'pending' },
  }
  emit('bet-placed')
}

function subscribeToCache() {
  unsubCache?.()
  unsubCache = subscribeLiveGame(props.player.puuid, props.userId, onCacheUpdate)
}

onMounted(() => {
  if (props.userId) subscribeToCache()
  clockTimer = setInterval(() => { now.value = Date.now() }, 1000)
})
onUnmounted(() => { unsubCache?.(); clearInterval(clockTimer) })
watch(() => props.userId, uid => { if (uid) subscribeToCache() })
watch(() => props.refreshTick, v => { if (v > 0 && props.userId) subscribeToCache() })
</script>

<style scoped>
.stat-card {
  animation: fadeUp 0.4s ease both;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: hidden;
  padding: 20px;
  transition: border-color 0.2s;
}
.stat-card.is-live { border-color: rgba(0,255,136,0.3); box-shadow: 0 0 20px rgba(0,255,136,0.06); }
.stat-card.is-offline { opacity: 0.6; }

.card-header { align-items: center; display: flex; gap: 14px; }
.player-icon { border-radius: 50%; height: 44px; width: 44px; border: 2px solid var(--border-bright); }
.player-info { flex: 1; }
.player-name { font-family: 'Rajdhani', sans-serif; font-size: 17px; font-weight: 700; letter-spacing: 0.04em; }
.player-level { color: var(--text-muted); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; }

.live-indicator {
  align-items: center; background: rgba(0,255,136,0.1); border: 1px solid rgba(0,255,136,0.4);
  border-radius: 20px; color: var(--green); display: flex; font-size: 11px; font-weight: 700;
  gap: 6px; letter-spacing: 0.08em; padding: 4px 10px;
}
.live-dot { animation: blink 1s ease infinite; background: var(--green); border-radius: 50%; height: 7px; width: 7px; }
@keyframes blink { 0%,100%{opacity:1}50%{opacity:0.2} }
.offline-indicator {
  background: var(--surface2); border: 1px solid var(--border); border-radius: 20px;
  color: var(--text-dim); font-size: 10px; font-weight: 700; letter-spacing: 0.08em; padding: 4px 10px;
}
.checking-indicator { padding: 4px 10px; }
.checking-dot { animation: blink 0.8s ease infinite; background: var(--text-muted); border-radius: 50%; display: block; height: 8px; width: 8px; }

.game-bar {
  align-items: center; background: var(--surface2); border-radius: 8px;
  display: flex; gap: 10px; padding: 8px 14px;
}
.champ-icon { border-radius: 6px; height: 28px; width: 28px; }
.game-mode { color: var(--text-muted); font-size: 12px; font-weight: 600; }
.game-sep { color: var(--text-dim); }
.game-dur { color: var(--cyan); font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; }

.stat-panels { display: flex; flex-direction: column; gap: 10px; }

.no-game { color: var(--text-dim); font-size: 13px; padding: 8px 0; text-align: center; }

@keyframes fadeUp { from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)} }
</style>