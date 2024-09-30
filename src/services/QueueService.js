import RequestModelService from "./db/RequestModelService.js";
import { log } from "../utils/logger.js";
import EventService from "./EventService.js";
class QueueService {
  constructor() {
    // Format: [{trackId: "trackId1", userSubmittedId: null}, ...]
    this._autoSuggestionQueue = [];
    // Format: [{path: "path/to/audio/file", metadata: {trackid: '...', userSubmittedId: 'greg'}}, ...]
    this._audioQueue = [];
    this._numSongsToPreload = 2;
  }

  async addToUserQueue(trackId, userSubmittedId) {
    await RequestModelService.addRequest(trackId, userSubmittedId);
    this._autoSuggestionQueue = [];
  }

  addToSuggestionQueue(trackId) {
    if (this._autoSuggestionQueue.length < 5) {
      this._autoSuggestionQueue.push({ trackId, userSubmittedId: null });
      log(
        "info",
        `Added trackId ${trackId} to suggestion queue`,
        this.constructor.name,
      );
      return true;
    }
    return false;
  }

  async popNextTrack() {
    if (!(await RequestModelService.hasRequestedTracks())) {
      if (this._autoSuggestionQueue.length === 0) {
        return {};
      }
      return this._autoSuggestionQueue.shift();
    }
    return RequestModelService.getNextUserRequest();
  }

  addToAudioQueue(audioFile) {
    this._audioQueue.push(audioFile);
    EventService.emit("songQueued");
    log(
      "info",
      `Added audio file ${audioFile.metadata.title} - ${audioFile.metadata.artist} to audio queue`,
      this.constructor.name,
    );
  }

  popNextAudioFile() {
    const file = this._audioQueue.shift();
    if (this.audioQueueNeedsFilling()) {
      EventService.emit("audioQueueNeedsFilling");
    }
    return file;
  }

  audioQueueNeedsFilling() {
    return this._audioQueue.length < this._numSongsToPreload;
  }

  isAudioQueueEmpty() {
    return this._audioQueue.length === 0;
  }

  getLastQueuedSongMetadata() {
    return this._audioQueue[this._audioQueue.length - 1]?.metadata;
  }

  getNextQueuedSongMetadata() {
    return this._audioQueue[0]?.metadata;
  }

  async isUserQueueFull() {
    return RequestModelService.isQueueFull();
  }

  async userQueueHasTrack(trackId) {
    return RequestModelService.isTrackRequested(trackId);
  }

  async getQueueSize() {
    return (await RequestModelService.getQueueSize()) + this._audioQueue.length;
  }

  audioQueueHasTrack(trackId) {
    return this._audioQueue.some(
      (audioFile) => audioFile.metadata.trackId === trackId,
    );
  }

  getSuggestionQueue() {
    return this._autoSuggestionQueue;
  }

  async getUserQueue() {
    return RequestModelService.fetchLastRequestedTracks();
  }

  getAudioQueue() {
    return this._audioQueue;
  }

  async editUserQueue(newQueue) {
    await RequestModelService.updateRequestQueue(newQueue);
  }

  editSuggestionQueue(newQueue) {
    this._autoSuggestionQueue = newQueue;
  }

  editAudioQueue(newQueue) {
    this._audioQueue = newQueue;
  }

  async markSongAsFailed(trackId, requestId) {
    await RequestModelService.markRequestAsFailed(requestId);
  }
}

export default new QueueService();
