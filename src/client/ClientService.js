import jwt from "jsonwebtoken";
import { log } from "../utils/logger.js";
import { getContext } from "../utils/asyncLocalStorage.js";

class ClientService {
  authenticateStrict(req, res) {
    log("info", "Authenticating client strictly", this.constructor.name);
    const token = req.cookies?.token;
    if (!token) {
      log("info", "No token found", this.constructor.name);
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      log(
        "info",
        `Client authenticated: ${decoded.handle}`,
        this.constructor.name,
      );
      return decoded.handle;
    } catch (err) {
      log("info", "Token invalid", this.constructor.name);
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
  }

  authenticateLoose(req) {
    log("info", "Authenticating client loosely", this.constructor.name);
    const token = req.cookies?.token;
    if (!token) return null;

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      log(
        "info",
        `Client authenticated: ${decoded.handle}`,
        this.constructor.name,
      );
      return decoded.handle;
    } catch (err) {
      return null;
    }
  }

  _clientifyMetadata(metadata) {
    return {
      trackId: metadata?.trackId,
      title: metadata?.title,
      artist: metadata?.artist,
      album: metadata?.album,
      urlForPlatform: metadata?.urlForPlatform,
      artUrl: metadata?.artUrl,
      userSubmittedId: metadata?.userSubmittedId,
      likes: metadata?.likes,
      datePlayed: metadata?.datePlayed,
    };
  }

  async _getRequestTaskId() {
    const context = await getContext();
    return context.taskId;
  }
}

export default ClientService;
