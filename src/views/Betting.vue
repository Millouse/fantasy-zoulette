<template>
  <div class="app-layout">
    <Navbar />
    <div class="page-content">
      <div class="page-header">
        <div>
          <h1 class="page-title">⚡ Live Bets</h1>
          <p class="page-subtitle">Place your bets on players currently in a live game</p>
        </div>
        <div class="refresh-area">
          <span class="next-refresh">next refresh in {{ countdown }}s</span>
          <button class="btn-refresh" @click="refreshAll" :class="{ spinning: refreshing }">
            ↻ Refresh
          </button>
        </div>
      </div>

      <div v-if="loading" class="loading-grid">
        <div v-for="i in 3" :key="i" class="skeleton-card"></div>
      </div>

      <div v-else-if="players.length === 0" class="empty-state">
        <div class="empty-icon">🎮</div>
        <p>No players tracked yet.</p>
        <span v-if="authStore.isAdmin">Go to Admin to add players.</span>
      </div>

      <div v-else class="players-grid">
        <PlayerBetCard
          v-for="player in visiblePlayers"
          :key="player.id"
          :player="player"
          :userCoins="authStore.coins"
          :userId="authStore.user?.uid"
          :refreshTick="refreshTick"
          @bet-placed="onBetPlaced"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { onSnapshot, doc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuthStore } from '../stores/auth'
import Navbar from '../components/Navbar.vue'
import PlayerBetCard from '../components/PlayerBetCard.vue'
import { getPlayers } from '../services/players'
import { forceRefreshAll } from '../services/liveGameCache'

const authStore = useAuthStore()
const players = ref([])
const loading = ref(true)
const refreshing = ref(false)
const refreshTick = ref(0)
const countdown = ref(60)

// Tracks the real timestamp of the last completed Riot API fetch
// Read from Firestore cache so it's accurate even across tabs/pages
const lastFetchedAt = ref(Date.now())

let countdownTimer = null
let unsubFetchedAt = null

const visiblePlayers = computed(() => {
  const userPuuid = authStore.user?.riotPuuid
  if (!userPuuid) return players.value
  return players.value.filter(p => p.puuid !== userPuuid)
})

async function loadPlayers() {
  players.value = await getPlayers()
}

// Watch the first player's cache doc to get real fetchedAt timestamps
// When the poller writes a new fetchedAt (even for offline players), the
// countdown resets correctly
function watchFetchTimestamp(puuid) {
  unsubFetchedAt?.()
  unsubFetchedAt = onSnapshot(doc(db, 'liveGameCache', puuid), (snap) => {
    const data = snap.data()
    if (data?.fetchedAt) {
      lastFetchedAt.value = data.fetchedAt
    }
  })
}

// Countdown ticks every second, always computed from elapsed time
// Never drifts, never pauses, auto-resets when fetchedAt updates
function startCountdownTick() {
  countdownTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - lastFetchedAt.value) / 1000)
    countdown.value = Math.max(0, 60 - elapsed)
  }, 1000)
}

async function refreshAll() {
  refreshing.value = true
  refreshTick.value++
  await forceRefreshAll(authStore.user?.uid)
  setTimeout(() => refreshing.value = false, 800)
}

function onBetPlaced() {}

onMounted(async () => {
  await loadPlayers()
  loading.value = false

  // Watch first available player's cache for fetch timestamps
  if (players.value.length > 0) {
    watchFetchTimestamp(players.value[0].puuid)
  }

  startCountdownTick()
})

onUnmounted(() => {
  unsubFetchedAt?.()
  clearInterval(countdownTimer)
})
</script>

<style scoped>
.page-header {
  align-items: flex-start;
  display: flex;
  justify-content: space-between;
  margin-bottom: 32px;
}

.refresh-area { align-items: center; display: flex; gap: 10px; }
.next-refresh { color: var(--text-dim); font-size: 11px; letter-spacing: 0.04em; }

.btn-refresh {
  background: var(--surface2);
  border: 1px solid var(--border-bright);
  border-radius: 8px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 8px 16px;
  transition: color 0.2s, border-color 0.2s;
}
.btn-refresh:hover { border-color: var(--cyan); color: var(--cyan); }
.btn-refresh.spinning { animation: spin 0.6s linear; }
@keyframes spin { to { transform: rotate(360deg); } }

.players-grid {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
}

.loading-grid {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
}
.skeleton-card {
  animation: shimmer 1.4s infinite;
  background: linear-gradient(90deg, var(--surface) 25%, var(--surface2) 50%, var(--surface) 75%);
  background-size: 200% 100%;
  border-radius: 14px;
  height: 260px;
}
@keyframes shimmer { to { background-position: -200% 0; } }

.empty-state {
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 80px auto;
  text-align: center;
}
.empty-icon { font-size: 48px; margin-bottom: 8px; }
.empty-state p { color: var(--text-muted); font-size: 16px; }
.empty-state span { color: var(--text-dim); font-size: 13px; }
</style>