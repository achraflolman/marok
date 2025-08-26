import { initializeApp, getApps, getApp } from 'firebase/app';
// Voeg createUserWithEmailAndPassword en signInWithEmailAndPassword toe aan de import
import { getAuth, EmailAuthProvider, onAuthStateChanged, signOut, reauthenticateWithCredential, deleteUser, sendPasswordResetEmail, sendEmailVerification, updateProfile, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, Timestamp, arrayUnion, increment, serverTimestamp, collection, doc, setDoc, getDoc, updateDoc, query, where, orderBy, limit, getDocs, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Firebase configuratie vanuit de omgeving (of een fallback voor lokale ontwikkeling)
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; // Fallback voor appId

// Initialiseer Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);

// Authenticateer de gebruiker met een aangepaste token als deze beschikbaar is
if (typeof __initial_auth_token !== 'undefined') {
    auth.signInWithCustomToken(__initial_auth_token).catch((error) => {
        console.error("Error signing in with custom token:", error);
    });
} else {
    // Val als anonieme gebruiker aan als geen token aanwezig is (voor ontwikkeling of specifieke flows)
    auth.signInAnonymously().catch((error) => {
        console.error("Error signing in anonymously:", error);
    });
}


// Exporteer de geïnitialiseerde services en de noodzakelijke Firebase SDK functies
export {
    auth,
    db,
    storage,
    functions,
    appId, // Exporteer appId
    // Firebase Auth gerelateerde exports
    EmailAuthProvider,
    onAuthStateChanged,
    signOut,
    reauthenticateWithCredential,
    deleteUser,
    sendPasswordResetEmail,
    sendEmailVerification,
    updateProfile,
    // Voeg de ontbrekende authenticatiefuncties toe
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    // Firebase Firestore gerelateerde exports
    Timestamp,
    arrayUnion,
    increment,
    serverTimestamp,
    collection,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    deleteDoc,
    // Firebase Storage gerelateerde exports
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject,
    // Firebase Functions gerelateerde exports
    httpsCallable
};

