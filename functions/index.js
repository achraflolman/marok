const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { google } = require("googleapis");

admin.initializeApp();
const db = admin.firestore();

// --- !!! DANGER: INSECURE HARDCODED SECRETS !!! ---
// WARNING: These keys are visible in your code. This is a major security risk.
// Anyone with access to this code can misuse your application's permissions.
// It is STRONGLY recommended to use environment variables instead.
// After you confirm this works, please generate a NEW client secret in the
// Google Cloud Console and try setting them as environment variables again.
const CLIENT_ID = "336929063264-1tnha4m5je3tmbn7gckre2mdc9rvmak3.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
// --- END OF INSECURE SECTION ---


// This must be one of the "Authorized redirect URIs" in your Google Cloud Console
const REDIRECT_URI = "https://googledrive-five.vercel.app/redirect.html";

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/userinfo.profile",
];

const SCHOOLMAPS_FOLDER_NAME = "Schoolmaps Files";

// Helper function to check for auth
function requireAuth(context) {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    return context.auth.uid;
}

// Helper function to get an authenticated drive client
async function getDriveClient(uid) {
    const userPrivateDoc = await db.collection(`artifacts/${admin.app().options.appId}/users/${uid}/private/google`).doc("tokens").get();
    if (!userPrivateDoc.exists) {
        throw new functions.https.HttpsError("failed-precondition", "User has not connected their Google Drive account.");
    }
    const tokens = userPrivateDoc.data();
    oauth2Client.setCredentials({ refresh_token: tokens.refresh_token });

    // Refresh the access token to ensure it's valid
    const { token } = await oauth2Client.getAccessToken();
    oauth2Client.setCredentials({
        access_token: token,
        refresh_token: tokens.refresh_token,
    });

    return google.drive({ version: "v3", auth: oauth2Client });
}

exports.getGoogleAuthUrl = functions.https.onCall(async (data, context) => {
    requireAuth(context);
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: SCOPES,
    });
    return { url: authUrl };
});

exports.storeGoogleTokens = functions.https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    const { code } = data;
    if (!code) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a "code" argument.');
    }

    const { tokens } = await oauth2Client.getToken(code);
    const { refresh_token } = tokens;

    if (!refresh_token) {
        throw new functions.https.HttpsError('permission-denied', 'A refresh token was not provided by Google. Please re-authenticate.');
    }

    const privateDataRef = db.collection(`artifacts/${admin.app().options.appId}/users/${uid}/private/google`).doc("tokens");
    await privateDataRef.set({ refresh_token: refresh_token });

    const publicUserRef = db.collection(`artifacts/${admin.app().options.appId}/public/data/users`).doc(uid);
    await publicUserRef.update({ isDriveConnected: true });

    return { success: true, message: "Google Drive connected successfully." };
});

exports.disconnectGoogleDrive = functions.https.onCall(async (data, context) => {
    const uid = requireAuth(context);

    // Revoke the token with Google
    const userPrivateDoc = await db.collection(`artifacts/${admin.app().options.appId}/users/${uid}/private/google`).doc("tokens").get();
    if (userPrivateDoc.exists) {
        const tokens = userPrivateDoc.data();
        if (tokens.refresh_token) {
           try {
              // This can fail if token is already invalid, but we should proceed anyway
              await oauth2Client.revokeToken(tokens.refresh_token);
           } catch(e) {
              console.warn(`Could not revoke token for user ${uid}`, e.message);
           }
        }
    }

    const privateDataRef = db.collection(`artifacts/${admin.app().options.appId}/users/${uid}/private/google`).doc("tokens");
    const publicUserRef = db.collection(`artifacts/${admin.app().options.appId}/public/data/users`).doc(uid);

    await privateDataRef.delete();
    await publicUserRef.update({ isDriveConnected: false });

    return { success: true, message: "Google Drive disconnected." };
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
         throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters for file upload.');
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

        const fileDocRef = db.collection(`artifacts/${admin.app().options.appId}/public/data/files`).doc();

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
        console.error('File upload error:', error);
        if (error.code >= 400 && error.code < 500) {
             throw new functions.https.HttpsError('permission-denied', `Google Drive API Error: ${error.message}`);
        }
        throw new functions.https.HttpsError('internal', 'Unable to upload file.', { details: error.message });
    }
});

exports.deleteFileFromDrive = functions.https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    const { fileId, driveFileId } = data;

    if (!fileId || !driveFileId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing fileId or driveFileId.');
    }

    try {
        const drive = await getDriveClient(uid);
        await drive.files.delete({ fileId: driveFileId });
    } catch (error) {
        console.error('Drive file deletion error:', error);
        if (error.code !== 404) {
            throw new functions.https.HttpsError('internal', 'Unable to delete file from Google Drive.', { details: error.message });
        }
    }

    try {
        await db.collection(`artifacts/${admin.app().options.appId}/public/data/files`).doc(fileId).delete();
        return { success: true };
    } catch(dbError) {
        console.error('Firestore file deletion error:', dbError);
        throw new functions.https.HttpsError('internal', 'Unable to delete file from database.', { details: dbError.message });
    }
});
