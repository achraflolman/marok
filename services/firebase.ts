// services/firebase.ts

// BELANGRIJK: Gebruik modulaire imports voor Firebase SDK v9+
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, EmailAuthProvider, onAuthStateChanged, signOut, reauthenticateWithCredential, deleteUser, sendPasswordResetEmail, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { getFirestore, Timestamp, arrayUnion, increment, serverTimestamp, enablePersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyAQf8SV7qf8FQkh7ayvRlBPR1-fRJ6d3Ks", // Jouw API Key
  authDomain: "schoolmaps-6a5f3.firebaseapp.com",
  projectId: "schoolmaps-6a5f3",
  storageBucket: "schoolmaps-6a5f3.appspot.com",
  messagingSenderId: "336929063264",
  appId: "1:336929063264:web:b633f4f66fd1b204899e05",
  measurementId: "G-8KKCCFBFSL"
};

// Initialiseer Firebase app
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialiseer services op de modulaire manier
export const auth = getAuth(app); 
export const db = getFirestore(app); 
export const storage = getStorage(app); 
export const functions = getFunctions(app); 

// Firestore persistence (alleen als je het echt wilt gebruiken)
try {
  enablePersistence(db, { experimentalForceOwningTab: true });
} catch (err: any) {
  if (err.code === 'failed-precondition') {
    console.warn("Firestore persistence could not be enabled: Multiple tabs open.");
  } else if (err.code === 'unimplemented') {
    console.warn("Firestore persistence could not be enabled: Browser does not support all required features.");
  } else {
    console.error("Firestore persistence error:", err);
  }
}

// Exporteer Firebase gerelateerde functies en types direct
export {
    EmailAuthProvider,
    onAuthStateChanged,
    sendPasswordResetEmail,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    reauthenticateWithCredential,
    deleteUser,
    sendEmailVerification,
    Timestamp,
    arrayUnion,
    increment,
    serverTimestamp
};

export const appId = firebaseConfig.projectId; 

// --- Callable Cloud Functions (blijven httpsCallable) ---
// getGoogleAuthUrlCallable zou HIER NIET MEER MOETEN STAAN
export const storeGoogleTokensCallable = httpsCallable(functions, 'storeGoogleTokens');
export const disconnectGoogleDriveCallable = httpsCallable(functions, 'disconnectGoogleDrive');
export const uploadFileToDriveCallable = httpsCallable(functions, 'uploadFileToDrive');
export const deleteFileFromDriveCallable = httpsCallable(functions, 'deleteFileFromDrive');


// --- NIEUW: Directe aanroep voor getGoogleAuthUrl (onRequest functie, stuurt GET) ---
export const getGoogleAuthUrlDirect = async (userId: string) => {
    // Dit is de URL van je gedeployde onRequest functie.
    // De naam van de functie is 'getGoogleAuthUrl' en de regio is 'us-central1' (standaard).
    const functionUrl = `https://us-central1-${firebaseConfig.projectId}.cloudfunctions.net/getGoogleAuthUrl?userId=${userId}`;

    try {
        const response = await fetch(functionUrl); // Dit doet standaard een GET-request
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
            throw new Error(errorData.message || `Fout bij ophalen autorisatie-URL: ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Fout bij directe aanroep getGoogleAuthUrl:", error);
        throw error;
    }
};
