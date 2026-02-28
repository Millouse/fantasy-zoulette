// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { auth } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'

import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import Profile from '../views/Profile.vue'
import ForgotPassword from '../views/ForgotPassword.vue'
import Betting from '../views/Betting.vue'
import MyBets from '../views/MyBets.vue'
import Admin from '../views/Admin.vue'

const routes = [
  { path: '/', redirect: '/betting' },
  { path: '/login', component: Login, meta: { guestOnly: true } },
  { path: '/register', component: Register, meta: { guestOnly: true } },
  { path: '/forgot-password', component: ForgotPassword, meta: { guestOnly: true } },
  { path: '/betting', component: Betting, meta: { requiresAuth: true } },
  { path: '/my-bets', component: MyBets, meta: { requiresAuth: true } },
  { path: '/profile', component: Profile, meta: { requiresAuth: true } },
  { path: '/admin', component: Admin, meta: { requiresAuth: true, adminOnly: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

const getCurrentUser = () =>
  new Promise((resolve) => onAuthStateChanged(auth, resolve))

router.beforeEach(async (to) => {
  const user = await getCurrentUser()
  if (to.meta.requiresAuth && !user) return '/login'
  if (to.meta.guestOnly && user) return '/betting'
  if (to.meta.adminOnly) {
    const { ADMIN_EMAIL } = await import('../config')
    if (user?.email !== ADMIN_EMAIL) return '/betting'
  }
})

export default router
