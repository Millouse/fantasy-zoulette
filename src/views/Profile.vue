<template>
  <div class="app-layout">
    <Navbar />
    <div class="page-content" style="max-width:680px">
      <h1 class="page-title">👤 Profile</h1>
      <p class="page-subtitle">Manage your account settings</p>

      <div v-if="successMsg" class="success-msg" style="margin-bottom:24px">{{ successMsg }}</div>
      <div v-if="errorMsg" class="error-msg" style="margin-bottom:24px">{{ errorMsg }}</div>

      <!-- Profile card -->
      <div class="card" style="padding:28px;margin-bottom:16px">
        <div class="profile-header">
          <div class="avatar-big">{{ initials }}</div>
          <div>
            <div class="profile-name">{{ authStore.user?.displayName || '—' }}</div>
            <div class="profile-email">{{ authStore.user?.email }}</div>
            <div class="profile-coins">
              <span>🪙</span>
              <span>{{ authStore.coins.toLocaleString() }} ZouletteCoins</span>
            </div>
          </div>
        </div>

        <div class="divider" />

        <form @submit.prevent="handleSave">
          <div class="form-group">
            <label>Display Name</label>
            <input v-model="form.displayName" type="text" placeholder="Your name" />
          </div>
          <div class="form-group">
            <label>Bio</label>
            <textarea v-model="form.bio" rows="3" placeholder="Tell us about yourself…" style="resize:vertical" />
          </div>

          <!-- Riot Account -->
          <div class="form-group">
            <label>Riot Account</label>
            <p class="field-hint">Link your account to hide yourself from the betting page.</p>
            <div class="riot-input-row">
              <input v-model="form.riotGameName" type="text" placeholder="GameName" class="input-game-name" />
              <span class="tag-hash">#</span>
              <input v-model="form.riotTagLine" type="text" placeholder="TAG" class="input-tag" style="max-width:100px" />
              <button type="button" class="btn-ghost" style="white-space:nowrap" @click="linkRiotAccount" :disabled="linkingRiot">
                {{ linkingRiot ? 'Linking...' : riotLinked ? '✓ Linked' : 'Link' }}
              </button>
            </div>
            <div v-if="riotError" class="error-msg" style="margin-top:6px;font-size:12px">{{ riotError }}</div>
            <div v-if="riotLinked" class="riot-linked-badge">
              <span>{{ authStore.user?.riotGameName }}#{{ authStore.user?.riotTagLine }}</span>
            </div>
          </div>

          <button class="btn-primary" type="submit" :disabled="saving" style="max-width:180px;margin-top:8px">
            {{ saving ? 'Saving…' : 'Save Changes' }}
          </button>
        </form>
      </div>

      <!-- Password reset -->
      <div class="card" style="padding:28px">
        <h2 class="section-title" style="margin-bottom:6px">🔐 Password</h2>
        <p style="color:var(--text-muted);font-size:13px;margin-bottom:18px">Send a password reset link to your email.</p>
        <button class="btn-ghost" @click="sendReset" :disabled="resetSent">
          {{ resetSent ? 'Email sent ✓' : 'Send Reset Email' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import Navbar from '../components/Navbar.vue'
import { getAccountByRiotId } from '../services/riot'

const authStore = useAuthStore()

const form = reactive({
  displayName: authStore.user?.displayName || '',
  bio: authStore.user?.bio || '',
  riotGameName: authStore.user?.riotGameName || '',
  riotTagLine: authStore.user?.riotTagLine || '',
})

const saving = ref(false)
const successMsg = ref('')
const errorMsg = ref('')
const resetSent = ref(false)
const linkingRiot = ref(false)
const riotError = ref('')
const riotLinked = computed(() => !!authStore.user?.riotPuuid)

const initials = computed(() => {
  const name = authStore.user?.displayName || authStore.user?.email || '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
})

async function linkRiotAccount() {
  riotError.value = ''
  if (!form.riotGameName.trim() || !form.riotTagLine.trim()) {
    riotError.value = 'Enter your GameName and TAG.'
    return
  }
  linkingRiot.value = true
  try {
    const account = await getAccountByRiotId(form.riotGameName.trim(), form.riotTagLine.trim())
    if (!account) {
      riotError.value = `Riot ID "${form.riotGameName}#${form.riotTagLine}" not found.`
      return
    }
    await authStore.updateUserProfile({
      riotPuuid: account.puuid,
      riotGameName: account.gameName,
      riotTagLine: account.tagLine,
    })
    successMsg.value = `Riot account ${account.gameName}#${account.tagLine} linked!`
  } catch (e) {
    riotError.value = e?.message || 'Failed to link Riot account.'
  } finally {
    linkingRiot.value = false
  }
}

async function handleSave() {
  successMsg.value = ''
  errorMsg.value = ''
  saving.value = true
  try {
    await authStore.updateUserProfile({ displayName: form.displayName, bio: form.bio })
    successMsg.value = 'Profile updated!'
  } catch {
    errorMsg.value = 'Failed to update profile.'
  } finally {
    saving.value = false
  }
}

async function sendReset() {
  try {
    await authStore.resetPassword(authStore.user.email)
    resetSent.value = true
  } catch {
    errorMsg.value = 'Failed to send reset email.'
  }
}
</script>

<style scoped>
.section-title { font-family: 'Rajdhani', sans-serif; font-size: 18px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.profile-header { align-items: center; display: flex; gap: 20px; margin-bottom: 24px; }
.avatar-big {
  align-items: center; background: var(--cyan); border-radius: 50%; color: #06060f;
  box-shadow: 0 0 20px rgba(0,212,255,0.3); display: flex; font-size: 24px; font-weight: 800;
  height: 68px; justify-content: center; min-width: 68px;
}
.profile-name { font-family: 'Rajdhani', sans-serif; font-size: 22px; font-weight: 700; margin-bottom: 2px; }
.profile-email { color: var(--text-muted); font-size: 13px; margin-bottom: 6px; }
.profile-coins { align-items: center; color: var(--gold); display: flex; font-size: 14px; font-weight: 700; gap: 6px; }
.divider { background: var(--border); height: 1px; margin-bottom: 24px; }
.form-group { margin-bottom: 18px; }
.form-group label { color: var(--text-muted); display: block; font-size: 11px; letter-spacing: 0.1em; margin-bottom: 8px; text-transform: uppercase; }
.field-hint { color: var(--text-dim); font-size: 12px; margin-bottom: 10px; margin-top: -4px; }

.riot-input-row { align-items: center; display: flex; gap: 8px; }
.input-game-name { flex: 1; }
.tag-hash { color: var(--cyan); font-size: 15px; font-weight: 700; }
.input-tag { width: 90px; }

.riot-linked-badge {
  align-items: center; background: rgba(0,212,255,0.08); border: 1px solid rgba(0,212,255,0.3);
  border-radius: 8px; color: var(--cyan); display: inline-flex; font-size: 13px;
  font-weight: 600; gap: 6px; margin-top: 10px; padding: 6px 12px;
}
.riot-linked-badge::before { content: '✓'; color: var(--green); }
</style>