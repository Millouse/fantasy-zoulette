<template>
  <div class="app-layout">
    <Navbar />
    <div class="page-content">
      <div class="page-header">
        <div>
          <h1 class="page-title">🏆 Leaderboard</h1>
          <p class="page-subtitle">Les meilleurs parieurs de ZouletteGG</p>
        </div>
        <div class="tab-pills">
          <button :class="{ active: tab === 'coins' }" @click="tab = 'coins'">🪙 Coins</button>
          <button :class="{ active: tab === 'winrate' }" @click="tab = 'winrate'">🎯 Win Rate</button>
          <button :class="{ active: tab === 'bets' }" @click="tab = 'bets'">📊 Most Bets</button>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="loading-rows">
        <div v-for="i in 8" :key="i" class="skeleton-row"></div>
      </div>

      <!-- Podium top 3 -->
      <div v-else-if="sorted.length >= 3" class="podium">
        <!-- 2nd -->
        <div class="podium-slot second">
          <div class="podium-avatar">{{ initials(sorted[1]) }}</div>
          <div class="podium-name">{{ sorted[1].displayName || sorted[1].email }}</div>
          <div class="podium-value">{{ podiumValue(sorted[1]) }}</div>
          <div class="podium-base second-base">
            <span class="podium-rank">2</span>
          </div>
        </div>
        <!-- 1st -->
        <div class="podium-slot first">
          <div class="podium-crown">👑</div>
          <div class="podium-avatar gold">{{ initials(sorted[0]) }}</div>
          <div class="podium-name">{{ sorted[0].displayName || sorted[0].email }}</div>
          <div class="podium-value gold-text">{{ podiumValue(sorted[0]) }}</div>
          <div class="podium-base first-base">
            <span class="podium-rank">1</span>
          </div>
        </div>
        <!-- 3rd -->
        <div class="podium-slot third">
          <div class="podium-avatar bronze">{{ initials(sorted[2]) }}</div>
          <div class="podium-name">{{ sorted[2].displayName || sorted[2].email }}</div>
          <div class="podium-value">{{ podiumValue(sorted[2]) }}</div>
          <div class="podium-base third-base">
            <span class="podium-rank">3</span>
          </div>
        </div>
      </div>

      <!-- Full table -->
      <div v-if="!loading" class="leaderboard-table">
        <div class="table-header">
          <span class="col-rank">#</span>
          <span class="col-player">Player</span>
          <span class="col-stat">🪙 Coins</span>
          <span class="col-stat">Bets</span>
          <span class="col-stat">Won</span>
          <span class="col-stat">Win Rate</span>
          <span class="col-stat">Best Win</span>
        </div>

        <div
          v-for="(user, i) in sorted"
          :key="user.id"
          class="table-row"
          :class="{
            'rank-1': i === 0,
            'rank-2': i === 1,
            'rank-3': i === 2,
            'is-me': user.id === authStore.user?.uid
          }"
        >
          <span class="col-rank">
            <span v-if="i === 0" class="medal">🥇</span>
            <span v-else-if="i === 1" class="medal">🥈</span>
            <span v-else-if="i === 2" class="medal">🥉</span>
            <span v-else class="rank-num">{{ i + 1 }}</span>
          </span>

          <span class="col-player">
            <div class="player-avatar" :class="{ 'avatar-me': user.id === authStore.user?.uid }">
              {{ initials(user) }}
            </div>
            <div class="player-info">
              <div class="player-name">
                {{ user.displayName || user.email?.split('@')[0] }}
                <span v-if="user.id === authStore.user?.uid" class="you-badge">YOU</span>
              </div>
              <div class="player-sub">{{ user.totalBets }} bets placés</div>
            </div>
          </span>

          <span class="col-stat coins-val">{{ user.coins.toLocaleString() }} <span class="zc">ZC</span></span>
          <span class="col-stat">{{ user.totalBets }}</span>
          <span class="col-stat green-val">{{ user.wonBets }}</span>
          <span class="col-stat">
            <div class="winrate-wrap">
              <div class="winrate-bar">
                <div class="winrate-fill" :style="{ width: user.winRate + '%' }"></div>
              </div>
              <span :class="winRateClass(user.winRate)">{{ user.winRate }}%</span>
            </div>
          </span>
          <span class="col-stat best-win">
            {{ user.bestWin > 0 ? '+' + user.bestWin.toLocaleString() + ' ZC' : '—' }}
          </span>
        </div>

        <div v-if="sorted.length === 0" class="empty-table">
          Aucun parieur pour l'instant.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuthStore } from '../stores/auth'
import Navbar from '../components/Navbar.vue'

const authStore = useAuthStore()
const loading = ref(true)
const tab = ref('coins')
const users = ref([])

async function loadLeaderboard() {
  // Fetch all users
  const usersSnap = await getDocs(collection(db, 'users'))
  const rawUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }))

  // Fetch all resolved bets
  const betsSnap = await getDocs(
    query(collection(db, 'bets'), where('status', 'in', ['won', 'lost']))
  )
  const bets = betsSnap.docs.map(d => d.data())

  // Aggregate per user
  users.value = rawUsers.map(u => {
    const userBets = bets.filter(b => b.userId === u.id)
    const wonBets = userBets.filter(b => b.status === 'won')
    const totalBets = userBets.length
    const winRate = totalBets > 0 ? Math.round((wonBets.length / totalBets) * 100) : 0
    const bestWin = wonBets.length > 0 ? Math.max(...wonBets.map(b => b.payout - b.amount)) : 0

    return {
      ...u,
      totalBets,
      wonBets: wonBets.length,
      winRate,
      bestWin,
    }
  }).filter(u => u.coins !== undefined)
}

const sorted = computed(() => {
  const list = [...users.value]
  if (tab.value === 'coins') return list.sort((a, b) => b.coins - a.coins)
  if (tab.value === 'winrate') return list.filter(u => u.totalBets >= 3).sort((a, b) => b.winRate - a.winRate || b.totalBets - a.totalBets)
  if (tab.value === 'bets') return list.sort((a, b) => b.totalBets - a.totalBets)
  return list
})

function podiumValue(user) {
  if (tab.value === 'coins') return user.coins.toLocaleString() + ' ZC'
  if (tab.value === 'winrate') return user.winRate + '%'
  if (tab.value === 'bets') return user.totalBets + ' bets'
  return ''
}

function initials(user) {
  const name = user?.displayName || user?.email || '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function winRateClass(rate) {
  if (rate >= 60) return 'wr-hot'
  if (rate >= 45) return 'wr-ok'
  return 'wr-cold'
}

onMounted(async () => {
  await loadLeaderboard()
  loading.value = false
})
</script>

<style scoped>
.page-header {
  align-items: flex-start;
  display: flex;
  justify-content: space-between;
  margin-bottom: 36px;
  flex-wrap: wrap;
  gap: 16px;
}

.tab-pills { display: flex; gap: 8px; }
.tab-pills button {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 20px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  padding: 6px 16px;
  transition: all 0.2s;
}
.tab-pills button:hover { border-color: var(--cyan); color: var(--cyan); }
.tab-pills button.active { background: rgba(0,212,255,0.12); border-color: var(--cyan); color: var(--cyan); }

/* ── Podium ── */
.podium {
  align-items: flex-end;
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 40px;
}

.podium-slot { align-items: center; display: flex; flex-direction: column; flex: 1; max-width: 180px; }

.podium-crown { font-size: 24px; margin-bottom: 4px; }

.podium-avatar {
  align-items: center;
  background: var(--surface2);
  border: 2px solid var(--border-bright);
  border-radius: 50%;
  color: var(--text);
  display: flex;
  font-size: 18px;
  font-weight: 800;
  height: 56px;
  justify-content: center;
  margin-bottom: 8px;
  width: 56px;
}
.podium-avatar.gold { background: rgba(255,200,0,0.15); border-color: var(--gold); color: var(--gold); box-shadow: 0 0 20px rgba(255,200,0,0.2); }
.podium-avatar.bronze { background: rgba(205,127,50,0.12); border-color: #cd7f32; color: #cd7f32; }

.podium-name { color: var(--text); font-size: 13px; font-weight: 700; margin-bottom: 2px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px; }
.podium-value { color: var(--text-muted); font-family: 'Rajdhani', sans-serif; font-size: 15px; font-weight: 700; margin-bottom: 8px; }
.podium-value.gold-text { color: var(--gold); }

.podium-base {
  align-items: center;
  border-radius: 8px 8px 0 0;
  display: flex;
  justify-content: center;
  width: 100%;
}
.first-base { background: rgba(255,200,0,0.15); border: 1px solid rgba(255,200,0,0.3); border-bottom: none; height: 80px; }
.second-base { background: rgba(192,192,192,0.08); border: 1px solid rgba(192,192,192,0.2); border-bottom: none; height: 60px; }
.third-base { background: rgba(205,127,50,0.08); border: 1px solid rgba(205,127,50,0.2); border-bottom: none; height: 44px; }

.podium-rank { color: var(--text-dim); font-family: 'Rajdhani', sans-serif; font-size: 28px; font-weight: 800; align-self: flex-start; padding-top: 10px; }
.first-base .podium-rank { color: var(--gold); }

/* ── Table ── */
.leaderboard-table {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
}

.table-header {
  align-items: center;
  background: var(--surface2);
  border-bottom: 1px solid var(--border);
  color: var(--text-dim);
  display: grid;
  font-size: 10px;
  font-weight: 700;
  grid-template-columns: 48px 1fr 120px 64px 64px 120px 110px;
  letter-spacing: 0.1em;
  padding: 10px 20px;
  text-transform: uppercase;
}

.table-row {
  align-items: center;
  border-bottom: 1px solid var(--border);
  display: grid;
  grid-template-columns: 48px 1fr 120px 64px 64px 120px 110px;
  padding: 12px 20px;
  transition: background 0.15s;
}
.table-row:last-child { border-bottom: none; }
.table-row:hover { background: var(--surface2); }
.table-row.is-me { background: rgba(0,212,255,0.04); border-left: 2px solid var(--cyan); }
.table-row.rank-1 { background: rgba(255,200,0,0.04); }
.table-row.rank-2 { background: rgba(192,192,192,0.03); }
.table-row.rank-3 { background: rgba(205,127,50,0.03); }

.col-rank { align-items: center; display: flex; }
.medal { font-size: 20px; }
.rank-num { color: var(--text-dim); font-family: 'Rajdhani', sans-serif; font-size: 16px; font-weight: 700; }

.col-player { align-items: center; display: flex; gap: 12px; min-width: 0; }
.player-avatar {
  align-items: center;
  background: var(--surface2);
  border: 1px solid var(--border-bright);
  border-radius: 50%;
  color: var(--text-muted);
  display: flex;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 800;
  height: 36px;
  justify-content: center;
  width: 36px;
}
.player-avatar.avatar-me { background: rgba(0,212,255,0.12); border-color: var(--cyan); color: var(--cyan); }
.player-info { min-width: 0; }
.player-name { align-items: center; display: flex; font-size: 14px; font-weight: 700; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.player-sub { color: var(--text-dim); font-size: 11px; margin-top: 1px; }

.you-badge {
  background: rgba(0,212,255,0.15);
  border: 1px solid rgba(0,212,255,0.4);
  border-radius: 4px;
  color: var(--cyan);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 1px 5px;
}

.col-stat { align-items: center; display: flex; font-size: 13px; font-weight: 600; }
.coins-val { color: var(--gold); font-family: 'Rajdhani', sans-serif; font-size: 15px; }
.zc { color: var(--text-dim); font-size: 10px; font-weight: 600; margin-left: 3px; }
.green-val { color: var(--green); }
.best-win { color: var(--cyan); font-family: 'Rajdhani', sans-serif; font-size: 13px; }

.winrate-wrap { align-items: center; display: flex; gap: 8px; width: 100%; }
.winrate-bar { background: var(--surface2); border-radius: 4px; flex: 1; height: 5px; overflow: hidden; }
.winrate-fill { background: var(--green); border-radius: 4px; height: 100%; transition: width 0.5s ease; }
.wr-hot { color: var(--green); font-size: 12px; font-weight: 700; }
.wr-ok { color: var(--gold); font-size: 12px; font-weight: 700; }
.wr-cold { color: var(--red); font-size: 12px; font-weight: 700; }

/* Skeleton */
.loading-rows { display: flex; flex-direction: column; gap: 4px; margin-bottom: 20px; }
.skeleton-row {
  animation: shimmer 1.4s infinite;
  background: linear-gradient(90deg, var(--surface) 25%, var(--surface2) 50%, var(--surface) 75%);
  background-size: 200% 100%;
  border-radius: 8px;
  height: 60px;
}
@keyframes shimmer { to { background-position: -200% 0; } }

.empty-table { color: var(--text-dim); font-size: 13px; padding: 40px; text-align: center; }
</style>