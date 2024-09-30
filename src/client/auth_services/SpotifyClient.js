import axios from "axios";
import AccountModelService from "../../services/db/AccountModelService.js";
import ClientService from "../ClientService.js";
import { log } from "../../utils/logger.js";

class SpotifyClient extends ClientService {
  constructor() {
    super();
    this._client_id = process.env.SPOTIFY_CLIENT_ID;
    this._client_secret = process.env.SPOTIFY_CLIENT_SECRET;
    this._client_url = process.env.CLIENT_URL;
    this._api_base_url = process.env.API_BASE_URL;
  }

  async authorize(req, res) {
    const authHandle = this.authenticateStrict(req, res);
    if (!authHandle) {
      return;
    }

    const code = req.query.code;
    if (!code) {
      return res.status(400).json({ message: "No code provided" });
    }

    try {
      const { accessToken, refreshToken } =
        await this._fetchSpotifyTokens(code);
      await AccountModelService.addSpotifyTokens(
        authHandle,
        accessToken,
        refreshToken,
      );

      const { spotifyId, spotifyDisplayName } =
        await this._fetchSpotifyProfile(accessToken);
      await AccountModelService.addSpotifyUserId(authHandle, spotifyId);
      await AccountModelService.addSpotifyDisplayName(
        authHandle,
        spotifyDisplayName,
      );

      res.redirect(302, `${this._client_url}`);
    } catch (error) {
      log(
        "error",
        `Error authorizing Spotify: ${error.message}`,
        this.constructor.name,
      );
      res.status(500).json({ message: "Error authorizing Spotify" });
    }
  }

  async removeAuthorization(req, res) {
    const authHandle = this.authenticateStrict(req, res);
    if (!authHandle) {
      return;
    }

    try {
      await this._removeTokens(authHandle);

      res.status(200).json({ message: "Spotify authorization removed" });
    } catch (error) {
      log(
        "error",
        "Error removing Spotify authorization",
        this.constructor.name,
      );
      res.status(500).json({ message: "Error removing Spotify authorization" });
    }
  }

  async addSongToPlaylist(req, res) {
    const authHandle = this.authenticateStrict(req, res);
    if (!authHandle) {
      return;
    }

    const { trackId } = req.body;
    if (!trackId) {
      return res.status(400).json({ message: "No trackId provided" });
    }

    try {
      let { accessToken, refreshToken } =
        await AccountModelService.getSpotifyTokens(authHandle);
      accessToken = await this._refreshAccessTokenIfExpired(
        accessToken,
        refreshToken,
        authHandle,
      );

      let alRadioPlaylist = await this._getOrCreatePlaylist(
        accessToken,
        authHandle,
      );

      const trackAlreadyInPlaylist = await this._checkTrackInPlaylist(
        alRadioPlaylist.id,
        trackId,
        accessToken,
      );

      if (trackAlreadyInPlaylist) {
        return res
          .status(200)
          .json({ message: "Track already exists in your playlist." });
      }

      await this._addTrackToPlaylist(alRadioPlaylist.id, trackId, accessToken);

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

  async _fetchSpotifyTokens(code) {
    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${this._api_base_url}/auth/spotify/callback`,
        client_id: this._client_id,
        client_secret: this._client_secret,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
    };
  }

  async _getNewAccessToken(authHandle, refreshToken) {
    try {
      const tokenResponse = await axios.post(
        "https://accounts.spotify.com/api/token",
        new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: this._client_id,
          client_secret: this._client_secret,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );
      const accessToken = tokenResponse.data.access_token;
      await AccountModelService.addSpotifyTokens(
        authHandle,
        accessToken,
        tokenResponse.data.refresh_token || refreshToken,
      );
      return accessToken;
    } catch (error) {
      if (error.response?.status === 400) {
        // access token revoked
        await this._removeTokens(authHandle);
      }
    }
  }

  async _removeTokens(authHandle) {
    await AccountModelService.addSpotifyTokens(authHandle, null, null);
    await AccountModelService.addSpotifyUserId(authHandle, null);
    await AccountModelService.addSpotifyQuickAddPlaylistId(authHandle, null);
  }

  async _refreshAccessTokenIfExpired(accessToken, refreshToken, authHandle) {
    try {
      await axios.get("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return accessToken;
    } catch (error) {
      if (error.response && error.response.status === 401) {
        return await this._getNewAccessToken(authHandle, refreshToken);
      } else if (error.response && error.response.status === 403) {
        await this._removeTokens(authHandle);
        throw new Error("Spotify authorization revoked");
      }
      throw error;
    }
  }

  async _fetchSpotifyProfile(accessToken) {
    const spotifyResponse = await axios.get("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return {
      spotifyId: spotifyResponse.data.id,
      spotifyDisplayName: spotifyResponse.data.display_name,
    };
  }

  async _getOrCreatePlaylist(
    accessToken,
    authHandle,
    playlistName = "AL Radio",
  ) {
    const { spotifyUserId } =
      await AccountModelService.getSpotifyUserId(authHandle);
    const { spotifyQuickAddPlaylistId } =
      await AccountModelService.getSpotifyQuickAddPlaylistId(authHandle);

    if (spotifyQuickAddPlaylistId) {
      try {
        const playlistResponse = await axios.get(
          `https://api.spotify.com/v1/playlists/${spotifyQuickAddPlaylistId}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );

        return playlistResponse.data;
      } catch (error) {
        if (error.response && error.response.status === 404) {
          // the playlist was deleted, make another one
          await AccountModelService.addSpotifyQuickAddPlaylistId(
            authHandle,
            null,
          );
          await this._getOrCreatePlaylist(
            accessToken,
            authHandle,
            playlistName,
          );
        } else {
          throw error;
        }
      }
    }

    const createPlaylistResponse = await axios.post(
      `https://api.spotify.com/v1/users/${spotifyUserId}/playlists`,
      {
        name: playlistName,
        description: "Playlist created by AL Radio",
        public: false,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );
    const playlist = createPlaylistResponse.data;
    await AccountModelService.addSpotifyQuickAddPlaylistId(
      authHandle,
      playlist.id,
    );

    return playlist;
  }

  async _getUserPlaylists(accessToken) {
    const playlistsResponse = await axios.get(
      "https://api.spotify.com/v1/me/playlists",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return playlistsResponse.data.items;
  }

  async _checkTrackInPlaylist(playlistId, trackId, accessToken) {
    const response = await axios.get(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return response.data.items.some((item) => item.track.id === trackId);
  }

  async _addTrackToPlaylist(playlistId, trackId, accessToken) {
    await axios.post(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      {
        uris: [`spotify:track:${trackId}`],
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );
  }
}

export default new SpotifyClient();
