<template>
  <div class="app-layout">
    <Navbar />
    <div class="page-content">
      <h1 class="page-title">📋 My Bets</h1>
      <p class="page-subtitle">Historique et résultats de tes paris</p>

      <!-- Summary -->
      <div class="summary-row" v-if="bets.length">
        <div class="summary-card">
          <div class="summary-val">{{ bets.length }}</div>
          <div class="summary-label">Total</div>
        </div>
        <div class="summary-card green">
          <div class="summary-val">{{ wonBets }}</div>
          <div class="summary-label">Gagnés</div>
        </div>
        <div class="summary-card red">
          <div class="summary-val">{{ lostBets }}</div>
          <div class="summary-label">Perdus</div>
        </div>
        <div class="summary-card gold">
          <div class="summary-val">{{ pendingBets }}</div>
          <div class="summary-label">En cours</div>
        </div>
        <div class="summary-card" :class="totalProfit >= 0 ? 'green' : 'red'">
          <div class="summary-val">{{ totalProfit >= 0 ? '+' : '' }}{{ totalProfit.toLocaleString() }}</div>
          <div class="summary-label">Net ZC</div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tab-row" v-if="bets.length">
        <button :class="{ active: tab === 'all' }" @click="tab = 'all'">Tous ({{ bets.length }})</button>
        <button :class="{ active: tab === 'outcome' }" @click="tab = 'outcome'">
          🎯 WIN/LOSE <span class="tab-count">{{ outcomeBets.length }}</span>
        </button>
        <button :class="{ active: tab === 'stat' }" @click="tab = 'stat'">
          📊 Stats <span class="tab-count">{{ statBetsList.length }}</span>
        </button>
      </div>

      <div v-if="loading" class="loading-state">Chargement…</div>

      <div v-else-if="bets.length === 0" class="empty-state">
        <div class="empty-icon">🎯</div>
        <p>Aucun pari pour l'instant.</p>
        <RouterLink to="/betting" class="btn-primary" style="width:auto;padding:10px 24px;margin-top:8px;display:inline-block">
          Placer un pari →
        </RouterLink>
      </div>

      <div v-else class="bets-list">
        <div
          v-for="bet in filteredBets"
          :key="bet.id"
          class="bet-row"
          :class="[bet.status, bet.type === 'stat' ? 'is-stat' : 'is-outcome']"
        >
          <!-- Left: player + type badge -->
          <div class="bet-left">
            <div class="bet-player-name">{{ bet.playerName }}</div>
            <div class="bet-meta">
              <span class="type-badge" :class="bet.type === 'stat' ? 'badge-stat' : 'badge-outcome'">
                {{ bet.type === 'stat' ? '📊 STAT' : '🎯 WIN/LOSE' }}
              </span>
              <span class="bet-game-id">{{ shortGameId(bet.gameId) }}</span>
            </div>
          </div>

          <!-- Middle: prediction details -->
          <div class="bet-prediction-col">
            <!-- Outcome bet -->
            <template v-if="bet.type !== 'stat'">
              <span class="pred-badge" :class="bet.prediction">
                {{ bet.prediction === 'yes' ? '✅ WIN' : '❌ LOSE' }}
              </span>
            </template>
            <!-- Stat bet -->
            <template v-else>
              <span class="stat-type-icon">{{ statIcon(bet.statType) }}</span>
              <span class="stat-desc">
                {{ statLabel(bet.statType) }} ≥ <strong>{{ formatStatValue(bet.statType, bet.targetValue) }}</strong>
              </span>
              <span v-if="bet.status !== 'pending' && bet.actualValue != null" class="actual-value">
                Réel : {{ formatStatValue(bet.statType, bet.actualValue) }}
              </span>
            </template>
          </div>

          <!-- Amount + odds -->
          <div class="bet-amount-col">
            <span class="coin-icon">🪙</span>
            <span class="amount-val">{{ bet.amount.toLocaleString() }} ZC</span>
            <span class="odds-tag">@ {{ bet.odds }}x</span>
          </div>

          <!-- Result -->
          <div class="bet-result" :class="bet.status">
            <template v-if="bet.status === 'won'">
              🏆 <span>+{{ bet.payout.toLocaleString() }} ZC</span>
            </template>
            <template v-else-if="bet.status === 'lost'">
              💀 <span>Perdu</span>
            </template>
            <template v-else>
              ⏳ <span>En cours</span>
            </template>
          </div>

          <!-- Date -->
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
const tab = ref('all')
let unsubBets = null

function subscribeToBets(uid) {
  if (unsubBets) { unsubBets(); unsubBets = null }
  const q = query(collection(db, 'bets'), where('userId', '==', uid))
  unsubBets = onSnapshot(q, (snap) => {
    bets.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    loading.value = false
  })
}

onMounted(() => { if (authStore.user?.uid) subscribeToBets(authStore.user.uid) })
watch(() => authStore.user?.uid, uid => { if (uid) subscribeToBets(uid) })
onUnmounted(() => { if (unsubBets) unsubBets() })

const sortedBets = computed(() =>
  [...bets.value].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
)
const outcomeBets = computed(() => sortedBets.value.filter(b => b.type !== 'stat'))
const statBetsList = computed(() => sortedBets.value.filter(b => b.type === 'stat'))
const filteredBets = computed(() => {
  if (tab.value === 'outcome') return outcomeBets.value
  if (tab.value === 'stat') return statBetsList.value
  return sortedBets.value
})

const wonBets = computed(() => bets.value.filter(b => b.status === 'won').length)
const lostBets = computed(() => bets.value.filter(b => b.status === 'lost').length)
const pendingBets = computed(() => bets.value.filter(b => b.status === 'pending').length)
const totalProfit = computed(() => bets.value.reduce((acc, b) => {
  if (b.status === 'won') return acc + (b.payout - b.amount)
  if (b.status === 'lost') return acc - b.amount
  return acc
}, 0))

function shortGameId(id) {
  return id ? '#' + String(id).split('_').pop() : '—'
}

function statIcon(type) {
  return { kda: '⚔️', duration: '⏱️', cspm: '🌾' }[type] || '📊'
}

function statLabel(type) {
  return { kda: 'KDA', duration: 'Durée', cspm: 'CS/min' }[type] || type
}

function formatStatValue(type, val) {
  if (val == null) return '—'
  if (type === 'kda') return Number(val).toFixed(1)
  if (type === 'duration') return `${Number(val).toFixed(0)} min`
  if (type === 'cspm') return `${Number(val).toFixed(1)} cs/min`
  return val
}

function formatDate(ts) {
  if (!ts) return '—'
  const date = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts)
  return date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.summary-row { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 28px; }
.summary-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
  flex: 1; min-width: 90px; padding: 16px; text-align: center;
}
.summary-card.green { border-color: rgba(0,255,136,0.3); }
.summary-card.red { border-color: rgba(255,71,87,0.3); }
.summary-card.gold { border-color: rgba(255,200,0,0.3); }
.summary-val { font-family: 'Rajdhani', sans-serif; font-size: 26px; font-weight: 700; line-height: 1; margin-bottom: 4px; }
.summary-card.green .summary-val { color: var(--green); }
.summary-card.red .summary-val { color: var(--red); }
.summary-card.gold .summary-val { color: var(--gold); }
.summary-label { color: var(--text-muted); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; }

/* Tabs */
.tab-row { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
.tab-row button {
  align-items: center; background: var(--surface2); border: 1px solid var(--border);
  border-radius: 20px; color: var(--text-muted); display: flex; font-size: 12px;
  font-weight: 600; gap: 6px; letter-spacing: 0.04em; padding: 6px 16px; transition: all 0.2s;
}
.tab-row button:hover { border-color: var(--cyan); color: var(--text); }
.tab-row button.active { background: rgba(0,212,255,0.1); border-color: var(--cyan); color: var(--cyan); }
.tab-count { background: var(--surface); border-radius: 10px; font-size: 10px; padding: 1px 6px; }

/* Bet list */
.bets-list { display: flex; flex-direction: column; gap: 8px; }
.bet-row {
  align-items: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 3px solid var(--border);
  border-radius: 10px;
  display: grid;
  grid-template-columns: 1fr 200px 160px 140px 110px;
  gap: 12px;
  padding: 14px 18px;
  transition: border-color 0.2s;
}
.bet-row.won { border-left-color: var(--green); }
.bet-row.lost { border-left-color: var(--red); opacity: 0.75; }
.bet-row.pending.is-stat { border-left-color: var(--cyan); }
.bet-row.pending.is-outcome { border-left-color: var(--gold); }

/* Left col */
.bet-left { min-width: 0; }
.bet-player-name { font-family: 'Rajdhani', sans-serif; font-size: 16px; font-weight: 700; letter-spacing: 0.03em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bet-meta { align-items: center; display: flex; gap: 8px; margin-top: 3px; }
.type-badge { border-radius: 4px; font-size: 9px; font-weight: 800; letter-spacing: 0.08em; padding: 2px 6px; text-transform: uppercase; }
.badge-outcome { background: rgba(255,200,0,0.12); border: 1px solid rgba(255,200,0,0.3); color: var(--gold); }
.badge-stat { background: rgba(0,212,255,0.1); border: 1px solid rgba(0,212,255,0.3); color: var(--cyan); }
.bet-game-id { color: var(--text-dim); font-family: monospace; font-size: 11px; }

/* Prediction col */
.bet-prediction-col { align-items: center; display: flex; flex-wrap: wrap; gap: 6px; }
.pred-badge { font-size: 13px; font-weight: 700; letter-spacing: 0.04em; }
.pred-badge.yes { color: var(--green); }
.pred-badge.no { color: var(--red); }
.stat-type-icon { font-size: 16px; }
.stat-desc { color: var(--text-muted); font-size: 12px; }
.stat-desc strong { color: var(--text); }
.actual-value { background: var(--surface2); border-radius: 4px; color: var(--text-muted); font-size: 11px; padding: 1px 6px; width: 100%; }

/* Amount col */
.bet-amount-col { align-items: center; color: var(--text-muted); display: flex; font-size: 13px; gap: 4px; }
.coin-icon { font-size: 13px; }
.amount-val { color: var(--gold); font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 700; }
.odds-tag { color: var(--text-dim); font-size: 11px; }

/* Result */
.bet-result { align-items: center; display: flex; font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 700; gap: 5px; letter-spacing: 0.04em; }
.bet-result.won { color: var(--green); }
.bet-result.lost { color: var(--red); }
.bet-result.pending { color: var(--gold); }

.bet-date { color: var(--text-dim); font-size: 11px; text-align: right; }

.loading-state { color: var(--text-muted); padding: 40px; text-align: center; }
.empty-state { align-items: center; display: flex; flex-direction: column; gap: 10px; margin: 80px auto; text-align: center; }
.empty-icon { font-size: 48px; }
.empty-state p { color: var(--text-muted); }
</style>