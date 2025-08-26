import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, EmailAuthProvider, onAuthStateChanged, signOut, reauthenticateWithCredential, deleteUser, sendPasswordResetEmail, sendEmailVerification, updateProfile, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import { getFirestore, Timestamp, arrayUnion, increment, serverTimestamp, collection, doc, setDoc, getDoc, updateDoc, query, where, orderBy, limit, getDocs, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Jouw web-app's Firebase configuratie - NU DIRECT INGESLOTEN
const firebaseConfig = {
  apiKey: "AIzaSyAQf8SV7qf8FQkh7ayvRlBPR1-fRJ6d3Ks",
  authDomain: "schoolmaps-6a5f3.firebaseapp.com",
  projectId: "schoolmaps-6a5f3",
  storageBucket: "schoolmaps-6a5f3.firebasestorage.app",
  messagingSenderId: "336929063264",
  appId: "1:336929063264:web:b633f4f66fd1b204899e05",
  measurementId: "G-8KKCCFBFSL"
};

// De appId vanuit de omgeving (of een fallback voor lokale ontwikkeling) blijft in gebruik
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Initialiseer Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);

// Authenticateer de gebruiker met een aangepaste token als deze beschikbaar is
// Gebruik een useEffect in React componenten om de auth state te beheren en Firestore calls te doen
if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
    // Probeer in te loggen met de custom token
    auth.signInWithCustomToken(__initial_auth_token).then(() => {
        console.log("Signed in with custom token.");
    }).catch((error) => {
        console.error("Error signing in with custom token:", error.code, error.message);
        // Fallback naar anoniem inloggen als custom token faalt
        signInAnonymously(auth).then(() => {
            console.log("Signed in anonymously after custom token failure.");
        }).catch((anonError) => {
            console.error("Error signing in anonymously:", anonError.code, anonError.message);
        });
    });
} else {
    // Val als anonieme gebruiker aan als geen token aanwezig is
    signInAnonymously(auth).then(() => {
        console.log("Signed in anonymously.");
    }).catch((error) => {
        console.error("Error signing in anonymously:", error.code, error.message);
    });
}


/**
 * Uploadt een bestand naar Firebase Storage.
 * @param file Het bestand dat moet worden geüpload.
 * @param path Het pad in Storage waar het bestand moet worden opgeslagen (bijv. 'uploads/userId/filename.ext').
 * @returns Een Promise die oplost met de download-URL van het geüploade bestand.
 */
const uploadFileToDrive = async (file: File, path: string): Promise<string> => {
    try {
        const storageRef = ref(storage, path);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;
    } catch (error) {
        console.error("Fout bij het uploaden van bestand:", error);
        throw error; // Hergooi de fout zodat de aanroepende code deze kan afhandelen
    }
};

/**
 * Verwijdert een bestand uit Firebase Storage.
 * @param filePath Het volledige pad naar het bestand in Storage (bijv. 'uploads/userId/filename.ext').
 * @returns Een Promise die oplost zodra het bestand is verwijderd.
 */
const deleteFileFromDrive = async (filePath: string): Promise<void> => {
    try {
        const fileRef = ref(storage, filePath);
        await deleteObject(fileRef);
        console.log(`Bestand succesvol verwijderd: ${filePath}`);
    } catch (error) {
        console.error("Fout bij het verwijderen van bestand:", error);
        throw error; // Hergooi de fout zodat de aanroepende code deze kan afhandelen
    }
};

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
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInAnonymously,
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
    // Voeg de nieuwe Storage-functies toe
    uploadFileToDrive,
    deleteFileFromDrive,
    // Firebase Functions gerelateerde exports
    httpsCallable
};
