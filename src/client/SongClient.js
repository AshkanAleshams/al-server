import ClientService from "./ClientService.js";
import SpotifyService from "../services/SpotifyService.js";
import QueueService from "../services/QueueService.js";
import HistoryModelService from "../services/db/HistoryModelService.js";
import SongController from "../controllers/SongController.js";
import RequestModelService from "../services/db/RequestModelService.js";
import AccountModelService from "../services/db/AccountModelService.js";
import { log } from "../utils/logger.js";

class SongClient extends ClientService {
  async getSongHistory(req, res) {
    let page = parseInt(req.params.page);
    if (isNaN(page) || page < 1) {
      page = 1;
    }

    log("info", `Fetching song history page: ${page}`, this.constructor.name);
    const songHistory =
      await HistoryModelService.fetchMostRecentlyPlayedTracks(page);
    const isLastPage = await HistoryModelService.isLastPage(page);
    const numberOfPages = await HistoryModelService.countNumberOfPages();

    // Do not send the current song in the history
    const currentTrackId = SongController.currentSongMetadata?.trackId;
    if (
      page === 1 &&
      songHistory.length &&
      songHistory[0].trackId === currentTrackId
    ) {
      songHistory.shift();
    }

    const clientifiedHistory = songHistory.map((song) =>
      this._clientifyMetadata(song),
    );
    const response = {
      tracks: clientifiedHistory,
      isLastPage,
      numberOfPages,
    };
    res.json(response);
  }

  async _handleSearchQuerySubmit(req, res, query) {
    log("info", `Searching for track: ${query}`, this.constructor.name);
    try {
      let tracks = await SpotifyService.searchTrack(query);
      if (!tracks.length) {
        log("info", `Track not found: ${query}`, this.constructor.name);
        res.json({ success: false, message: "Song not found" });
        return;
      }

      tracks = tracks.map((track) => this._clientifyMetadata(track));
      res.json({ success: true, tracks });
    } catch (error) {
      log(
        "error",
        `Error searching for track: ${error.message}`,
        this.constructor.name,
      );
      res.status(500).json({ message: "Internal server error" });
    }
  }

  async _handleDirectTrackSubmit(req, res, trackId, userSubmittedId) {
    log("info", `Submitting track: ${trackId}`, this.constructor.name);
    const track = await SpotifyService.getTrackData(trackId);
    if (!track?.trackId) {
      log("info", `Track not found: ${trackId}`, this.constructor.name);
      res.json({ success: false, message: "Song not found" });
      return;
    }

    if (await this._isTrackIdQueued(trackId)) {
      log("info", `Track already in queue: ${trackId}`, this.constructor.name);
      res.json({ success: false, message: "Song is already in the queue." });
      return;
    }

    if (await HistoryModelService.isTrackPlayedInLastHours(trackId)) {
      log(
        "info",
        `Track played too recently: ${trackId}`,
        this.constructor.name,
      );
      res.json({
        success: false,
        message: "Song has been played too recently.",
      });
      return;
    }

    await QueueService.addToUserQueue(trackId, userSubmittedId);
    const queueLength = (await QueueService.getQueueSize()) - 1;
    res.json({ success: true, queueLength });
  }

  async _isTrackIdQueued(trackId) {
    return (
      (await QueueService.userQueueHasTrack(trackId)) ||
      QueueService.audioQueueHasTrack(trackId) ||
      SongController.isTrackIdPlayingOrDownloading(trackId)
    );
  }

  async submitSongRequest(req, res) {
    const authHandle = this.authenticateStrict(req, res);
    if (!authHandle) {
      return;
    }
    log(
      "info",
      `User ${authHandle} is submitting a song`,
      this.constructor.name,
    );

    const query = req.body.query;
    if (!query) {
      log(
        "info",
        `User ${authHandle} submitted an invalid query`,
        this.constructor.name,
      );
      return res
        .status(400)
        .json({ message: 'Invalid Request. Expected 1 parameter "query".' });
    }

    if (
      !(await AccountModelService.userHasPermission(
        authHandle,
        "noRateLimit",
      )) &&
      (await RequestModelService.isUserRateLimited(authHandle))
    ) {
      res.json({
        success: false,
        message: "Maximum requests reached. Try again later.",
      });
      log("info", `User ${authHandle} is rate limited`, this.constructor.name);
      return;
    }

    if (req.body.query.length > 256 || req.body.query.trim().length === 0) {
      res.json({ success: false, message: "Song not found" });
      log(
        "info",
        `User ${authHandle} submitted an invalid query`,
        this.constructor.name,
      );
      return;
    }

    if (await QueueService.isUserQueueFull()) {
      res.json({ success: false, message: "The queue is full." });
      log("info", `User submission queue is full`, this.constructor.name);
      return;
    }

    let trackId;
    if (query.includes("spotify.com/track/")) {
      trackId = query.split("/").pop();
    } else if (/^[a-zA-Z0-9]{22}$/.test(query)) {
      trackId = query;
    }

    if (trackId) {
      return this._handleDirectTrackSubmit(req, res, trackId, authHandle);
    } else {
      return this._handleSearchQuerySubmit(req, res, query);
    }
  }
}

export default new SongClient();
