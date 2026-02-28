// src/stores/auth.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
} from 'firebase/auth'
import { doc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { ADMIN_EMAIL } from '../config'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const loading = ref(true)
  let unsubSnapshot = null

  const isLoggedIn = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.email === ADMIN_EMAIL)
  const coins = computed(() => user.value?.coins ?? 0)

  onAuthStateChanged(auth, async (firebaseUser) => {
    if (unsubSnapshot) { unsubSnapshot(); unsubSnapshot = null }
    if (firebaseUser) {
      unsubSnapshot = onSnapshot(doc(db, 'users', firebaseUser.uid), (snap) => {
        user.value = { ...firebaseUser, ...snap.data() }
      })
    } else {
      user.value = null
    }
    loading.value = false
  })

  async function register(email, password, displayName) {
    const { user: fu } = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(fu, { displayName })
    await setDoc(doc(db, 'users', fu.uid), {
      displayName,
      email,
      coins: 10000,
      createdAt: new Date().toISOString(),
    })
  }

  async function login(email, password) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function logout() {
    if (unsubSnapshot) unsubSnapshot()
    await signOut(auth)
  }

  async function resetPassword(email) {
    await sendPasswordResetEmail(auth, email)
  }

  async function updateUserProfile(data) {
    if (!auth.currentUser) return
    if (data.displayName) await updateProfile(auth.currentUser, { displayName: data.displayName })
    await updateDoc(doc(db, 'users', auth.currentUser.uid), data)
  }

  return { user, loading, isLoggedIn, isAdmin, coins, register, login, logout, resetPassword, updateUserProfile }
})
