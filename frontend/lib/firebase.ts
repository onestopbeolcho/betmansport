import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyDcZcIkmeZph_GGd7Na9dZr5ICsoSvRj2k",
    authDomain: "smart-proto-inv-2026.firebaseapp.com",
    projectId: "smart-proto-inv-2026",
    storageBucket: "smart-proto-inv-2026.firebasestorage.app",
    messagingSenderId: "1050411652100",
    appId: "1:1050411652100:web:f4e249b0c4eaef7c8b5151",
};

// Prevent re-initialization
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, googleProvider };
