// In een React-component, bijv. SettingsView.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase'; // Pas pad aan indien nodig
// BELANGRIJK: Importeer getGoogleAuthUrlDirect
import { getGoogleAuthUrlDirect, storeGoogleTokensCallable } from '../../services/firebase'; 
import { useAuth } from '../../hooks/useAuth'; // Aanname: je hebt een useAuth hook die de huidige gebruiker verschaft

const SettingsView = ({ t, getThemeClasses, language, setLanguage, themeColor, setThemeColor, showAppModal, tSubject, setCurrentView, onProfileUpdate, fontFamily, setFontFamily, onDeleteAccountRequest, onCleanupAccountRequest, closeAppModal }) => {
  const { user } = useAuth();
  const [isGoogleDriveLinked, setIsGoogleDriveLinked] = useState(false);
  const [message, setMessage] = useState('');

  const checkGoogleDriveStatus = useCallback(async () => {
    if (user && user.uid) {
      try {
        const userDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/private/google`, "tokens");
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists() && userDocSnap.data()?.refresh_token) {
          setIsGoogleDriveLinked(true);
        } else {
          setIsGoogleDriveLinked(false);
        }
      } catch (error) {
        console.error("Fout bij controleren Google Drive status:", error);
        setMessage("Fout bij controleren Drive status.");
      }
    }
  }, [user]);

  useEffect(() => {
    checkGoogleDriveStatus();
  }, [checkGoogleDriveStatus]);

  const handleLinkGoogleDrive = async () => {
    if (!user || !user.uid) {
      setMessage('Je moet ingelogd zijn om Google Drive te koppelen.');
      return;
    }

    try {
      setMessage('Google Drive koppelen...');
      // BELANGRIJK: Hier wordt getGoogleAuthUrlDirect aangeroepen met de userId
      const result = await getGoogleAuthUrlDirect(user.uid); 
      const authUrl = result.url; // De URL komt nu als 'url' van de onRequest functie

      const authWindow = window.open(authUrl, '_blank', 'width=500,height=600');

      const messageListener = async (event) => {
        // Zorg ervoor dat het bericht van dezelfde oorsprong komt voor veiligheid
        if (event.origin !== window.location.origin) {
          console.warn("Bericht van onbekende oorsprong genegeerd:", event.origin);
          return;
        }

        const data = event.data;
        // LET OP: Cloud Function stuurt Firebase user ID mee als 'state'
        if (data && data.type === 'googleAuthCode' && data.code && data.state === user.uid) {
          try {
            setMessage('Autorisatiecode ontvangen, tokens opslaan...');
            // Gebruik storeGoogleTokensCallable zoals gedefinieerd in services/firebase.ts
            await storeGoogleTokensCallable({ code: data.code }); 
            setIsGoogleDriveLinked(true);
            setMessage('Google Drive succesvol gekoppeld!');
            checkGoogleDriveStatus(); // Update de status na succesvolle koppeling
          } catch (error) {
            console.error("Fout bij opslaan tokens:", error);
            setMessage(`Fout bij koppelen: ${error.message}`);
          } finally {
            authWindow?.close();
            window.removeEventListener('message', messageListener);
          }
        } else if (data && data.type === 'googleAuthCode' && data.state !== user.uid) {
            console.warn("State mismatch in Google Auth callback. Possible security issue or old window.");
            setMessage('Fout: Beveiligingscontrole mislukt. Probeer opnieuw.');
            authWindow?.close();
            window.removeEventListener('message', messageListener);
        }
      };
      window.addEventListener('message', messageListener);

      // Controleer of het pop-up venster is gesloten door de gebruiker
      const checkWindowClosed = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(checkWindowClosed);
          setMessage('Google Drive koppeling geannuleerd of venster gesloten.');
          window.removeEventListener('message', messageListener); // Verwijder de listener als het venster sluit
        }
      }, 1000);

    } catch (error: any) {
      console.error("Fout bij genereren auth URL:", error);
      setMessage(`Fout: ${error.message || 'Onbekende fout'}`);
    }
  };

  const handleUnlinkGoogleDrive = async () => {
    if (!user || !user.uid) {
      setMessage('Je moet ingelogd zijn.');
      return;
    }
    setMessage('Google Drive ontkoppelen...');
    try {
      // Roep disconnectGoogleDriveCallable aan
      await disconnectGoogleDriveCallable(); 
      setIsGoogleDriveLinked(false);
      setMessage('Google Drive succesvol ontkoppeld.');
    } catch (error: any) {
      console.error("Fout bij ontkoppelen Google Drive:", error);
      setMessage(`Fout bij ontkoppelen: ${error.message || 'Onbekende fout'}`);
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">{t('settings_title')}</h2>
      
      <div className="mb-6 p-6 border border-gray-200 rounded-lg bg-gray-50">
        <h3 className="text-2xl font-semibold text-indigo-700 mb-4">Google Drive Integratie</h3>
        {isGoogleDriveLinked ? (
          <div className="flex flex-col items-center">
            <p className="text-green-600 text-lg font-medium mb-4">
              <span className="inline-block mr-2">✅</span> Google Drive is succesvol gekoppeld!
            </p>
            <button
              onClick={handleUnlinkGoogleDrive}
              className={`${getThemeClasses('bg', 'bg-red-600')} text-white px-6 py-3 rounded-full text-lg font-semibold shadow-lg hover:bg-red-700 transition-colors duration-300 ease-in-out`}
            >
              Ontkoppel Google Drive
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <p className="text-gray-700 text-lg mb-4 text-center">
              Koppel je Google Drive account om documenten (PDF, Word, PowerPoint) op te slaan en te beheren via Schoolmaps.
            </p>
            <button
              onClick={handleLinkGoogleDrive}
              className={`${getThemeClasses('bg', 'bg-blue-600')} text-white px-6 py-3 rounded-full text-lg font-semibold shadow-lg hover:bg-blue-700 transition-colors duration-300 ease-in-out`}
            >
              Koppel Google Drive
            </button>
          </>
        )}
        {message && <p className={`mt-4 text-center text-base ${message.startsWith('Fout') ? 'text-red-500' : 'text-gray-700'}`}>{message}</p>}
      </div>
      {/* ... andere instellingen secties hieronder */}
    </div>
  );
};

export default SettingsView;
