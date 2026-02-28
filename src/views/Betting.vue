<template>
  <div class="app-layout">
    <Navbar />
    <div class="page-content">
      <div class="page-header">
        <div>
          <h1 class="page-title">⚡ Live Bets</h1>
          <p class="page-subtitle">Place your bets on players currently in a live game</p>
        </div>
        <button class="btn-refresh" @click="refreshAll" :class="{ spinning: refreshing }">
          ↻ Refresh
        </button>
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
          v-for="player in players"
          :key="player.id"
          :player="player"
          :userCoins="authStore.coins"
          :userId="authStore.user.uid"
          :refreshTick="refreshTick"
          @bet-placed="onBetPlaced"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import Navbar from '../components/Navbar.vue'
import PlayerBetCard from '../components/PlayerBetCard.vue'
import { getPlayers } from '../services/players'

const authStore = useAuthStore()
const players = ref([])
const loading = ref(true)
const refreshing = ref(false)
const refreshTick = ref(0)

async function loadPlayers() {
  players.value = await getPlayers()
}

async function refreshAll() {
  refreshing.value = true
  refreshTick.value++  // triggers watch in each PlayerBetCard
  setTimeout(() => refreshing.value = false, 800)
}

function onBetPlaced() {}

watch(
  () => authStore.user,
  async (user) => {
    if (!user) return
    loading.value = true
    await loadPlayers()
    loading.value = false
  },
  { immediate: true }
)
</script>

<style scoped>
.page-header {
  align-items: flex-start;
  display: flex;
  justify-content: space-between;
  margin-bottom: 32px;
}

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