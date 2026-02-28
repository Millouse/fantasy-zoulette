<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-logo">⚡</div>
      <div class="auth-brand">Zoulette<span>GG</span></div>
      <p class="auth-title">Sign in to your account</p>

      <div v-if="error" class="error-msg" style="margin-bottom:20px">{{ error }}</div>

      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label>Email</label>
          <input v-model="email" type="email" placeholder="you@example.com" required />
        </div>
        <div class="form-group">
          <label>Password</label>
          <input v-model="password" type="password" placeholder="••••••••" required />
        </div>

        <div style="text-align:right; margin-bottom:24px; margin-top:-8px">
          <RouterLink to="/forgot-password" style="font-size:13px">Forgot password?</RouterLink>
        </div>

        <button class="btn-primary" type="submit" :disabled="loading">
          {{ loading ? 'Connecting…' : 'Sign In' }}
        </button>
      </form>

      <p class="auth-footer">
        No account? <RouterLink to="/register">Create one</RouterLink>
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
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    await authStore.login(email.value, password.value)
    router.push('/betting')
  } catch (e) {
    const map = {
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/invalid-credential': 'Invalid email or password.',
      'auth/too-many-requests': 'Too many attempts. Please wait.',
    }
    error.value = map[e.code] || 'Something went wrong.'
  } finally {
    loading.value = false
  }
}
</script>
