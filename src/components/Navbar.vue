<template>
  <nav class="navbar">
    <RouterLink to="/betting" class="nav-logo">
      <span class="logo-icon">⚡</span>
      <span>Zoulette<em>GG</em></span>
    </RouterLink>

    <div class="nav-links">
      <RouterLink to="/betting" :class="{ active: route.path === '/betting' }">
        <span class="nav-icon">🎯</span> Bet Now
      </RouterLink>
      <RouterLink to="/my-bets" :class="{ active: route.path === '/my-bets' }">
        <span class="nav-icon">📋</span> My Bets
      </RouterLink>
      <RouterLink v-if="authStore.isAdmin" to="/admin" :class="{ active: route.path === '/admin' }" class="admin-link">
        <span class="nav-icon">⚙️</span> Admin
      </RouterLink>
    </div>

    <div class="nav-right">
      <div class="coins-badge">
        <span class="coin-icon">🪙</span>
        <span class="coin-amount">{{ authStore.coins.toLocaleString() }}</span>
        <span class="coin-label">ZC</span>
      </div>
      <RouterLink to="/profile" class="nav-avatar" :title="authStore.user?.displayName">
        {{ initials }}
      </RouterLink>
      <button class="btn-logout" @click="handleLogout" title="Sign out">⏻</button>
    </div>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

const initials = computed(() => {
  const name = authStore.user?.displayName || authStore.user?.email || '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
})

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.navbar {
  align-items: center;
  background: rgba(8, 8, 18, 0.95);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  display: flex;
  gap: 24px;
  height: 64px;
  padding: 0 28px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-logo {
  align-items: center;
  color: var(--text);
  display: flex;
  font-family: 'Rajdhani', sans-serif;
  font-size: 20px;
  font-weight: 700;
  gap: 8px;
  letter-spacing: 0.05em;
  margin-right: auto;
  text-decoration: none;
  text-transform: uppercase;
}
.nav-logo em { color: var(--cyan); font-style: normal; }
.logo-icon { font-size: 22px; filter: drop-shadow(0 0 6px var(--cyan)); }

.nav-links { display: flex; gap: 4px; }
.nav-links a {
  align-items: center;
  border-radius: 6px;
  color: var(--text-muted);
  display: flex;
  font-size: 13px;
  font-weight: 500;
  gap: 6px;
  letter-spacing: 0.04em;
  padding: 6px 14px;
  text-decoration: none;
  text-transform: uppercase;
  transition: color 0.2s, background 0.2s;
}
.nav-links a:hover { background: var(--surface2); color: var(--text); }
.nav-links a.active { background: rgba(0, 212, 255, 0.1); color: var(--cyan); }
.nav-links .admin-link.active { background: rgba(255, 200, 0, 0.1); color: var(--gold); }
.nav-icon { font-size: 14px; }

.nav-right { align-items: center; display: flex; gap: 12px; }

.coins-badge {
  align-items: center;
  background: rgba(255, 200, 0, 0.08);
  border: 1px solid rgba(255, 200, 0, 0.25);
  border-radius: 20px;
  display: flex;
  gap: 6px;
  padding: 5px 14px;
}
.coin-icon { font-size: 14px; }
.coin-amount { color: var(--gold); font-size: 14px; font-weight: 700; font-family: 'Rajdhani', sans-serif; }
.coin-label { color: var(--text-muted); font-size: 11px; font-weight: 600; letter-spacing: 0.06em; }

.nav-avatar {
  align-items: center;
  background: var(--cyan);
  border-radius: 50%;
  color: #080812;
  display: flex;
  font-size: 12px;
  font-weight: 800;
  height: 34px;
  justify-content: center;
  text-decoration: none;
  width: 34px;
  transition: box-shadow 0.2s;
}
.nav-avatar:hover { box-shadow: 0 0 12px var(--cyan); }

.btn-logout {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 16px;
  height: 34px;
  transition: border-color 0.2s, color 0.2s;
  width: 34px;
}
.btn-logout:hover { border-color: #e74c3c; color: #e74c3c; }
</style>
