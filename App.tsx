import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, appId, doc, getDoc, setDoc, collection } from './services/firebase';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [firestoreData, setFirestoreData] = useState<any | null>(null);

  useEffect(() => {
    let unsubscribeAuth: () => void;

    const initializeAndFetchData = async () => {
      // 1. Listen naar veranderingen in de authenticatiestatus
      unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
        if (currentUser) {
          setUser(currentUser);
          console.log("User signed in:", currentUser.uid);

          // 2. Wacht tot 'db' beschikbaar is en probeer een Firestore-bewerking
          if (db) {
            try {
              // Gebruik 'collection' om een reference te krijgen voordat je 'doc' gebruikt
              const testDocRef = doc(collection(db, 'testCollection'), 'testDocument');
              const docSnap = await getDoc(testDocRef);

              if (!docSnap.exists()) {
                await setDoc(testDocRef, { message: 'Hello from Firebase!', timestamp: new Date() });
                console.log("Test document aangemaakt in Firestore.");
              } else {
                console.log("Test document bestaat al.");
              }

              // Voorbeeld van het lezen van het document
              const updatedDocSnap = await getDoc(testDocRef);
              if (updatedDocSnap.exists()) {
                setFirestoreData(updatedDocSnap.data());
              } else {
                setFirestoreData({ message: "Geen data gevonden in testDocument." });
              }

            } catch (firestoreErr: any) {
              const errorMessage = `Fout bij Firestore: ${firestoreErr.message || 'Onbekende fout'}. Controleer je Firestore-regels en connectie.`;
              console.error(errorMessage, firestoreErr);
              setError(errorMessage);
              setShowErrorModal(true);
            }
          } else {
            const errorMessage = "Firestore database (db) object is niet beschikbaar. Is Firebase correct geïnitialiseerd?";
            console.error(errorMessage);
            setError(errorMessage);
            setShowErrorModal(true);
          }
        } else {
          setUser(null);
          console.log("Geen gebruiker ingelogd.");
        }
        setLoading(false);
      }, (authError) => {
        const errorMessage = `Authenticatiestatus fout: ${authError.message || 'Onbekende fout'}.`;
        console.error(errorMessage, authError);
        setError(errorMessage);
        setShowErrorModal(true);
        setLoading(false);
      });
    };

    initializeAndFetchData();

    // Cleanup de listener bij het unmounten van de component
    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, []); // Lege dependency array om één keer te runnen bij mount

  const handleCloseError = () => {
    setShowErrorModal(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 text-gray-800">
        <div className="flex flex-col items-center p-6 bg-white rounded-lg shadow-md">
          <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-4 text-lg">Laden...</p>
          <p className="text-sm text-gray-500">App ID: {appId}</p>
        </div>
      </div>
    );
  }

  if (showErrorModal) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
        <div className="relative bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
          <h2 className="text-xl font-bold text-red-600 mb-4">Foutmelding</h2>
          <p className="text-gray-700 mb-4">Er is een kritieke fout opgetreden:</p>
          <p className="text-red-500 font-mono text-sm break-words max-h-40 overflow-y-auto bg-gray-100 p-2 rounded">
            {error}
          </p>
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleCloseError}
              className="px-4 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition-colors"
            >
              Sluiten
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 to-indigo-200 text-gray-800 p-4">
      <div className="p-8 bg-white rounded-xl shadow-lg w-full max-w-md text-center">
        <h1 className="text-3xl font-extrabold text-indigo-700 mb-4">Welkom bij Schoolmaps Pro!</h1>
        {user ? (
          <>
            <p className="text-lg mb-2">Je bent succesvol ingelogd.</p>
            <p className="text-md text-gray-600 font-semibold break-words">Gebruikers-ID: <span className="text-blue-600">{user.uid}</span></p>
            {user.email && <p className="text-md text-gray-600 mt-1">E-mail: <span className="text-blue-600">{user.email}</span></p>}
            <p className="text-sm text-gray-500 mt-4">App ID: {appId}</p>

            <h2 className="text-xl font-bold text-gray-800 mt-6 mb-3">Firestore Test Data:</h2>
            {firestoreData ? (
              <pre className="bg-gray-100 p-4 rounded-md text-left text-sm overflow-x-auto">
                {JSON.stringify(firestoreData, null, 2)}
              </pre>
            ) : (
              <p className="text-gray-600">Geen Firestore data geladen.</p>
            )}

            <p className="mt-6 text-gray-700">Je kunt nu beginnen met het bouwen van je app!</p>
          </>
        ) : (
          <>
            <p className="text-lg text-red-500 font-semibold mb-4">Niet ingelogd.</p>
            <p className="text-md text-gray-600">Er is een probleem met de authenticatie, of de gebruiker is anoniem.</p>
            <p className="text-sm text-gray-500 mt-4">App ID: {appId}</p>
            <p className="mt-6 text-gray-700">Controleer de console voor Firebase-fouten. Zorg ervoor dat de `__initial_auth_token` correct is ingesteld in je deployment omgeving.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default App;
