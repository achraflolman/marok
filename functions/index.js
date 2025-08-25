// functions/index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { google } = require("googleapis");
const cors = require('cors')({ origin: true }); // BELANGRIJK: Importeer de CORS middleware hier!

admin.initializeApp();
const db = admin.firestore();

// --- !!! DANGER: INSECURE HARDCODED SECRETS !!! ---
// DEZE SLEUTELS ZIJN NU DIRECT ZICHTBAAR IN JE CODE.
// DIT IS EEN ERNSTIG BEVEILIGINGSIRISICO EN MAG ALLEEN WORDEN GEBRUIKT VOOR
// TIJDELIJKE TESTDOELEINDEN OMDAT JE GEEN TOEGANG HEBT TOT DE FIREBASE CONSOLE FUNCTIE CONFIGURATIE.
// VERWIJDER DEZE ZODRA JE DE APP GOED WIL DEPLOYEN EN KRIJG TOEGANG TOT DE FIREBASE CONSOLE!
const CLIENT_ID = "336929063264-1tnha4m5je3tmbn7gckre2mdc9rvmak3.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
// --- EINDE VAN ONVEILIGE SECTIE ---

// This must be one of the "Authorized redirect URIs" in your Google Cloud Console
// EN exact overeenkomen met je Vercel app's redirect.html pagina.
const REDIRECT_URI = "https://googledrive-five.vercel.app/redirect.html"; 

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email"
];

const SCHOOLMAPS_FOLDER_NAME = "Schoolmaps Files";

// Helper function to check for auth
function requireAuth(context) {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'De functie moet worden aangeroepen terwijl geauthenticeerd.');
    }
    return context.auth.uid;
}

// Helper function to get an authenticated drive client
async function getDriveClient(uid) {
    const appId = admin.app().options.appId;
    const userPrivateDoc = await db.collection(`artifacts/${appId}/users/${uid}/private/google`).doc("tokens").get();
    if (!userPrivateDoc.exists) {
        throw new functions.https.HttpsError("failed-precondition", "Gebruiker heeft hun Google Drive account niet gekoppeld.");
    }
    const tokens = userPrivateDoc.data();
    oauth2Client.setCredentials({ refresh_token: tokens.refresh_token });

    const { token: accessToken } = await oauth2Client.getAccessToken();
    oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: tokens.refresh_token,
    });

    return google.drive({ version: "v3", auth: oauth2Client });
}

// --- Cloud Function 1: getGoogleAuthUrl (NU ALS onRequest MET HANDMATIGE CORS) ---
exports.getGoogleAuthUrl = functions.https.onRequest((req, res) => {
    // Gebruik de CORS middleware
    cors(req, res, async () => {
        // userId wordt nu als query parameter in de URL meegestuurd
        const userId = req.query.userId; 

        if (!userId) {
            res.status(401).send('Authenticatie vereist: userId ontbreekt in aanvraag.');
            return;
        }

        // We valideren de Firebase Auth status niet direct in onRequest,
        // maar de 'state' parameter zal de UID bevatten voor de volgende stap (storeGoogleTokens).

        const authUrl = oauth2Client.generateAuthUrl({
            access_type: "offline",
            prompt: "consent",
            scope: SCOPES.join(' '), 
            state: userId // Stuur de Firebase user ID mee als 'state'
        });

        // Stuur de URL terug naar de frontend
        res.status(200).send({ url: authUrl });
    });
});


// --- De volgende functies blijven https.onCall ---
// (Deze zouden normaliter CORS automatisch moeten afhandelen via Firebase Auth geautoriseerde domeinen)

exports.storeGoogleTokens = functions.https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    const { code } = data;
    if (!code) {
        throw new functions.https.HttpsError('invalid-argument', 'De functie moet worden aangeroepen met een "code" argument.');
    }

    const { tokens } = await oauth2Client.getToken(code);
    const { refresh_token } = tokens;

    if (!refresh_token) {
        throw new functions.https.HttpsError('permission-denied', 'Een refresh token is niet geleverd door Google. Gelieve opnieuw te authentiseren.');
    }

    const appId = admin.app().options.appId;
    const privateDataRef = db.collection(`artifacts/${appId}/users/${uid}/private/google`).doc("tokens");
    await privateDataRef.set({ refresh_token: refresh_token });

    const publicUserRef = db.collection(`artifacts/${appId}/public/data/users`).doc(uid);
    await publicUserRef.set({ isDriveConnected: true }, { merge: true });

    return { success: true, message: "Google Drive succesvol gekoppeld." };
});

exports.disconnectGoogleDrive = functions.https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    const appId = admin.app().options.appId;

    const userPrivateDoc = await db.collection(`artifacts/${appId}/users/${uid}/private/google`).doc("tokens").get();
    if (userPrivateDoc.exists) {
        const tokens = userPrivateDoc.data();
        if (tokens.refresh_token) {
           try {
             await oauth2Client.revokeToken(tokens.refresh_token);
           } catch(e) {
             console.warn(`Kon token niet intrekken voor gebruiker ${uid}`, e.message);
           }
        }
    }

    const privateDataRef = db.collection(`artifacts/${appId}/users/${uid}/private/google`).doc("tokens");
    const publicUserRef = db.collection(`artifacts/${appId}/public/data/users`).doc(uid);

    await privateDataRef.delete();
    await publicUserRef.set({ isDriveConnected: false }, { merge: true });

    return { success: true, message: "Google Drive ontkoppeld." };
});

async function findOrCreateFolder(drive) {
    let folderId = null;
    const query = `mimeType='application/vnd.google-apps.folder' and name='${SCHOOLMAPS_FOLDER_NAME}' and trashed=false`;
    const listRes = await drive.files.list({ q: query, fields: 'files(id, name)' });

    if (listRes.data.files.length > 0) {
        folderId = listRes.data.files[0].id;
    } else {
        const fileMetadata = { name: SCHOOLMAPS_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' };
        const folder = await drive.files.create({ resource: fileMetadata, fields: 'id' });
        folderId = folder.data.id;
    }
    return folderId;
}

exports.uploadFileToDrive = functions.runWith({ timeoutSeconds: 300, memory: '1GB' }).https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    const { fileContent, fileName, fileType, title, description, subject } = data;

    if (!fileContent || !fileName || !fileType || !title || !subject) {
            throw new functions.https.HttpsError('invalid-argument', 'Ontbrekende vereiste parameters voor bestandsupload.');
    }

    try {
        const drive = await getDriveClient(uid);
        const folderId = await findOrCreateFolder(drive);

        const fileMetadata = { name: fileName, parents: [folderId] };
        const media = { mimeType: fileType, body: Buffer.from(fileContent, 'base64') };

        const file = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, name, webViewLink, webContentLink',
        });
        
        await drive.permissions.create({
            fileId: file.data.id,
            resource: { role: 'reader', type: 'anyone' },
        });
        
        const downloadUrl = file.data.webContentLink || file.data.webViewLink;

        const appId = admin.app().options.appId;
        const fileDocRef = db.collection(`artifacts/${appId}/public/data/files`).doc();

        await fileDocRef.set({
            id: fileDocRef.id,
            title: title,
            description: description,
            subject: subject,
            ownerId: uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            fileUrl: downloadUrl,
            storagePath: `googledrive/${file.data.id}`,
            driveFileId: file.data.id
        });

        return { success: true, fileId: file.data.id };
    } catch (error) {
        console.error('Bestandsuploadfout:', error);
        if (error.code >= 400 && error.code < 500) {
             throw new functions.https.HttpsError('permission-denied', `Google Drive API-fout: ${error.message}`);
        }
        throw new functions.https.HttpsError('internal', 'Kan bestand niet uploaden.', { details: error.message });
    }
});

exports.deleteFileFromDrive = functions.https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    const { fileId, driveFileId } = data;

    if (!fileId || !driveFileId) {
        throw new functions.https.HttpsError('invalid-argument', 'Ontbrekende fileId of driveFileId.');
    }

    try {
        const drive = await getDriveClient(uid);
        await drive.files.delete({ fileId: driveFileId });
    } catch (error) {
        console.error('Drive bestand verwijderingsfout:', error);
        if (error.code !== 404) {
            throw new functions.https.HttpsError('internal', 'Kan bestand niet verwijderen van Google Drive.', { details: error.message });
        }
    }

    try {
        const appId = admin.app().options.appId;
        await db.collection(`artifacts/${appId}/public/data/files`).doc(fileId).delete();
        return { success: true };
    } catch(dbError) {
        console.error('Firestore bestand verwijderingsfout:', dbError);
        throw new functions.https.HttpsError('internal', 'Kan bestand niet verwijderen uit database.', { details: dbError.message });
    }
});
