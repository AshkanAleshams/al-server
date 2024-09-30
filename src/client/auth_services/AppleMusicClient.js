import axios from "axios";
import jwt from "jsonwebtoken";
import AccountModelService from "../../services/db/AccountModelService.js";
import ClientService from "../ClientService.js";
import { log } from "../../utils/logger.js";
import TrackModelService from "../../services/db/TrackModelService.js";

class AppleMusicClient extends ClientService {
  constructor() {
    super();
    this._key_id = process.env.APPLE_MUSIC_KEY_ID;
    this._private_key = process.env.APPLE_MUSIC_PRIVATE_KEY;
    this._team_id = process.env.APPLE_MUSIC_TEAM_ID;
    this._client_url = process.env.CLIENT_URL;
  }

  async _generateDeveloperToken() {
    const token = jwt.sign({}, this._private_key, {
      algorithm: "ES256",
      keyid: this._key_id,
      issuer: this._team_id,
      expiresIn: "180d",
    });
    return token;
  }

  async getDeveloperToken(req, res) {
    res.json({ developerToken: await this._generateDeveloperToken() });
  }

  async authorize(req, res) {
    const authHandle = this.authenticateStrict(req, res);
    if (!authHandle) {
      return;
    }

    const musicUserToken = req.body.musicUserToken;
    if (!musicUserToken) {
      return res
        .status(400)
        .json({ message: "No code or Music User Token provided" });
    }

    await AccountModelService.addAppleMusicTokens(authHandle, musicUserToken);

    res.redirect(302, `${this._client_url}`);
  }

  async removeAuthorization(req, res) {
    const authHandle = this.authenticateStrict(req, res);
    if (!authHandle) {
      return;
    }

    try {
      await AccountModelService.addAppleMusicTokens(authHandle, null);
      await AccountModelService.addAppleMusicQuickAddPlaylistId(
        authHandle,
        null,
      );
      res.status(200).json({ message: "Apple Music authorization removed" });
    } catch (error) {
      log(
        "error",
        `Error removing Apple Music authorization: ${error.message}`,
        this.constructor.name,
      );
      res
        .status(500)
        .json({ message: "Error removing Apple Music authorization" });
    }
  }

  async addSongToPlaylist(req, res) {
    const authHandle = this.authenticateStrict(req, res);
    if (!authHandle) {
      return;
    }

    let { trackId } = req.body;
    if (!trackId) {
      return res.status(400).json({ message: "No trackId provided" });
    }

    trackId = await TrackModelService.convertTrackIdToAppleMusicId(trackId);
    if (!trackId) {
      return res
        .status(400)
        .json({ message: "Cannot find song on Apple Music" });
    }

    try {
      const { appleMusicToken: musicUserToken } =
        await AccountModelService.getAppleMusicTokens(authHandle);
      const developerToken = await this._generateDeveloperToken();
      const playlist = await this._getOrCreatePlaylist(
        musicUserToken,
        authHandle,
      );

      await this._addTrackToPlaylist(
        playlist.id,
        trackId,
        musicUserToken,
        developerToken,
      );
      res.status(200).json({ message: "Track added to your playlist!" });
    } catch (error) {
      log(
        "error",
        `Error adding song to playlist: ${error.message}`,
        this.constructor.name,
      );
      res.status(500).json({ message: "Error adding song to playlist" });
    }
  }

  async _getOrCreatePlaylist(
    musicUserToken,
    authHandle,
    playlistName = "AL Radio",
  ) {
    const { appleMusicQuickAddPlaylistId: appleMusicPlaylistId } =
      await AccountModelService.getAppleMusicQuickAddPlaylistId(authHandle);

    log(
      "info",
      `Got playlist ID from database: ${appleMusicPlaylistId}`,
      this.constructor.name,
    );
    if (appleMusicPlaylistId) {
      try {
        const playlistResponse = await axios.get(
          `https://api.music.apple.com/v1/me/library/playlists/${appleMusicPlaylistId}`,
          {
            headers: {
              Authorization: `Bearer ${await this._generateDeveloperToken()}`, // Use Developer Token
              "Music-User-Token": musicUserToken, // Use Music User Token
            },
          },
        );

        if (!playlistResponse.data.data[0].attributes.canEdit) {
          log(
            "info",
            `Playlist not editable, creating new playlist`,
            this.constructor.name,
          );
          await AccountModelService.addAppleMusicQuickAddPlaylistId(
            authHandle,
            null,
          );
          return this._getOrCreatePlaylist(
            musicUserToken,
            authHandle,
            playlistName,
          );
        }
        return playlistResponse.data.data[0];
      } catch (error) {
        if (error.response && error.response.status === 404) {
          log(
            "info",
            `Playlist not found, creating new playlist`,
            this.constructor.name,
          );
          await AccountModelService.addAppleMusicQuickAddPlaylistId(
            authHandle,
            null,
          );
          return this._getOrCreatePlaylist(
            musicUserToken,
            authHandle,
            playlistName,
          );
        }
        throw error;
      }
    }

    log("info", `Creating playlist: ${playlistName}`, this.constructor.name);
    const createPlaylistResponse = await axios.post(
      `https://api.music.apple.com/v1/me/library/playlists`,
      {
        attributes: {
          name: playlistName,
          description: "Playlist created by AL",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${await this._generateDeveloperToken()}`, // Use Developer Token
          "Music-User-Token": musicUserToken, // Use Music User Token
          "Content-Type": "application/json",
        },
      },
    );

    const playlist = createPlaylistResponse.data.data[0];
    await AccountModelService.addAppleMusicQuickAddPlaylistId(
      authHandle,
      playlist.id,
    );

    return playlist;
  }

  async _addTrackToPlaylist(
    playlistId,
    trackId,
    musicUserToken,
    developerToken,
  ) {
    log(
      "info",
      `Adding track ${trackId} to playlist: ${playlistId}`,
      this.constructor.name,
    );
    await axios.post(
      `https://api.music.apple.com/v1/me/library/playlists/${playlistId}/tracks`,
      {
        data: [{ id: trackId, type: "songs" }],
      },
      {
        headers: {
          Authorization: `Bearer ${developerToken}`, // Use Developer Token
          "Music-User-Token": musicUserToken, // Use Music User Token
          "Content-Type": "application/json",
        },
      },
    );
  }
}

export default new AppleMusicClient();
