import { EventEmitter } from 'events';

class QueueService extends EventEmitter {
  constructor() {
    super();
    // Format: ["trackId1", "trackId2", ...]
    this._userQueue = [];
    // Format: ["trackId1", "trackId2", ...]
    this._suggestionQueue = [];
    // Format: [{path: "path/to/audio/file", metadata: {}}]
    this._audioQueue = [];
    this._numSongsToPreload = 5;
  }

  async addToUserQueue(trackId) {
    this._userQueue.push(trackId);
    this._suggestionQueue = [];
    console.log('Added trackId', trackId, 'to user queue');
  }

  addToSuggestionQueue(trackId) {
    if (this._suggestionQueue.length < 5) {
      this._suggestionQueue.push(trackId);
      console.log('Added trackId', trackId, 'to suggestion queue');
      return true;
    }
    return false;
  }

  popNextTrack() {
    return this._userQueue.length ? this._userQueue.shift() : this._suggestionQueue.shift();
  }

  addToAudioQueue(audioFile) {
    this._audioQueue.push(audioFile);
    this.emit('songQueued');
    console.log('Added audio file', audioFile.metadata?.title, ' - ', audioFile.metadata?.artist, 'to audio queue');
  }

  popNextAudioFile() {
    const file = this._audioQueue.shift();
    if (this.audioQueueNeedsFilling()) {
      console.log('Audio queue needs filling');
      this.emit('audioQueueNeedsFilling');
    }
    return file;
  }

  audioQueueNeedsFilling() {
    return this._audioQueue.length < this._numSongsToPreload;
  }

  isAudioQueueEmpty() {
    return this._audioQueue.length === 0;
  }

  getNextSongMetadata() {
    return this._audioQueue[this._audioQueue.length - 1]?.metadata;
  }

  isUserQueueFull() {
    return this._userQueue.length >= 100;
  }

  userQueueHasTrack(trackId) {
    return this._userQueue.includes(trackId);
  }

  audioQueueHasTrack(trackId) {
    return this._audioQueue.some(audioFile => audioFile.metadata.trackId === trackId);
  }
}

export default new QueueService();
