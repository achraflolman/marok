const functions = require("firebase-functions");
const cors = require("cors");

// CORS instellen voor specifieke frontend
const corsHandler = cors({ origin: "https://googledrive-five.vercel.app" });

exports.getGoogleAuthUrl = functions.https.onRequest((req, res) => {
  corsHandler(req, res, () => {
    // Preflight request afhandelen
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "https://googledrive-five.vercel.app");
      res.set("Access-Control-Allow-Methods", "GET, POST");
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      return res.status(204).send('');
    }

    // Je bestaande logica
    const authUrl = "https://accounts.google.com/o/oauth2/auth?..."; 
    res.set("Access-Control-Allow-Origin", "https://googledrive-five.vercel.app");
    return res.status(200).json({ url: authUrl });
  });
});
