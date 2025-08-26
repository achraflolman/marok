import React from 'react';
// De useAuth import is verwijderd, aangezien deze hook niet bestaat in je project.
import { User } from 'firebase/auth'; // Importeer de User type van Firebase

// Definieer de props die SettingsView nu verwacht
interface SettingsViewProps {
  user: User | null; // De user kan een Firebase User object zijn of null als niet ingelogd
  // Voeg hier andere props toe die SettingsView eventueel nodig heeft
}

const SettingsView: React.FC<SettingsViewProps> = ({ user }) => {
  // Nu kun je de 'user' variabele direct gebruiken, die als prop is doorgegeven.

  // Voorbeeld van het gebruik van de user
  const isLoggedIn = !!user;

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Instellingen</h1>

      {isLoggedIn ? (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-lg text-gray-700 mb-4">
            Welkom, {user.displayName || user.email || 'gebruiker'}!
          </p>
          <div className="flex items-center space-x-4 mb-4">
            {user.photoURL && (
              <img
                src={user.photoURL}
                alt="Profiel"
                className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500"
              />
            )}
            <div>
              <p className="text-gray-800 font-semibold">E-mail: {user.email}</p>
              {user.phoneNumber && (
                <p className="text-gray-600">Telefoon: {user.phoneNumber}</p>
              )}
            </div>
          </div>

          <h2 className="text-2xl font-semibold text-gray-800 mb-4 mt-8">Google Drive Integratie</h2>
          <p className="text-gray-700 mb-4">
            Hier kun je de integratie met Google Drive beheren.
            Aangezien je bent ingelogd, kun je nu verbinding maken of de verbinding verbreken.
          </p>
          <button
            className="bg-indigo-600 text-white px-6 py-3 rounded-lg shadow-lg hover:bg-indigo-700 transition-colors duration-200"
            onClick={() => console.log('Google Drive koppelen/ontkoppelen actie')}
          >
            Google Drive Beheren
          </button>

          {/* Andere instellingen kunnen hier komen */}
          <h2 className="text-2xl font-semibold text-gray-800 mb-4 mt-8">Accountbeheer</h2>
          <button
            className="bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg hover:bg-red-700 transition-colors duration-200"
            onClick={() => console.log('Uitloggen actie')}
          >
            Uitloggen
          </button>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <p className="text-lg text-gray-700 mb-4">
            Je bent momenteel niet ingelogd. Log in om je instellingen te beheren.
          </p>
          <button
            className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg hover:bg-green-700 transition-colors duration-200"
            onClick={() => console.log('Navigeer naar login pagina')}
          >
            Inloggen
          </button>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
