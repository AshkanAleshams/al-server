import Request from "../../models/Request.js";
import History from "../../models/History.js";
import { log } from "../../utils/logger.js";

class RequestModelService {
  async initialize() {
    await Request.updateMany(
      { playStatus: "pending" },
      { playStatus: "requested" },
    );
  }

  async addRequest(trackId, userSubmittedId) {
    log(
      "info",
      `Adding request to user queue: ${trackId} ${userSubmittedId}`,
      this.constructor.name,
    );
    return Request.create({ trackId, userSubmittedId });
  }

  async fetchRecentlyRequestedTracks(hours) {
    log(
      "info",
      `Fetching requests from the last ${hours} hours`,
      this.constructor.name,
    );
    const cutoff = new Date(Date.now() - hours * 3600 * 1000);
    return Request.find({ dateRequested: { $gte: cutoff } }).exec();
  }

  async fetchLastRequestedTracks(limit = 10) {
    log(
      "info",
      `Fetching last ${limit} requested tracks`,
      this.constructor.name,
    );
    return Request.find({ playStatus: "requested" })
      .sort({ dateRequested: -1 })
      .limit(limit)
      .exec();
  }

  async fetchLastNRequestedTracksByUser(userSubmittedId, limit = 10, page = 1) {
    log(
      "info",
      `Fetching last ${limit} requested tracks from user ${userSubmittedId}`,
      this.constructor.name,
    );
    const skip = (page - 1) * limit;
    return Request.find({ userSubmittedId })
      .sort({ dateRequested: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  async markRequestAsPlayed(requestId) {
    log(
      "info",
      `Marking request as played: ${requestId}`,
      this.constructor.name,
    );
    const request = await Request.findById(requestId);
    if (request) {
      request.playStatus = "played";
      const historyEntry = await History.create({
        trackId: request.trackId,
        userSubmittedId: request.userSubmittedId,
      });
      request.historyEntryId = historyEntry._id;
      await request.save();
    }
  }

  async getNextUserRequest() {
    log("info", "Getting next user request", this.constructor.name);
    const request = await Request.findOne({
      playStatus: "requested",
    })
      .sort({ dateRequested: 1 })
      .exec();
    if (request) {
      request.playStatus = "pending";
      await request.save();
      return {
        trackId: request.trackId,
        userSubmittedId: request.userSubmittedId,
        requestId: request._id,
      };
    }
  }

  async isQueueFull() {
    const result =
      (await Request.countDocuments({ playStatus: "requested" })) >= 30;
    log("info", `Queue is full: ${result}`, this.constructor.name);
    return result;
  }

  async isTrackRequested(trackId) {
    const result = await Request.exists({
      trackId,
      playStatus: { $in: ["requested", "pending"] },
    });
    log("info", `Is track already requested: ${result}`, this.constructor.name);
    return result;
  }

  async hasRequestedTracks() {
    const result = await Request.exists({ playStatus: "requested" });
    log("info", `Has requested tracks: ${result}`, this.constructor.name);
    return result;
  }

  async updateRequestQueue(newQueue) {
    await Request.deleteMany({ playStatus: { $in: ["requested", "pending"] } });
    await Request.insertMany(newQueue);
  }

  async isUserRateLimited(userSubmittedId) {
    const cutoff = new Date(Date.now() - 3600 * 1000);
    const result =
      (await Request.countDocuments({
        userSubmittedId,
        dateRequested: { $gte: cutoff },
      })) >= 3;
    log("info", `User rate limited: ${result}`, this.constructor.name);
    return result;
  }

  async markRequestAsFailed(requestId) {
    log(
      "info",
      `Marking request as failed: ${requestId}`,
      this.constructor.name,
    );
    const request = await Request.findById(requestId);
    if (request) {
      request.playStatus = "failed";
      await request.save();
    }
  }

  async getQueueSize() {
    log("info", "Getting queue size", this.constructor.name);
    return Request.countDocuments({ playStatus: "requested" });
  }
}

export default new RequestModelService();
