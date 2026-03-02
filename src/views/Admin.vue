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
            <input v-model="newDiscord" placeholder="Discord (optionnel)" @keyup.enter="addPlayer" class="input-discord" />
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
              <img :src="`/assets/16.4.1/img/profileicon/${p.profileIconId}.png`" class="player-icon" />
              <div class="player-details">
                <span class="player-name">{{ p.gameName }}<span class="player-tag">#{{ p.tagLine }}</span></span>
                <span class="player-lvl">LVL {{ p.summonerLevel }}{{ p.discordUsername ? ' · @' + p.discordUsername : '' }}</span>
              </div>
              <button class="btn-remove" @click="removePlayer(p.id)">✕</button>
            </div>
          </div>
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
              <div class="user-coins"><span class="coin-icon">🪙</span>{{ (u.coins || 0).toLocaleString() }} ZC</div>
            </div>
          </div>
        </div>

        <!-- Pending Bets Manager — full width -->
        <div class="admin-section card full-width">
          <div class="bets-header">
            <div>
              <h2 class="section-title">🎲 Pending Bets</h2>
              <p class="section-desc">Modifier ou supprimer les paris en cours.</p>
            </div>
            <div class="bets-toolbar">
              <input v-model="betSearch" placeholder="Filtrer par joueur ou user…" class="bet-search" />
              <button class="btn-ghost" @click="loadPendingBets" :disabled="betsLoading" style="white-space:nowrap">
                {{ betsLoading ? '…' : '↻ Refresh' }}
              </button>
            </div>
          </div>

          <div v-if="betsLoading" class="loading-rows">
            <div v-for="i in 4" :key="i" class="skeleton-row"></div>
          </div>

          <div v-else-if="filteredBets.length === 0" class="muted-text" style="padding:20px 0">
            Aucun pari en cours.
          </div>

          <div v-else class="bets-table">
            <div class="bets-table-header">
              <span>User</span>
              <span>Player</span>
              <span>Pari</span>
              <span>Mise</span>
              <span>Cote</span>
              <span>Payout potentiel</span>
              <span>Game ID</span>
              <span class="col-actions">Actions</span>
            </div>

            <div v-for="bet in filteredBets" :key="bet.id" class="bet-row" :class="{ editing: editingBetId === bet.id, 'is-stat': bet.type === 'stat' }">
              <!-- View mode -->
              <template v-if="editingBetId !== bet.id">
                <span class="cell-user">
                  <div class="mini-avatar">{{ userInitials(bet.userId) }}</div>
                  <span>{{ userName(bet.userId) }}</span>
                </span>
                <span class="cell-player">
                  {{ bet.playerName }}
                  <span class="type-pill" :class="bet.type === 'stat' ? 'pill-stat' : 'pill-outcome'">
                    {{ bet.type === 'stat' ? '📊' : '🎯' }}
                  </span>
                </span>
                <!-- Outcome bet prediction -->
                <span v-if="bet.type !== 'stat'" class="cell-pred" :class="bet.prediction">
                  {{ bet.prediction === 'yes' ? '✅ WIN' : '❌ LOSE' }}
                </span>
                <!-- Stat bet prediction -->
                <span v-else class="cell-pred stat-pred">
                  {{ statIcon(bet.statType) }} {{ statLabel(bet.statType) }} ≥ <strong>{{ formatStatValue(bet.statType, bet.targetValue) }}</strong>
                </span>
                <span class="cell-amount">{{ bet.amount.toLocaleString() }} ZC</span>
                <span class="cell-odds">{{ bet.odds }}x</span>
                <span class="cell-payout">+{{ Math.floor(bet.amount * bet.odds).toLocaleString() }} ZC</span>
                <span class="cell-game">{{ bet.gameId.split('_').pop() }}</span>
                <span class="cell-actions">
                  <button class="action-btn force-win" @click="confirmForce(bet, true)" title="Force gagné">✓</button>
                  <button class="action-btn force-lose" @click="confirmForce(bet, false)" title="Force perdu">✗</button>
                  <button class="action-btn edit" @click="startEdit(bet)" title="Modifier">✏️</button>
                  <button class="action-btn delete" @click="confirmDelete(bet)" title="Supprimer">🗑️</button>
                </span>
              </template>

              <!-- Edit mode -->
              <template v-else>
                <span class="cell-user">
                  <div class="mini-avatar">{{ userInitials(bet.userId) }}</div>
                  <span>{{ userName(bet.userId) }}</span>
                </span>
                <span class="cell-player">{{ bet.playerName }}</span>
                <!-- Outcome edit -->
                <span v-if="editingBet?.type !== 'stat'" class="cell-pred">
                  <select v-model="editForm.prediction" class="edit-select">
                    <option value="yes">✅ WIN</option>
                    <option value="no">❌ LOSE</option>
                  </select>
                </span>
                <!-- Stat edit -->
                <span v-else class="cell-pred">
                  <input v-model.number="editForm.targetValue" type="number" step="0.5" class="edit-input" style="width:70px" />
                  <span style="color:var(--text-dim);font-size:11px;margin-left:4px">{{ statUnit(editingBet.statType) }}</span>
                </span>
                <span class="cell-amount">
                  <input v-model.number="editForm.amount" type="number" min="1" class="edit-input" />
                </span>
                <span class="cell-odds">
                  <input v-model.number="editForm.odds" type="number" step="0.01" min="1.1" class="edit-input" />
                </span>
                <span class="cell-payout">+{{ Math.floor(editForm.amount * editForm.odds).toLocaleString() }} ZC</span>
                <span class="cell-game">{{ editingBet?.gameId?.split('_').pop() }}</span>
                <span class="cell-actions">
                  <button class="action-btn save" @click="saveEdit(editingBet)" :disabled="savingEdit" title="Sauvegarder">✓</button>
                  <button class="action-btn cancel" @click="cancelEdit" title="Annuler">✕</button>
                </span>
              </template>
            </div>
          </div>

          <div v-if="betsMsg" class="success-msg" style="margin-top:12px">{{ betsMsg }}</div>
          <div v-if="betsError" class="error-msg" style="margin-top:12px">{{ betsError }}</div>
        </div>

      </div>
    </div>
  </div>

  <!-- Force validate modal -->
  <div v-if="forcingBet" class="modal-overlay" @click.self="forcingBet = null">
    <div class="modal-card">
      <!-- Outcome bet modal -->
      <template v-if="forcingBet.type !== 'stat'">
        <h3 class="modal-title">{{ forceOutcome ? '✅ Force WIN' : '❌ Force LOSE' }}</h3>
        <p class="modal-desc">
          Valider le pari de <strong>{{ userName(forcingBet.userId) }}</strong> sur
          <strong>{{ forcingBet.playerName }}</strong> — le joueur a
          <strong :class="forceOutcome ? 'text-green' : 'text-red'">{{ forceOutcome ? 'GAGNÉ' : 'PERDU' }}</strong> sa game.
          <br /><br />
          <span v-if="(forcingBet.prediction === 'yes' && forceOutcome) || (forcingBet.prediction === 'no' && !forceOutcome)">
            Prédiction <strong>correcte</strong> — <span class="text-green">+{{ Math.floor(forcingBet.amount * forcingBet.odds).toLocaleString() }} ZC</span> crédités.
          </span>
          <span v-else>
            Prédiction <strong>incorrecte</strong> — aucun remboursement.
          </span>
        </p>
      </template>

      <!-- Stat bet modal -->
      <template v-else>
        <h3 class="modal-title">
          {{ statIcon(forcingBet.statType) }}
          {{ forceOutcome ? 'Stat atteinte ✅' : 'Stat non atteinte ❌' }}
        </h3>
        <p class="modal-desc">
          Pari de <strong>{{ userName(forcingBet.userId) }}</strong> sur
          <strong>{{ forcingBet.playerName }}</strong> :
          <br />
          {{ statLabel(forcingBet.statType) }} ≥ <strong>{{ formatStatValue(forcingBet.statType, forcingBet.targetValue) }}</strong>
          <br /><br />
          <span v-if="forceOutcome">
            ✅ Stat <strong>atteinte</strong> — <span class="text-green">+{{ Math.floor(forcingBet.amount * forcingBet.odds).toLocaleString() }} ZC</span> crédités à {{ userName(forcingBet.userId) }}.
          </span>
          <span v-else>
            ❌ Stat <strong>non atteinte</strong> — aucun remboursement.
          </span>
        </p>
      </template>

      <div class="modal-actions">
        <button class="btn-ghost" @click="forcingBet = null">Annuler</button>
        <button
          :class="forceOutcome ? 'btn-force-win' : 'btn-force-lose'"
          @click="executeForceBet"
          :disabled="forcingExec"
        >
          {{ forcingExec ? 'En cours…' : forceOutcome ? '✓ Confirmer' : '✗ Confirmer' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Delete confirmation modal -->
  <div v-if="deletingBet" class="modal-overlay" @click.self="deletingBet = null">
    <div class="modal-card">
      <h3 class="modal-title">🗑️ Supprimer ce pari ?</h3>
      <p class="modal-desc">
        Le pari de <strong>{{ userName(deletingBet.userId) }}</strong> sur
        <strong>{{ deletingBet.playerName }}</strong> ({{ deletingBet.amount.toLocaleString() }} ZC — {{ deletingBet.prediction === 'yes' ? 'WIN' : 'LOSE' }})
        sera supprimé et les coins remboursés.
      </p>
      <div class="modal-actions">
        <button class="btn-ghost" @click="deletingBet = null">Annuler</button>
        <button class="btn-delete" @click="deleteBet" :disabled="deleting">
          {{ deleting ? 'Suppression…' : '🗑️ Supprimer & Rembourser' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { increment } from 'firebase/firestore'
import Navbar from '../components/Navbar.vue'
import { getPlayers, addPlayer as addPlayerService, removePlayer as removePlayerService } from '../services/players'
import { resolveBets, getAllUsers, grantCoins } from '../services/bets'

// ── Players ──────────────────────────────────────────────
const players = ref([])
const playersLoading = ref(true)
const newGameName = ref('')
const newTagLine = ref('')
const newDiscord = ref('')
const addingPlayer = ref(false)
const addError = ref('')
const addSuccess = ref('')

async function loadPlayers() {
  players.value = await getPlayers()
  playersLoading.value = false
}

async function addPlayer() {
  addError.value = ''; addSuccess.value = ''
  if (!newGameName.value.trim() || !newTagLine.value.trim()) return
  addingPlayer.value = true
  try {
    await addPlayerService(newGameName.value.trim(), newTagLine.value.trim(), newDiscord.value.trim())
    addSuccess.value = `${newGameName.value}#${newTagLine.value} ajouté !`
    newGameName.value = ''; newTagLine.value = ''; newDiscord.value = ''
    await loadPlayers()
  } catch (e) {
    addError.value = e.message || "Échec de l'ajout du joueur."
  } finally { addingPlayer.value = false }
}

async function removePlayer(id) {
  await removePlayerService(id)
  await loadPlayers()
}

// ── Grant Coins ────────────────────────────────────────────
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
  grantMsg.value = ''; granting.value = true
  try {
    await grantCoins(selectedUserId.value, grantAmount.value)
    const u = users.value.find(u => u.id === selectedUserId.value)
    grantMsg.value = `Granted ${grantAmount.value} ZC to ${u?.displayName || u?.email}.`
    await loadUsers()
  } catch (e) {
    grantMsg.value = 'Failed to grant coins.'
  } finally { granting.value = false }
}

// ── Pending Bets Manager ───────────────────────────────────
const pendingBets = ref([])
const betsLoading = ref(false)
const betsMsg = ref('')
const betsError = ref('')
const betSearch = ref('')

// Edit state
const editingBetId = ref(null)
const editingBet = ref(null)
const editForm = ref({ prediction: 'yes', amount: 0, odds: 1.9, targetValue: 0 })
const savingEdit = ref(false)

// Stat helpers
function statIcon(type) { return { kda: '⚔️', duration: '⏱️', cspm: '🌾' }[type] || '📊' }
function statLabel(type) { return { kda: 'KDA', duration: 'Durée', cspm: 'CS/min' }[type] || type }
function statUnit(type) { return { kda: '', duration: 'min', cspm: 'cs/min' }[type] || '' }
function formatStatValue(type, val) {
  if (val == null) return '—'
  if (type === 'kda') return Number(val).toFixed(1)
  if (type === 'duration') return `${Number(val).toFixed(0)} min`
  if (type === 'cspm') return `${Number(val).toFixed(1)} cs/min`
  return val
}

// Delete state
const deletingBet = ref(null)
const deleting = ref(false)

const filteredBets = computed(() => {
  const s = betSearch.value.toLowerCase()
  if (!s) return pendingBets.value
  return pendingBets.value.filter(b =>
    b.playerName?.toLowerCase().includes(s) ||
    userName(b.userId).toLowerCase().includes(s)
  )
})

function userName(uid) {
  const u = users.value.find(u => u.id === uid)
  return u?.displayName || u?.email?.split('@')[0] || uid.slice(0, 8)
}

function userInitials(uid) {
  const name = userName(uid)
  return name.slice(0, 2).toUpperCase()
}

async function loadPendingBets() {
  betsLoading.value = true
  betsMsg.value = ''; betsError.value = ''
  try {
    const q = query(collection(db, 'bets'), where('status', '==', 'pending'))
    const snap = await getDocs(q)
    pendingBets.value = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
  } finally {
    betsLoading.value = false
  }
}

function startEdit(bet) {
  editingBetId.value = bet.id
  editingBet.value = bet
  editForm.value = {
    prediction: bet.prediction ?? 'yes',
    targetValue: bet.targetValue ?? 0,
    amount: bet.amount,
    odds: bet.odds,
  }
}

function cancelEdit() {
  editingBetId.value = null
  editingBet.value = null
}

async function saveEdit(bet) {
  savingEdit.value = true
  betsMsg.value = ''; betsError.value = ''
  try {
    const coinDiff = editForm.value.amount - bet.amount
    const betRef = doc(db, 'bets', bet.id)
    const userRef = doc(db, 'users', bet.userId)

    const updates = {
      amount: editForm.value.amount,
      odds: editForm.value.odds,
    }
    // Outcome bet: update prediction. Stat bet: update targetValue
    if (bet.type === 'stat') {
      updates.targetValue = editForm.value.targetValue
    } else {
      updates.prediction = editForm.value.prediction
    }

    await updateDoc(betRef, updates)
    if (coinDiff !== 0) {
      await updateDoc(userRef, { coins: increment(-coinDiff) })
    }

    const idx = pendingBets.value.findIndex(b => b.id === bet.id)
    if (idx !== -1) {
      pendingBets.value[idx] = { ...pendingBets.value[idx], ...updates }
    }

    betsMsg.value = `Pari de ${userName(bet.userId)} modifié.`
    editingBetId.value = null
    editingBet.value = null
  } catch (e) {
    betsError.value = 'Échec de la modification.'
    console.error(e)
  } finally {
    savingEdit.value = false
  }
}

function confirmDelete(bet) {
  deletingBet.value = bet
}

async function deleteBet() {
  if (!deletingBet.value) return
  deleting.value = true
  betsMsg.value = ''; betsError.value = ''
  try {
    const bet = deletingBet.value
    // Delete the bet document
    await deleteDoc(doc(db, 'bets', bet.id))
    // Refund the coins to the user
    await updateDoc(doc(db, 'users', bet.userId), { coins: increment(bet.amount) })

    pendingBets.value = pendingBets.value.filter(b => b.id !== bet.id)
    betsMsg.value = `Pari supprimé — ${bet.amount.toLocaleString()} ZC remboursés à ${userName(bet.userId)}.`
    deletingBet.value = null
  } catch (e) {
    betsError.value = 'Échec de la suppression.'
    console.error(e)
  } finally {
    deleting.value = false
  }
}

// Force-validate state
const forcingBet = ref(null)
const forceOutcome = ref(true) // true = WIN, false = LOSE
const forcingExec = ref(false)

function confirmForce(bet, outcome) {
  forcingBet.value = bet
  forceOutcome.value = outcome
}

async function executeForceBet() {
  if (!forcingBet.value) return
  forcingExec.value = true
  betsMsg.value = ''; betsError.value = ''
  try {
    const bet = forcingBet.value
    const won = forceOutcome.value

    let correct
    if (bet.type === 'stat') {
      // For stat bets: forceOutcome=true means the stat WAS reached (bet wins)
      correct = won
    } else {
      correct = (bet.prediction === 'yes' && won) || (bet.prediction === 'no' && !won)
    }

    const payout = correct ? Math.floor(bet.amount * (bet.odds ?? 1.9)) : 0
    const status = correct ? 'won' : 'lost'

    await updateDoc(doc(db, 'bets', bet.id), { status, payout })
    if (correct) {
      await updateDoc(doc(db, 'users', bet.userId), { coins: increment(payout) })
    }

    pendingBets.value = pendingBets.value.filter(b => b.id !== bet.id)
    betsMsg.value = correct
      ? `✅ ${userName(bet.userId)} remporte +${payout.toLocaleString()} ZC !`
      : `❌ Pari de ${userName(bet.userId)} marqué comme perdu.`
    forcingBet.value = null
  } catch (e) {
    betsError.value = 'Échec de la validation.'
    console.error(e)
  } finally {
    forcingExec.value = false
  }
}
  loadPlayers()
  loadUsers()
  loadPendingBets()

</script>

<style scoped>
.admin-grid {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
}
.full-width { grid-column: 1 / -1; }
.admin-section { padding: 24px; }
.section-title {
  font-family: 'Rajdhani', sans-serif; font-size: 18px; font-weight: 700;
  letter-spacing: 0.06em; margin-bottom: 6px; text-transform: uppercase;
}
.section-desc { color: var(--text-muted); font-size: 13px; margin-bottom: 20px; }
.form-group { margin-bottom: 14px; }
.form-group label { color: var(--text-muted); display: block; font-size: 11px; letter-spacing: 0.1em; margin-bottom: 7px; text-transform: uppercase; }

.add-player-form { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 4px; align-items: center; }
.input-game-name { flex: 2; min-width: 120px; }
.input-discord { flex: 2; min-width: 120px; }
.tag-wrapper { position: relative; flex: 1; display: flex; align-items: center; }
.tag-hash { position: absolute; left: 12px; color: var(--cyan); font-weight: 700; font-size: 15px; pointer-events: none; z-index: 1; }
.input-tag { padding-left: 24px !important; }
.player-tag { color: var(--text-muted); font-size: 13px; font-weight: 400; margin-left: 2px; }

.players-list, .users-list { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
.player-row, .user-row {
  align-items: center; background: var(--surface2); border: 1px solid var(--border);
  border-radius: 8px; display: flex; gap: 12px; padding: 10px 14px;
}
.player-icon { border-radius: 50%; height: 36px; width: 36px; }
.player-details { display: flex; flex: 1; flex-direction: column; }
.player-name { font-size: 15px; font-weight: 600; }
.player-lvl { color: var(--text-muted); font-size: 11px; }
.btn-remove {
  background: transparent; border: 1px solid var(--border); border-radius: 6px;
  color: var(--text-muted); font-size: 14px; height: 28px; transition: border-color 0.2s, color 0.2s; width: 28px;
}
.btn-remove:hover { border-color: var(--red); color: var(--red); }
.resolve-buttons { display: grid; gap: 10px; grid-template-columns: 1fr 1fr; margin-top: 4px; }
.user-avatar {
  align-items: center; background: var(--surface3); border-radius: 50%; color: var(--cyan);
  display: flex; font-size: 14px; font-weight: 700; height: 34px; justify-content: center; width: 34px;
}
.user-info { display: flex; flex: 1; flex-direction: column; min-width: 0; }
.user-name { font-size: 14px; font-weight: 600; }
.user-email { color: var(--text-muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user-coins { align-items: center; color: var(--gold); display: flex; font-size: 13px; font-weight: 700; gap: 4px; }
.coin-icon { font-size: 13px; }
.muted-text { color: var(--text-muted); font-size: 13px; padding: 8px 0; }

/* ── Pending Bets ── */
.bets-header { align-items: flex-start; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
.bets-toolbar { align-items: center; display: flex; gap: 8px; }
.bet-search { max-width: 240px; width: 100%; }

.bets-table { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }

.bets-table-header {
  background: var(--surface2);
  border-bottom: 1px solid var(--border);
  color: var(--text-dim);
  display: grid;
  font-size: 10px;
  font-weight: 700;
  grid-template-columns: 160px 110px 100px 90px 70px 140px 110px 120px;
  letter-spacing: 0.1em;
  padding: 10px 16px;
  text-transform: uppercase;
}

.bet-row {
  align-items: center;
  border-bottom: 1px solid var(--border);
  display: grid;
  grid-template-columns: 160px 110px 100px 90px 70px 140px 110px 120px;
  padding: 10px 16px;
  transition: background 0.15s;
}
.bet-row:last-child { border-bottom: none; }
.bet-row:hover { background: var(--surface2); }
.bet-row.editing { background: rgba(0, 212, 255, 0.04); border-left: 2px solid var(--cyan); }

.cell-user { align-items: center; display: flex; gap: 8px; font-size: 13px; min-width: 0; }
.mini-avatar {
  align-items: center; background: var(--surface2); border: 1px solid var(--border-bright);
  border-radius: 50%; color: var(--text-muted); display: flex; flex-shrink: 0;
  font-size: 10px; font-weight: 800; height: 26px; justify-content: center; width: 26px;
}
.cell-player { color: var(--text-muted); font-size: 13px; align-items: center; display: flex; gap: 6px; }
.type-pill { border-radius: 4px; font-size: 13px; line-height: 1; }
.cell-pred { font-size: 12px; font-weight: 700; }
.cell-pred.yes { color: var(--green); }
.cell-pred.no { color: var(--red); }
.stat-pred { align-items: center; color: var(--cyan); display: flex; font-size: 11px; font-weight: 600; gap: 4px; }
.stat-pred strong { color: var(--text); }
.bet-row.is-stat { border-left: 2px solid rgba(0,212,255,0.3); }
.cell-amount { color: var(--gold); font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 700; }
.cell-odds { color: var(--text-muted); font-size: 13px; }
.cell-payout { color: var(--cyan); font-family: 'Rajdhani', sans-serif; font-size: 13px; }
.cell-game { color: var(--text-dim); font-size: 11px; font-family: monospace; }

.cell-actions { display: flex; gap: 6px; }
.col-actions { text-align: right; }

.action-btn {
  align-items: center; background: transparent; border: 1px solid var(--border);
  border-radius: 6px; cursor: pointer; display: flex; font-size: 13px;
  height: 28px; justify-content: center; transition: all 0.15s; width: 28px;
}
.action-btn.edit:hover { border-color: var(--cyan); background: rgba(0,212,255,0.1); }
.action-btn.delete:hover { border-color: var(--red); background: rgba(255,71,87,0.1); }
.action-btn.force-win { border-color: rgba(0,255,136,0.4); color: var(--green); font-weight: 800; }
.action-btn.force-win:hover { background: rgba(0,255,136,0.15); border-color: var(--green); }
.action-btn.force-lose { border-color: rgba(255,71,87,0.4); color: var(--red); font-weight: 800; }
.action-btn.force-lose:hover { background: rgba(255,71,87,0.15); border-color: var(--red); }
.action-btn.save { border-color: var(--green); color: var(--green); }
.action-btn.save:hover { background: rgba(0,255,136,0.12); }
.action-btn.cancel { border-color: var(--border); color: var(--text-muted); }
.action-btn.cancel:hover { border-color: var(--red); color: var(--red); }

.text-green { color: var(--green); }
.text-red { color: var(--red); }

.btn-force-win {
  background: rgba(0,255,136,0.12); border: 1px solid var(--green);
  border-radius: 8px; color: var(--green); font-weight: 700;
  letter-spacing: 0.06em; padding: 10px 20px; transition: background 0.2s;
}
.btn-force-win:hover:not(:disabled) { background: rgba(0,255,136,0.25); }
.btn-force-win:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-force-lose {
  background: rgba(255,71,87,0.12); border: 1px solid var(--red);
  border-radius: 8px; color: var(--red); font-weight: 700;
  letter-spacing: 0.06em; padding: 10px 20px; transition: background 0.2s;
}
.btn-force-lose:hover:not(:disabled) { background: rgba(255,71,87,0.25); }
.btn-force-lose:disabled { opacity: 0.4; cursor: not-allowed; }

.edit-input {
  background: var(--surface); border: 1px solid var(--cyan);
  border-radius: 6px; color: var(--text); font-size: 13px;
  padding: 4px 8px; width: 80px;
}
.edit-select {
  background: var(--surface); border: 1px solid var(--cyan);
  border-radius: 6px; color: var(--text); font-size: 12px;
  padding: 4px 6px; width: 90px;
}

/* Skeleton */
.loading-rows { display: flex; flex-direction: column; gap: 6px; }
.skeleton-row {
  animation: shimmer 1.4s infinite;
  background: linear-gradient(90deg, var(--surface) 25%, var(--surface2) 50%, var(--surface) 75%);
  background-size: 200% 100%; border-radius: 8px; height: 48px;
}
@keyframes shimmer { to { background-position: -200% 0; } }

/* ── Delete Modal ── */
.modal-overlay {
  align-items: center; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
  display: flex; inset: 0; justify-content: center; position: fixed; z-index: 200;
}
.modal-card {
  animation: fadeUp 0.2s ease;
  background: var(--surface); border: 1px solid var(--border-bright);
  border-radius: 16px; max-width: 440px; padding: 32px; width: 90%;
}
.modal-title { font-family: 'Rajdhani', sans-serif; font-size: 20px; font-weight: 700; margin-bottom: 12px; }
.modal-desc { color: var(--text-muted); font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
.modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
.btn-delete {
  background: rgba(255,71,87,0.15); border: 1px solid var(--red);
  border-radius: 8px; color: var(--red); font-weight: 700;
  letter-spacing: 0.06em; padding: 10px 20px; transition: background 0.2s;
}
.btn-delete:hover:not(:disabled) { background: rgba(255,71,87,0.3); }
.btn-delete:disabled { opacity: 0.4; cursor: not-allowed; }

@keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>