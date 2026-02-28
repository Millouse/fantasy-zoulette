<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-logo">⚡</div>
      <div class="auth-brand">Zoulette<span>GG</span></div>
      <p class="auth-title">Create your account</p>

      <div v-if="error" class="error-msg" style="margin-bottom:20px">{{ error }}</div>

      <form @submit.prevent="handleRegister">
        <div class="form-group">
          <label>Summoner Name (Display)</label>
          <input v-model="displayName" type="text" placeholder="YourNickname" required />
        </div>
        <div class="form-group">
          <label>Email</label>
          <input v-model="email" type="email" placeholder="you@example.com" required />
        </div>
        <div class="form-group">
          <label>Password</label>
          <input v-model="password" type="password" placeholder="At least 8 characters" required minlength="8" />
        </div>
        <div class="form-group" style="margin-bottom:28px">
          <label>Confirm Password</label>
          <input v-model="confirm" type="password" placeholder="••••••••" required />
        </div>

        <button class="btn-primary" type="submit" :disabled="loading">
          {{ loading ? 'Creating…' : 'Create Account' }}
        </button>
      </form>

      <p class="auth-footer">
        Already have an account? <RouterLink to="/login">Sign in</RouterLink>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const router = useRouter()
const displayName = ref('')
const email = ref('')
const password = ref('')
const confirm = ref('')
const error = ref('')
const loading = ref(false)

async function handleRegister() {
  error.value = ''
  if (password.value !== confirm.value) { error.value = 'Passwords do not match.'; return }
  loading.value = true
  try {
    await authStore.register(email.value, password.value, displayName.value)
    router.push('/betting')
  } catch (e) {
    const map = {
      'auth/email-already-in-use': 'This email is already registered.',
      'auth/weak-password': 'Password is too weak.',
      'auth/invalid-email': 'Invalid email address.',
    }
    error.value = map[e.code] || 'Something went wrong.'
  } finally {
    loading.value = false
  }
}
</script>
