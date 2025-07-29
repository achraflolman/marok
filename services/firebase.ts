

import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";
import "firebase/compat/functions";


const firebaseConfig = {
  apiKey: "AIzaSyAQf8SV7qf8FQkh7ayvRlBPR1-fRJ6d3Ks",
  authDomain: "schoolmaps-6a5f3.firebaseapp.com",
  projectId: "schoolmaps-6a5f3",
  storageBucket: "schoolmaps-6a5f3.appspot.com",
  messagingSenderId: "336929063264",
  appId: "1:336929063264:web:b633f4f66fd1b204899e05",
  measurementId: "G-8KKCCFBFSL"
};

export const appId = firebaseConfig.appId;

// Initialize Firebase
const app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();


// Initialize services
export const auth = firebase.auth();
export const db = firebase.firestore();
export const storage = firebase.storage();
const functions = firebase.functions();

try {
  db.enablePersistence({ experimentalForceOwningTab: true });
} catch (err) {
  if ((err as any).code === 'failed-precondition') {
    // Multiple tabs open, persistence can only be enabled
    // in one tab at a a time.
  } else if ((err as any).code === 'unimplemented') {
    // The current browser does not support all of the
    // features required to enable persistence
  }
}


// Export Firebase features
export const EmailAuthProvider = firebase.auth.EmailAuthProvider;

export const onAuthStateChanged = (
    authInstance: firebase.auth.Auth, 
    callback: (user: firebase.User | null) => void
) => {
    return authInstance.onAuthStateChanged(callback);
};

export const sendPasswordResetEmail = (
    authInstance: firebase.auth.Auth, 
    email: string
) => {
    return authInstance.sendPasswordResetEmail(email);
};

export const createUserWithEmailAndPassword = (
    authInstance: firebase.auth.Auth, 
    email: string, 
    password: string
) => {
    return authInstance.createUserWithEmailAndPassword(email, password);
};

export const signInWithEmailAndPassword = (
    authInstance: firebase.auth.Auth, 
    email: string, 
    password: string
) => {
    return authInstance.signInWithEmailAndPassword(email, password);
};

export const signOut = (authInstance: firebase.auth.Auth) => {
    return authInstance.signOut();
};

export const reauthenticateWithCredential = (
    user: firebase.User, 
    credential: firebase.auth.AuthCredential
) => {
    return user.reauthenticateWithCredential(credential);
};

export const deleteUser = (user: firebase.User) => {
    return user.delete();
};

export const sendEmailVerification = (user: firebase.User) => {
    return user.sendEmailVerification();
};


export const Timestamp = firebase.firestore.Timestamp;
export const arrayUnion = firebase.firestore.FieldValue.arrayUnion;
export const increment = firebase.firestore.FieldValue.increment;
export const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp;


// Functions
export const getGoogleAuthUrl = functions.httpsCallable('getGoogleAuthUrl');
export const storeGoogleTokens = functions.httpsCallable('storeGoogleTokens');
export const disconnectGoogleDrive = functions.httpsCallable('disconnectGoogleDrive');
export const uploadFileToDrive = functions.httpsCallable('uploadFileToDrive');
export const deleteFileFromDrive = functions.httpsCallable('deleteFileFromDrive');