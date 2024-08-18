import SpotifyService from './spotify.js';
import QueueService from './queue.js';
import DBService from './db.js';
import SongController from '../controllers/songController.js';

import path from 'path';
import EventEmitter from 'events';
class ClientService extends EventEmitter {
  // eslint-disable-next-line constructor-super
  constructor() {
    super();
    this.clients = new Set();
  }

  _clientifyMetadata(metadata) {
    return {
      trackId: metadata.trackId,
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      urlForPlatform: metadata.urlForPlatform,
      artUrl: metadata.artUrl
    };
  }

  hasActiveClients() {
    return this.clients.size > 0;
  }

  serveWebpage(req, res) {
    res.sendFile('index.html', { root: path.join(process.cwd(), 'public') });
  }

  addClientToStream(req, res) {
    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      Connection: 'keep-alive',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Surrogate-Control': 'no-store'
    });

    this.clients.add(res);
    console.log('Client connected to stream');
    this.emit('clientConnected');
    res.on('close', () => {
      this.clients.delete(res);
      console.log('Client disconnected from stream');
    });
  }

  async _handleSearchQuerySubmit(req, res, query) {
    const track = await SpotifyService.searchTrack(query);
    if (!track.trackId) {
      res.status(404).json({ message: 'Song not found' });
      return;
    }

    res.json(this._clientifyMetadata(track));
  }

  async _handleDirectTrackSubmit(req, res, trackId) {
    const track = await SpotifyService.getTrackData(trackId);
    if (!track.trackId) {
      res.status(404).json({ message: 'Song not found' });
      return;
    }

    if (this._isTrackIdQueued(trackId)) {
      res.status(400).json({ message: 'Song is already in the queue.' });
      console.log('Song is already in the queue');
      return false;
    }

    if (await DBService.hasSongBeenPlayedRecently(trackId)) {
      res.status(400).json({ message: 'Song has been played too recently.' });
      console.log('Song has been played recently');
      return false;
    }

    await QueueService.addToUserQueue(trackId);
    res.end();
  }

  _isTrackIdQueued(trackId) {
    return (
      QueueService.userQueueHasTrack(trackId) ||
      QueueService.audioQueueHasTrack(trackId) ||
      SongController.isTrackIdPlayingOrDownloading(trackId)
    );
  }

  async submitSongRequest(req, res) {
    if (QueueService.isUserQueueFull()) {
      res.status(400).json({ message: 'The queue is full.' });
      console.log('User queue is full');
      return false;
    }

    const query = req.body.query;
    if (!query) {
      return res.status(400).json({ message: 'Invalid Request. Expected 1 parameter "query".' });
    }

    let trackId;
    if (query.includes('spotify.com/track/')) {
      trackId = query.split('/').pop();
    } else if (/^[a-zA-Z0-9]{22}$/.test(query)) {
      trackId = query;
    }

    // TODO: Need a check for if the song is in the process of downloading.
    if (trackId) {
      return this._handleDirectTrackSubmit(req, res, trackId);
    } else {
      return this._handleSearchQuerySubmit(req, res, query);
    }
  }

  async getCurrentSongMetadata(req, res) {
    const metadata = this._clientifyMetadata(SongController.currentSongMetadata);
    res.json(metadata);
  }

  async getSongHistory(req, res) {
    const songHistory = await DBService.getLastPlayedSongs(10);

    // Do not send the current song in the history
    const currentTrackId = SongController.currentSongMetadata?.trackId;
    if (songHistory.length && songHistory[0].trackId === currentTrackId) {
      songHistory.shift();
    }
    const clientifiedHistory = songHistory.map(song => this._clientifyMetadata(song));
    res.json(clientifiedHistory);
  }
}

export default new ClientService();
