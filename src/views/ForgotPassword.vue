<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-logo">⚡</div>
      <div class="auth-brand">Zoulette<span>GG</span></div>
      <p class="auth-title">Reset your password</p>

      <div v-if="error" class="error-msg" style="margin-bottom:20px">{{ error }}</div>
      <div v-if="success" class="success-msg" style="margin-bottom:20px">{{ success }}</div>

      <form v-if="!success" @submit.prevent="handleReset">
        <div class="form-group" style="margin-bottom:28px">
          <label>Email</label>
          <input v-model="email" type="email" placeholder="you@example.com" required />
        </div>
        <button class="btn-primary" type="submit" :disabled="loading">
          {{ loading ? 'Sending…' : 'Send Reset Link' }}
        </button>
      </form>

      <p class="auth-footer"><RouterLink to="/login">← Back to sign in</RouterLink></p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const email = ref('')
const error = ref('')
const success = ref('')
const loading = ref(false)

async function handleReset() {
  error.value = ''
  success.value = ''
  loading.value = true
  try {
    await authStore.resetPassword(email.value)
    success.value = 'Reset link sent! Check your inbox.'
  } catch (e) {
    const map = { 'auth/user-not-found': 'No account with this email.', 'auth/invalid-email': 'Invalid email.' }
    error.value = map[e.code] || 'Something went wrong.'
  } finally {
    loading.value = false
  }
}
</script>
