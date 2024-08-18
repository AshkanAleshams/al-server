import DBService from './db.js';
import axios from 'axios';
import QueueService from './queue.js';

class SpotifyService {
  constructor() {
    this.baseUrl = 'https://api.spotify.com/v1';
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    this.clientId = process.env.SPOTIFY_CLIENT_ID;
  }

  async initialize() {
    await this._authenticate();
  }

  async _authenticate() {
    try {
      const response = await axios.post('https://accounts.spotify.com/api/token', null, {
        params: {
          grant_type: 'client_credentials'
        },
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
        }
      });
      this.token = response.data.access_token;
      console.log('Authenticated with Spotify API');
    } catch (error) {
      throw new Error('Failed to authenticate with Spotify API:', error);
    }
  }

  _extractMetadata(track) {
    console.log('Extracting metadata for:', track.name);
    return {
      trackId: track.id,
      title: track.name,
      artist: track.artists[0].name,
      album: track.album.name,
      genres: track.genres,
      releaseDate: track.album.release_date,
      url: track.external_urls.spotify,
      artUrl: track.album.images[0].url
    };
  }

  async _getArtistGenres(artistId) {
    console.log('Getting genres for artist:', artistId);
    try {
      const artistResponse = await axios.get(`${this.baseUrl}/artists/${artistId}`, {
        headers: {
          Authorization: `Bearer ${this.token}`
        }
      });
      return artistResponse.data.genres;
    } catch (error) {
      throw new Error('Failed to get artist genres:', error);
    }
  }

  async searchTrack(query) {
    try {
      const response = await axios.get(`${this.baseUrl}/search`, {
        headers: {
          Authorization: `Bearer ${this.token}`
        },
        params: {
          q: query,
          type: 'track',
          limit: 1
        }
      });
      const metadata = this._extractMetadata(response.data.tracks.items[0]);
      return await this._convertAndSaveSpotifyTrackMetadata(metadata);
    } catch (error) {
      if (error.response?.status === 401) {
        await this._authenticate();
        return this.searchTrack(query);
      }
      throw new Error('Failed to search for track:', error);
    }
  }

  async getRecommendations(trackIds) {
    try {
      const response = await axios.get(`${this.baseUrl}/recommendations`, {
        headers: {
          Authorization: `Bearer ${this.token}`
        },
        params: {
          seed_tracks: trackIds.join(','),
          limit: 15
        }
      });
      const recommendations = response.data.tracks.map(track => track.id);
      return recommendations;
    } catch (error) {
      if (error.response?.status === 401) {
        await this._authenticate();
        return this.getRecommendations(trackIds);
      }
      throw new Error('Failed to get recommendations:', error);
    }
  }

  _cleanOtherPlatformLinks(links) {
    const cleanedLinks = {};

    // key is the platform name (e.g 'deezer') value is the url
    for (const [key, value] of Object.entries(links)) {
      cleanedLinks[key] = value.url;
    }

    return cleanedLinks;
  }

  async _getUrlForAllPlatforms(trackUrl) {
    console.log('Getting other platform links for:', trackUrl);
    try {
      const response = await axios.get(`https://api.song.link/v1-alpha.1/links?url=${trackUrl}`);
      const link = response.data.linksByPlatform;
      return this._cleanOtherPlatformLinks(link);
    } catch (error) {
      throw new Error('Failed to get other platform links:', error);
    }
  }

  async _convertAndSaveSpotifyTrackMetadata(spotifyTrackMetadata) {
    const artistId = spotifyTrackMetadata.artists[0].id;
    const url = spotifyTrackMetadata.external_urls.spotify;

    const genres = await this._getArtistGenres(artistId);
    const urlForPlatform = await this._getUrlForAllPlatforms(url);

    const cleanedTrackMetadata = this._extractMetadata(spotifyTrackMetadata);
    const metadata = {
      ...cleanedTrackMetadata,
      genres,
      urlForPlatform
    };

    await DBService.saveSongMetadata(metadata);
    return metadata;
  }

  async getTrackData(trackId) {
    console.log('Getting track data from spotify for:', trackId);
    try {
      const response = await axios.get(`${this.baseUrl}/tracks/${trackId}`, {
        headers: {
          Authorization: `Bearer ${this.token}`
        }
      });
      return await this._convertAndSaveSpotifyTrackMetadata(response.data);
    } catch (error) {
      if (error.response?.status === 401) {
        await this._authenticate();
        return this.getTrackData(trackId);
      }
      throw new Error('Failed to get track data:', error);
    }
  }

  async populateSuggestionQueue(numberOfSuggestions = 2) {
    // Get recommendations based on last five played
    const lastFiveSongs = await DBService.getLastPlayedSongs(5);
    const lastFiveTrackIds = lastFiveSongs.map(track => track.trackId);
    let suggestions = await this.getRecommendations(lastFiveTrackIds);

    // Do not suggest songs that have been played in the last two hours
    const tooRecentlyPlayed = await DBService.getRecentlyPlayedSongs(2);
    const tooRecentlyTrackIds = tooRecentlyPlayed.map(track => track.trackId);
    suggestions = suggestions.filter(track => !tooRecentlyTrackIds.includes(track));

    // Limit to 5 suggestions
    suggestions = suggestions.slice(0, numberOfSuggestions);
    suggestions.forEach(track => QueueService.addToSuggestionQueue(track));
  }
}

export default new SpotifyService();
