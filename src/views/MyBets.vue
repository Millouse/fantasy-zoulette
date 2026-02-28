<template>
  <div class="app-layout">
    <Navbar />
    <div class="page-content">
      <h1 class="page-title">📋 My Bets</h1>
      <p class="page-subtitle">Your betting history and results</p>

      <!-- Summary -->
      <div class="summary-row" v-if="bets.length">
        <div class="summary-card">
          <div class="summary-val">{{ bets.length }}</div>
          <div class="summary-label">Total Bets</div>
        </div>
        <div class="summary-card green">
          <div class="summary-val">{{ wonBets }}</div>
          <div class="summary-label">Won</div>
        </div>
        <div class="summary-card red">
          <div class="summary-val">{{ lostBets }}</div>
          <div class="summary-label">Lost</div>
        </div>
        <div class="summary-card gold">
          <div class="summary-val">{{ pendingBets }}</div>
          <div class="summary-label">Pending</div>
        </div>
        <div class="summary-card" :class="totalProfit >= 0 ? 'green' : 'red'">
          <div class="summary-val">{{ totalProfit >= 0 ? '+' : '' }}{{ totalProfit.toLocaleString() }}</div>
          <div class="summary-label">Net ZC</div>
        </div>
      </div>

      <div v-if="loading" class="loading-state">Loading bets…</div>

      <div v-else-if="bets.length === 0" class="empty-state">
        <div class="empty-icon">🎯</div>
        <p>No bets placed yet.</p>
        <RouterLink to="/betting" class="btn-primary" style="width:auto;padding:10px 24px;margin-top:8px;display:inline-block">Place a bet →</RouterLink>
      </div>

      <div v-else class="bets-list">
        <div
          v-for="bet in sortedBets"
          :key="bet.id"
          class="bet-row"
          :class="bet.status"
        >
          <div class="bet-player">
            <div class="bet-player-name">{{ bet.playerName }}</div>
            <div class="bet-game-id">Game #{{ bet.gameId }}</div>
          </div>
          <div class="bet-prediction" :class="bet.prediction">
            {{ bet.prediction === 'yes' ? '✓ WIN' : '✗ LOSE' }}
          </div>
          <div class="bet-amount">
            <span class="coin-icon">🪙</span>
            {{ bet.amount.toLocaleString() }} ZC
          </div>
          <div class="bet-status-badge" :class="bet.status">
            <template v-if="bet.status === 'won'">
              🏆 +{{ bet.payout.toLocaleString() }} ZC
            </template>
            <template v-else-if="bet.status === 'lost'">
              💀 Lost
            </template>
            <template v-else>
              ⏳ Pending
            </template>
          </div>
          <div class="bet-date">{{ formatDate(bet.createdAt) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { useAuthStore } from '../stores/auth'
import Navbar from '../components/Navbar.vue'
import { db } from '../firebase'

const authStore = useAuthStore()
const bets = ref([])
const loading = ref(true)
let unsubBets = null

function subscribeToBets(uid) {
  if (unsubBets) { unsubBets(); unsubBets = null }
  const q = query(collection(db, 'bets'), where('userId', '==', uid))
  unsubBets = onSnapshot(q, (snap) => {
    bets.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    loading.value = false
  })
}

onMounted(() => {
  if (authStore.user?.uid) subscribeToBets(authStore.user.uid)
})

watch(() => authStore.user?.uid, (uid) => {
  if (uid) subscribeToBets(uid)
})

onUnmounted(() => {
  if (unsubBets) unsubBets()
})

const sortedBets = computed(() => [...bets.value].sort((a, b) => {
  const at = a.createdAt?.seconds || 0
  const bt = b.createdAt?.seconds || 0
  return bt - at
}))

const wonBets = computed(() => bets.value.filter(b => b.status === 'won').length)
const lostBets = computed(() => bets.value.filter(b => b.status === 'lost').length)
const pendingBets = computed(() => bets.value.filter(b => b.status === 'pending').length)
const totalProfit = computed(() => {
  return bets.value.reduce((acc, b) => {
    if (b.status === 'won') return acc + (b.payout - b.amount)
    if (b.status === 'lost') return acc - b.amount
    return acc
  }, 0)
})

function formatDate(ts) {
  if (!ts) return '—'
  const date = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.summary-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 32px;
}
.summary-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  flex: 1;
  min-width: 100px;
  padding: 16px;
  text-align: center;
}
.summary-card.green { border-color: rgba(0,255,136,0.3); }
.summary-card.red { border-color: rgba(255,71,87,0.3); }
.summary-card.gold { border-color: rgba(255,200,0,0.3); }
.summary-val {
  font-family: 'Rajdhani', sans-serif;
  font-size: 26px;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 4px;
}
.summary-card.green .summary-val { color: var(--green); }
.summary-card.red .summary-val { color: var(--red); }
.summary-card.gold .summary-val { color: var(--gold); }
.summary-label { color: var(--text-muted); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; }

.bets-list { display: flex; flex-direction: column; gap: 8px; }
.bet-row {
  align-items: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  display: flex;
  gap: 16px;
  padding: 14px 18px;
  transition: border-color 0.3s;
}
.bet-row.won { border-color: rgba(0,255,136,0.2); }
.bet-row.lost { border-color: rgba(255,71,87,0.15); opacity: 0.7; }

.bet-player { flex: 1; min-width: 0; }
.bet-player-name { font-family: 'Rajdhani', sans-serif; font-size: 16px; font-weight: 700; letter-spacing: 0.03em; }
.bet-game-id { color: var(--text-dim); font-size: 11px; font-family: monospace; margin-top: 2px; }

.bet-prediction { font-size: 13px; font-weight: 700; letter-spacing: 0.06em; min-width: 60px; }
.bet-prediction.yes { color: var(--green); }
.bet-prediction.no { color: var(--red); }

.bet-amount { align-items: center; color: var(--text-muted); display: flex; font-size: 14px; gap: 4px; min-width: 100px; }
.coin-icon { font-size: 14px; }

.bet-status-badge {
  font-family: 'Rajdhani', sans-serif;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.04em;
  min-width: 120px;
  text-align: right;
  transition: color 0.3s;
}
.bet-status-badge.won { color: var(--green); }
.bet-status-badge.lost { color: var(--red); }
.bet-status-badge.pending { color: var(--gold); }

.bet-date { color: var(--text-dim); font-size: 12px; min-width: 100px; text-align: right; }

.loading-state { color: var(--text-muted); padding: 40px; text-align: center; }
.empty-state {
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 80px auto;
  text-align: center;
}
.empty-icon { font-size: 48px; }
.empty-state p { color: var(--text-muted); }
</style>