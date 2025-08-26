import { initializeApp, getApps, getApp } from 'firebase/app';
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
