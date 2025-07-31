// src/firebase.ts
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import { getStorage } from "firebase/storage";

// ← Paste your Web‐app config here from the console
const firebaseConfig = {
  apiKey: "AIzaSyBcqESlKL0TpMXy2q_Ug7JEoX7KxsOtFss",
  authDomain: "maap-74376.firebaseapp.com",
  projectId: "maap-74376",
  storageBucket: "maap-74376.firebasestorage.app",
  messagingSenderId: "677705418139",
  appId: "1:677705418139:web:4904f5ad2c857b4a8c0d3e",
  measurementId: "G-64GB1PXMWT"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Export what you actually need
export const auth    = firebase.auth();
export const db      = firebase.firestore();
export const storage = firebase.storage();

