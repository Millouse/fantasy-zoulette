<template>
  <div id="app">
    <div v-if="authStore.loading" class="splash">
      <div class="splash-content">
        <div class="splash-logo">⚡</div>
        <div class="splash-text">ZOULETTE<span>GG</span></div>
        <div class="splash-bar"><div class="splash-fill"></div></div>
      </div>
    </div>
    <RouterView v-else />
  </div>
</template>

<script setup>
import { watch } from 'vue'
import { useAuthStore } from './stores/auth'
import { startAutoResolve, stopAutoResolve } from './services/autoResolve'

const authStore = useAuthStore()

// Start polling when user is logged in, stop when logged out
watch(() => authStore.isLoggedIn, (loggedIn) => {
  if (loggedIn) startAutoResolve(60_000)
  else stopAutoResolve()
}, { immediate: true })
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Exo+2:wght@300;400;500;600&display=swap');

:root {
  --bg: #06060f;
  --surface: #0d0d1f;
  --surface2: #131328;
  --surface3: #1a1a35;
  --border: #1e1e40;
  --border-bright: #2a2a5a;
  --cyan: #00d4ff;
  --cyan-dim: rgba(0, 212, 255, 0.15);
  --green: #00ff88;
  --green-dim: rgba(0, 255, 136, 0.12);
  --gold: #ffc800;
  --gold-dim: rgba(255, 200, 0, 0.12);
  --red: #ff4757;
  --red-dim: rgba(255, 71, 87, 0.12);
  --text: #e0e8ff;
  --text-muted: #5a6080;
  --text-dim: #3a4060;
  --radius: 10px;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: var(--bg);
  background-image:
    radial-gradient(ellipse at 20% 0%, rgba(0,212,255,0.04) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 100%, rgba(0,255,136,0.03) 0%, transparent 60%);
  color: var(--text);
  font-family: 'Exo 2', sans-serif;
  font-size: 15px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}

h1, h2, h3, .display { font-family: 'Rajdhani', sans-serif; letter-spacing: 0.04em; }

a { color: var(--cyan); text-decoration: none; }
a:hover { color: #40e0ff; }

input, textarea, select {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-family: 'Exo 2', sans-serif;
  font-size: 14px;
  outline: none;
  padding: 11px 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
  width: 100%;
}
input:focus, textarea:focus, select:focus {
  border-color: var(--cyan);
  box-shadow: 0 0 0 3px rgba(0,212,255,0.08);
}
select option { background: var(--surface2); }

button { cursor: pointer; font-family: 'Exo 2', sans-serif; font-size: 14px; font-weight: 500; }

.btn-primary {
  background: var(--cyan);
  border: none;
  border-radius: 8px;
  color: #06060f;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 12px 24px;
  text-transform: uppercase;
  transition: box-shadow 0.2s, transform 0.1s, background 0.2s;
  width: 100%;
}
.btn-primary:hover { background: #40e0ff; box-shadow: 0 0 20px rgba(0,212,255,0.4); transform: translateY(-1px); }
.btn-primary:active { transform: translateY(0); }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }

.btn-yes {
  background: var(--green-dim);
  border: 1px solid var(--green);
  border-radius: 8px;
  color: var(--green);
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 10px 20px;
  text-transform: uppercase;
  transition: background 0.2s, box-shadow 0.2s;
}
.btn-yes:hover, .btn-yes.active {
  background: var(--green);
  box-shadow: 0 0 16px rgba(0,255,136,0.4);
  color: #06060f;
}

.btn-no {
  background: var(--red-dim);
  border: 1px solid var(--red);
  border-radius: 8px;
  color: var(--red);
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 10px 20px;
  text-transform: uppercase;
  transition: background 0.2s, box-shadow 0.2s;
}
.btn-no:hover, .btn-no.active {
  background: var(--red);
  box-shadow: 0 0 16px rgba(255,71,87,0.4);
  color: #fff;
}

.btn-ghost {
  background: transparent;
  border: 1px solid var(--border-bright);
  border-radius: 8px;
  color: var(--text-muted);
  padding: 10px 20px;
  transition: border-color 0.2s, color 0.2s;
}
.btn-ghost:hover { border-color: var(--cyan); color: var(--cyan); }

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
}

.error-msg {
  background: var(--red-dim);
  border: 1px solid rgba(255,71,87,0.3);
  border-radius: 8px;
  color: var(--red);
  font-size: 13px;
  padding: 10px 14px;
}
.success-msg {
  background: var(--green-dim);
  border: 1px solid rgba(0,255,136,0.3);
  border-radius: 8px;
  color: var(--green);
  font-size: 13px;
  padding: 10px 14px;
}

/* Splash */
.splash {
  align-items: center;
  background: var(--bg);
  display: flex;
  height: 100vh;
  justify-content: center;
}
.splash-content { align-items: center; display: flex; flex-direction: column; gap: 12px; }
.splash-logo {
  animation: pulse-glow 1.2s ease-in-out infinite;
  color: var(--cyan);
  font-size: 48px;
  filter: drop-shadow(0 0 20px var(--cyan));
}
.splash-text {
  color: var(--text);
  font-family: 'Rajdhani', sans-serif;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}
.splash-text span { color: var(--cyan); }
.splash-bar {
  background: var(--surface2);
  border-radius: 4px;
  height: 3px;
  overflow: hidden;
  width: 120px;
}
.splash-fill {
  animation: load-bar 1.5s ease-in-out infinite;
  background: var(--cyan);
  border-radius: 4px;
  height: 100%;
  width: 40%;
}

@keyframes pulse-glow {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.9); }
}
@keyframes load-bar {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Auth pages */
.auth-page {
  align-items: center;
  background:
    radial-gradient(ellipse at 30% 20%, rgba(0,212,255,0.06) 0%, transparent 50%),
    radial-gradient(ellipse at 70% 80%, rgba(0,255,136,0.04) 0%, transparent 50%);
  display: flex;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
}
.auth-card {
  animation: fadeUp 0.45s ease both;
  background: var(--surface);
  border: 1px solid var(--border-bright);
  border-radius: 16px;
  padding: 44px 40px;
  width: 100%;
  max-width: 420px;
}
.auth-logo {
  color: var(--cyan);
  filter: drop-shadow(0 0 10px var(--cyan));
  font-size: 32px;
  margin-bottom: 8px;
  text-align: center;
}
.auth-brand {
  font-family: 'Rajdhani', sans-serif;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 0.12em;
  margin-bottom: 4px;
  text-align: center;
  text-transform: uppercase;
}
.auth-brand span { color: var(--cyan); }
.auth-title {
  color: var(--text-muted);
  font-size: 13px;
  letter-spacing: 0.06em;
  margin-bottom: 36px;
  text-align: center;
  text-transform: uppercase;
}
.form-group { margin-bottom: 18px; }
.form-group label {
  color: var(--text-muted);
  display: block;
  font-size: 11px;
  letter-spacing: 0.1em;
  margin-bottom: 8px;
  text-transform: uppercase;
}
.auth-footer {
  color: var(--text-muted);
  font-size: 13px;
  margin-top: 24px;
  text-align: center;
}

/* Layout */
.app-layout { display: flex; flex-direction: column; min-height: 100vh; }
.page-content { flex: 1; padding: 36px 28px; max-width: 1200px; margin: 0 auto; width: 100%; }
.page-title {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 0.06em;
  margin-bottom: 6px;
  text-transform: uppercase;
}
.page-subtitle { color: var(--text-muted); font-size: 13px; margin-bottom: 32px; }
</style>