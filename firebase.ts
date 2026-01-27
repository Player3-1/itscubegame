import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration for Cube Dash
// NOT: Bu key'ler client tarafında kullanılmak üzere tasarlanmıştır, gizli sunucu anahtarı değildir.
const firebaseConfig = {
  apiKey: 'AIzaSyB-dImE5HRQ27LhOOevoQWQOiYopa8V5mM',
  authDomain: 'cubedash-b1437.firebaseapp.com',
  projectId: 'cubedash-b1437',
  storageBucket: 'cubedash-b1437.firebasestorage.app',
  messagingSenderId: '498797042108',
  appId: '1:498797042108:web:e67102623072f9c47df3b9',
  measurementId: 'G-CJHW6LP8J4',
} as const;

// Initialize Firebase app (tek instance)
const app = initializeApp(firebaseConfig);

// Firestore instance (users, levels, skorlar burada tutulacak)
export const db = getFirestore(app);

export default app;
