<template>
  <div class="app-layout">
    <Navbar />
    <div class="page-content">
      <h1 class="page-title">⚙️ Admin Panel</h1>
      <p class="page-subtitle">Manage tracked players, resolve bets, and grant coins</p>

      <div class="admin-grid">

        <!-- Players Management -->
        <div class="admin-section card">
          <h2 class="section-title">🎮 Tracked Players</h2>

          <div class="add-player-form">
            <input v-model="newGameName" placeholder="Nom du compte" @keyup.enter="addPlayer" class="input-game-name" />
            <div class="tag-wrapper">
              <span class="tag-hash">#</span>
              <input v-model="newTagLine" placeholder="TAG" @keyup.enter="addPlayer" class="input-tag" />
            </div>
            <button class="btn-primary" style="width:auto;white-space:nowrap" @click="addPlayer" :disabled="addingPlayer">
              {{ addingPlayer ? 'Ajout…' : '+ Ajouter' }}
            </button>
          </div>
          <div v-if="addError" class="error-msg" style="margin-top:8px">{{ addError }}</div>
          <div v-if="addSuccess" class="success-msg" style="margin-top:8px">{{ addSuccess }}</div>

          <div class="players-list">
            <div v-if="playersLoading" class="muted-text">Loading players…</div>
            <div v-else-if="players.length === 0" class="muted-text">No players added yet.</div>
            <div v-for="p in players" :key="p.id" class="player-row">
              <img :src="`/src/assets/16.4.1/img/profileicon/${p.profileIconId}.png`" class="player-icon" />
              <div class="player-details">
                <span class="player-name">{{ p.gameName }}<span class="player-tag">#{{ p.tagLine }}</span></span>
                <span class="player-lvl">LVL {{ p.summonerLevel }}</span>
                <!-- <span class="player-lvl">Puuid: {{ p.puuid }}</span> -->
              </div>
              <button class="btn-remove" @click="removePlayer(p.id)">✕</button>
            </div>
          </div>
        </div>

        <!-- Resolve Bets -->
        <div class="admin-section card">
          <h2 class="section-title">⚡ Resolve Game</h2>
          <p class="section-desc">Manually trigger bet resolution for a completed game.</p>

          <div class="form-group">
            <label>Riot Game ID</label>
            <input v-model="resolveGameId" placeholder="e.g. EUW1_7123456789" />
          </div>
          <div class="resolve-buttons">
            <button class="btn-yes" @click="resolve(true)" :disabled="resolving">
              {{ resolving ? '…' : '✓ Player WON' }}
            </button>
            <button class="btn-no" @click="resolve(false)" :disabled="resolving">
              {{ resolving ? '…' : '✗ Player LOST' }}
            </button>
          </div>
          <div v-if="resolveMsg" class="success-msg" style="margin-top:12px">{{ resolveMsg }}</div>
          <div v-if="resolveError" class="error-msg" style="margin-top:12px">{{ resolveError }}</div>
        </div>

        <!-- Grant Coins -->
        <div class="admin-section card">
          <h2 class="section-title">🪙 Grant Coins</h2>
          <p class="section-desc">Award ZouletteCoins to a user.</p>

          <div class="form-group">
            <label>Select User</label>
            <select v-model="selectedUserId">
              <option value="">— Pick a user —</option>
              <option v-for="u in users" :key="u.id" :value="u.id">
                {{ u.displayName || u.email }} ({{ u.coins?.toLocaleString() ?? 0 }} ZC)
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>Amount</label>
            <input v-model.number="grantAmount" type="number" min="1" placeholder="e.g. 500" />
          </div>
          <button class="btn-primary" @click="doGrantCoins" :disabled="!selectedUserId || !grantAmount || granting">
            {{ granting ? 'Granting…' : '🪙 Grant Coins' }}
          </button>
          <div v-if="grantMsg" class="success-msg" style="margin-top:12px">{{ grantMsg }}</div>
        </div>

        <!-- Users Overview -->
        <div class="admin-section card">
          <h2 class="section-title">👥 All Users</h2>
          <div class="users-list">
            <div v-if="usersLoading" class="muted-text">Loading users…</div>
            <div v-for="u in users" :key="u.id" class="user-row">
              <div class="user-avatar">{{ (u.displayName || u.email || '?')[0].toUpperCase() }}</div>
              <div class="user-info">
                <span class="user-name">{{ u.displayName || '—' }}</span>
                <span class="user-email">{{ u.email }}</span>
              </div>
              <div class="user-coins">
                <span class="coin-icon">🪙</span>
                {{ (u.coins || 0).toLocaleString() }} ZC
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Navbar from '../components/Navbar.vue'
import { getPlayers, addPlayer as addPlayerService, removePlayer as removePlayerService } from '../services/players'
import { resolveBets, getAllUsers, grantCoins } from '../services/bets'

// Players
const players = ref([])
const playersLoading = ref(true)
const newGameName = ref('')
const newTagLine = ref('')
const addingPlayer = ref(false)
const addError = ref('')
const addSuccess = ref('')

async function loadPlayers() {
  players.value = await getPlayers()
  playersLoading.value = false
}

async function addPlayer() {
  addError.value = ''
  addSuccess.value = ''
  if (!newGameName.value.trim() || !newTagLine.value.trim()) return
  addingPlayer.value = true
  try {
    await addPlayerService(newGameName.value.trim(), newTagLine.value.trim())
    addSuccess.value = `${newGameName.value}#${newTagLine.value} ajouté !`
    newGameName.value = ''
    newTagLine.value = ''
    await loadPlayers()
  } catch (e) {
    addError.value = e.message || 'Échec de l\'ajout du joueur.'
  } finally {
    addingPlayer.value = false
  }
}

async function removePlayer(id) {
  await removePlayerService(id)
  await loadPlayers()
}

// Resolve bets
const resolveGameId = ref('')
const resolving = ref(false)
const resolveMsg = ref('')
const resolveError = ref('')

async function resolve(playerWon) {
  resolveMsg.value = ''
  resolveError.value = ''
  if (!resolveGameId.value.trim()) { resolveError.value = 'Enter a Game ID.'; return }
  resolving.value = true
  try {
    const count = await resolveBets(resolveGameId.value.trim(), playerWon)
    resolveMsg.value = `Resolved ${count} bet${count !== 1 ? 's' : ''} — player ${playerWon ? 'WON' : 'LOST'}.`
    resolveGameId.value = ''
  } catch (e) {
    resolveError.value = 'Failed to resolve bets.'
  } finally {
    resolving.value = false
  }
}

// Grant coins
const users = ref([])
const usersLoading = ref(true)
const selectedUserId = ref('')
const grantAmount = ref(500)
const granting = ref(false)
const grantMsg = ref('')

async function loadUsers() {
  users.value = await getAllUsers()
  usersLoading.value = false
}

async function doGrantCoins() {
  grantMsg.value = ''
  granting.value = true
  try {
    await grantCoins(selectedUserId.value, grantAmount.value)
    const u = users.value.find(u => u.id === selectedUserId.value)
    grantMsg.value = `Granted ${grantAmount.value} ZC to ${u?.displayName || u?.email}.`
    await loadUsers()
  } catch (e) {
    grantMsg.value = 'Failed to grant coins.'
  } finally {
    granting.value = false
  }
}

onMounted(() => { loadPlayers(); loadUsers() })
</script>

<style scoped>
.admin-grid {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
}
.admin-section {
  padding: 24px;
}
.section-title {
  font-family: 'Rajdhani', sans-serif;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.06em;
  margin-bottom: 6px;
  text-transform: uppercase;
}
.section-desc { color: var(--text-muted); font-size: 13px; margin-bottom: 20px; }
.form-group { margin-bottom: 14px; }
.form-group label { color: var(--text-muted); display: block; font-size: 11px; letter-spacing: 0.1em; margin-bottom: 7px; text-transform: uppercase; }

.add-player-form { display: flex; gap: 8px; margin-bottom: 4px; align-items: center; }
.input-game-name { flex: 2; }
.tag-wrapper { position: relative; flex: 1; display: flex; align-items: center; }
.tag-hash { position: absolute; left: 12px; color: var(--cyan); font-weight: 700; font-size: 15px; pointer-events: none; z-index: 1; }
.input-tag { padding-left: 24px !important; }
.player-tag { color: var(--text-muted); font-size: 13px; font-weight: 400; margin-left: 2px; }

.players-list, .users-list { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
.player-row, .user-row {
  align-items: center;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 8px;
  display: flex;
  gap: 12px;
  padding: 10px 14px;
}
.player-icon { border-radius: 50%; height: 36px; width: 36px; }
.player-details { display: flex; flex: 1; flex-direction: column; }
.player-name { font-size: 15px; font-weight: 600; }
.player-lvl { color: var(--text-muted); font-size: 11px; }
.btn-remove {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-muted);
  font-size: 14px;
  height: 28px;
  transition: border-color 0.2s, color 0.2s;
  width: 28px;
}
.btn-remove:hover { border-color: var(--red); color: var(--red); }

.resolve-buttons { display: grid; gap: 10px; grid-template-columns: 1fr 1fr; margin-top: 4px; }

.user-avatar {
  align-items: center;
  background: var(--surface3);
  border-radius: 50%;
  color: var(--cyan);
  display: flex;
  font-size: 14px;
  font-weight: 700;
  height: 34px;
  justify-content: center;
  width: 34px;
}
.user-info { display: flex; flex: 1; flex-direction: column; min-width: 0; }
.user-name { font-size: 14px; font-weight: 600; }
.user-email { color: var(--text-muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user-coins { align-items: center; color: var(--gold); display: flex; font-size: 13px; font-weight: 700; gap: 4px; }
.coin-icon { font-size: 13px; }

.muted-text { color: var(--text-muted); font-size: 13px; padding: 8px 0; }
</style>