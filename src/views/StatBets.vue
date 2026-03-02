<template>
  <div class="app-layout">
    <Navbar />
    <div class="page-content">
      <div class="page-header">
        <div>
          <h1 class="page-title">📊 Paris Stats</h1>
          <p class="page-subtitle">Parie sur les performances — KDA, durée de game, CS/min</p>
        </div>
        <div class="refresh-area">
          <span class="next-refresh">refresh dans {{ countdown }}s</span>
          <button class="btn-refresh" @click="refreshAll" :class="{ spinning: refreshing }">↻ Refresh</button>
        </div>
      </div>

      <!-- Odds explanation -->
      <div class="odds-explainer">
        <div class="odds-rule" v-for="r in oddsRules" :key="r.label">
          <span class="rule-icon">{{ r.icon }}</span>
          <div class="rule-body">
            <span class="rule-label">{{ r.label }}</span>
            <span class="rule-range">{{ r.range }}</span>
          </div>
          <div class="rule-odds">
            <span class="odds-from">{{ r.from }}x</span>
            <div class="odds-arrow">→</div>
            <span class="odds-to">{{ r.to }}x</span>
          </div>
        </div>
      </div>

      <div v-if="loading" class="loading-grid">
        <div v-for="i in 3" :key="i" class="skeleton-card"></div>
      </div>

      <div v-else-if="visiblePlayers.length === 0" class="empty-state">
        <div class="empty-icon">📊</div>
        <p>Aucun joueur suivi pour l'instant.</p>
      </div>

      <div v-else class="players-grid">
        <StatBetCard
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
import StatBetCard from '../components/StatBetCard.vue'
import { getPlayers } from '../services/players'
import { forceRefreshAll } from '../services/liveGameCache'

const authStore = useAuthStore()
const players = ref([])
const loading = ref(true)
const refreshing = ref(false)
const refreshTick = ref(0)
const countdown = ref(60)
const lastFetchedAt = ref(Date.now())

let countdownTimer = null
let unsubFetchedAt = null

const oddsRules = [
  { icon: '⚔️', label: 'KDA', range: '2.0 → 10+', from: '1.3', to: '4.0' },
  { icon: '⏱️', label: 'Durée', range: '25 min → 90 min', from: '1.3', to: '3.5' },
  { icon: '🌾', label: 'CS/min', range: '7 → 20', from: '1.3', to: '3.5' },
]

const visiblePlayers = computed(() => {
  const userPuuid = authStore.user?.riotPuuid
  if (!userPuuid) return players.value
  return players.value.filter(p => p.puuid !== userPuuid)
})

function watchFetchTimestamp(puuid) {
  unsubFetchedAt?.()
  unsubFetchedAt = onSnapshot(doc(db, 'liveGameCache', puuid), snap => {
    const data = snap.data()
    if (data?.fetchedAt) lastFetchedAt.value = data.fetchedAt
  })
}

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
  players.value = await getPlayers()
  loading.value = false
  if (players.value.length > 0) watchFetchTimestamp(players.value[0].puuid)
  startCountdownTick()
})

onUnmounted(() => {
  unsubFetchedAt?.()
  clearInterval(countdownTimer)
})
</script>

<style scoped>
.page-header {
  align-items: flex-start; display: flex; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;
}
.refresh-area { align-items: center; display: flex; gap: 10px; }
.next-refresh { color: var(--text-dim); font-size: 11px; }
.btn-refresh {
  background: var(--surface2); border: 1px solid var(--border-bright); border-radius: 8px;
  color: var(--text-muted); font-size: 13px; font-weight: 600; padding: 8px 16px; transition: all 0.2s;
}
.btn-refresh:hover { border-color: var(--cyan); color: var(--cyan); }
.btn-refresh.spinning { animation: spin 0.6s linear; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Odds explainer */
.odds-explainer {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 1px;
  margin-bottom: 28px;
  overflow: hidden;
}
.odds-rule {
  align-items: center; background: var(--surface2); display: flex; flex: 1;
  gap: 12px; min-width: 200px; padding: 14px 18px;
}
.rule-icon { font-size: 22px; }
.rule-body { display: flex; flex: 1; flex-direction: column; gap: 2px; }
.rule-label { font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
.rule-range { color: var(--text-dim); font-size: 11px; }
.rule-odds { align-items: center; display: flex; gap: 6px; }
.odds-from { color: var(--cyan); font-family: 'Rajdhani', sans-serif; font-size: 16px; font-weight: 700; }
.odds-arrow { color: var(--text-dim); font-size: 12px; }
.odds-to { color: var(--red); font-family: 'Rajdhani', sans-serif; font-size: 16px; font-weight: 700; }

.players-grid { display: grid; gap: 20px; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); }

.loading-grid { display: grid; gap: 20px; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); }
.skeleton-card {
  animation: shimmer 1.4s infinite;
  background: linear-gradient(90deg, var(--surface) 25%, var(--surface2) 50%, var(--surface) 75%);
  background-size: 200% 100%; border-radius: 14px; height: 380px;
}
@keyframes shimmer { to { background-position: -200% 0; } }

.empty-state { align-items: center; display: flex; flex-direction: column; gap: 10px; margin: 80px auto; text-align: center; }
.empty-icon { font-size: 48px; margin-bottom: 8px; }
.empty-state p { color: var(--text-muted); font-size: 16px; }
</style>