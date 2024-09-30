import { Router } from "express";
import StreamClient from "../client/StreamClient.js";
import SongClient from "../client/SongClient.js";
import AccountClient from "../client/AccountClient.js";
import SpotifyClient from "../client/auth_services/SpotifyClient.js";
import LastFMClient from "../client/auth_services/LastFMClient.js";
import AppleMusicClient from "../client/auth_services/AppleMusicClient.js";

const router = Router();

// Up Status
router.get("/status", (req, res) => res.json());

// SSE live data
router.get("/data", (req, res) => StreamClient.getLiveDataStream(req, res));

// Stream Routes
router.get("/stream", (req, res) => StreamClient.addClientToStream(req, res));

// Song Routes
router.post("/song/submit", (req, res) =>
  SongClient.submitSongRequest(req, res),
);
router.get("/history/:page", (req, res) => SongClient.getSongHistory(req, res));

// Account Routes
router.post("/register", (req, res) => AccountClient.register(req, res));
router.post("/login", (req, res) => AccountClient.login(req, res));
router.post("/logout", (req, res) => AccountClient.logout(req, res));
router.get("/handle", (req, res) =>
  AccountClient.getHandleAndPictureFromToken(req, res),
);
router.get("/accounts", (req, res) =>
  AccountClient.getPrivateProfile(req, res),
);
router.post("/accounts", (req, res) => AccountClient.updateProfile(req, res));
router.get("/accounts/:handle", (req, res) =>
  AccountClient.getPublicProfile(req, res),
);
router.get("/accounts/:handle/history", (req, res) =>
  AccountClient.getHistory(req, res),
);

// Authorized Services Routes
// Spotify
router.get("/auth/spotify/callback", (req, res) =>
  SpotifyClient.authorize(req, res),
);
router.post("/auth/spotify/add", (req, res) =>
  SpotifyClient.addSongToPlaylist(req, res),
);
router.post("/auth/spotify/unlink", (req, res) =>
  SpotifyClient.removeAuthorization(req, res),
);

// LastFM
router.get("/auth/lastfm/callback", (req, res) =>
  LastFMClient.authorize(req, res),
);
router.post("/auth/lastfm/unlink", (req, res) =>
  LastFMClient.removeAuthorization(req, res),
);

// Apple Music
router.get("/auth/applemusic/developerToken", (req, res) =>
  AppleMusicClient.getDeveloperToken(req, res),
);
router.post("/auth/applemusic/callback", (req, res) =>
  AppleMusicClient.authorize(req, res),
);
router.post("/auth/applemusic/add", (req, res) =>
  AppleMusicClient.addSongToPlaylist(req, res),
);
router.post("/auth/applemusic/unlink", (req, res) =>
  AppleMusicClient.removeAuthorization(req, res),
);

// Admin Routes
router.get("/admin/queue/user", (req, res) =>
  AccountClient.getUserQueue(req, res),
);
router.get("/admin/queue/audio", (req, res) =>
  AccountClient.getAudioQueue(req, res),
);
router.get("/admin/queue/suggestion", (req, res) =>
  AccountClient.getSuggestionQueue(req, res),
);
router.post("/admin/queue/user", (req, res) =>
  AccountClient.editUserQueue(req, res),
);
router.post("/admin/queue/audio", (req, res) =>
  AccountClient.editAudioQueue(req, res),
);
router.post("/admin/queue/suggestion", (req, res) =>
  AccountClient.editSuggestionQueue(req, res),
);
router.post("/admin/skip", (req, res) =>
  AccountClient.skipCurrentSong(req, res),
);

export default router;
