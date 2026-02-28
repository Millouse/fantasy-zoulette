// src/firebase.js
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyBPX8tkddO6p56TrgRD7DFOFCt1xZRH9uw",
  authDomain: "fantasy-zoulette.firebaseapp.com",
  projectId: "fantasy-zoulette",
  storageBucket: "fantasy-zoulette.firebasestorage.app",
  messagingSenderId: "763874923941",
  appId: "1:763874923941:web:e5c99b51f611967521044c"
};

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
