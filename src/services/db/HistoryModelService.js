import History from "../../models/History.js";
import TrackModelService from "./TrackModelService.js";
import { log } from "../../utils/logger.js";

class HistoryModelService {
  async addPlayedTrack(trackId, userSubmittedId = null) {
    log(
      "info",
      `Adding played track to history: ${trackId} for user: ${userSubmittedId}`,
      this.constructor.name,
    );
    return History.create({ trackId, userSubmittedId });
  }

  async fetchRecentlyPlayedTracks(hours) {
    log(
      "info",
      `Fetching history from the last ${hours} hours`,
      this.constructor.name,
    );
    const cutoff = new Date(Date.now() - hours * 3600 * 1000);
    return History.find({ datePlayed: { $gte: cutoff } }).exec();
  }

  async fetchMostRecentlyPlayedTracks(
    page = 1,
    limit = 25,
    userSubmittedId = null,
  ) {
    log(
      "info",
      `Fetching ${limit} tracks from history page ${page}`,
      this.constructor.name,
    );

    const skip = (page - 1) * limit;
    const query = userSubmittedId ? { userSubmittedId } : {};

    const history = await History.find(query)
      .sort({ datePlayed: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    return Promise.all(
      history.map(async (track) => {
        const metadata = await TrackModelService.getSongMetadata(track.trackId);
        return { ...metadata, ...track.toObject() };
      }),
    );
  }

  async isLastPage(page, limit = 25, userSubmittedId = null) {
    const query = userSubmittedId ? { userSubmittedId } : {};
    const totalTracks = await History.countDocuments(query);
    const result = page * limit >= totalTracks;
    log(
      "info",
      `Checking if page ${page} is the last page: ${result}`,
      this.constructor.name,
    );
    return result;
  }

  async countNumberOfPages(limit = 25, userSubmittedId = null) {
    const query = userSubmittedId ? { userSubmittedId } : {};
    const totalTracks = await History.countDocuments(query);
    const result = Math.ceil(totalTracks / limit);
    log("info", `Counting number of pages: ${result}`, this.constructor.name);
    return result;
  }

  async isTrackPlayedInLastHours(trackId, hours = 3) {
    const recentlyPlayed = await this.fetchRecentlyPlayedTracks(hours);
    const result = recentlyPlayed.some((track) => track.trackId === trackId);
    log(
      "info",
      `Checking if track ${trackId} was played in the last ${hours} hours: ${result}`,
      this.constructor.name,
    );
  }
}

export default new HistoryModelService();
