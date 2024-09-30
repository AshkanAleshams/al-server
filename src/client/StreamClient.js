import SongController from "../controllers/SongController.js";
import EventService from "../services/EventService.js";
import QueueService from "../services/QueueService.js";
import { log } from "../utils/logger.js";
import ClientManager from "./ClientManager.js";
import ClientService from "./ClientService.js";

class StreamClient extends ClientService {
  getOrGenerateStreamId(req, res) {
    log("info", "Generating stream ID", this.constructor.name);
    if (!req.cookies["anonymous-stream-id"]) {
      const streamId = `anonymous-listener-${Math.random().toString(36)}`;
      res.cookie("anonymous-stream-id", streamId, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.ENVIRONMENT === "prod",
      });
      return streamId;
    }
    return req.cookies["anonymous-stream-id"];
  }

  async addClientToStream(req, res) {
    let handle =
      this.authenticateLoose(req) || this.getOrGenerateStreamId(req, res);

    res.writeHead(200, {
      "Content-Type": "audio/mpeg",
      Connection: "keep-alive",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "Surrogate-Control": "no-store",
    });

    res.handle = handle;
    log("info", `Adding client to stream: ${handle}`, this.constructor.name);
    ClientManager.addClient(res);
  }

  async getLiveDataStream(req, res) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const sendCurrentSongData = () => {
      const currentSongMetadata = this._clientifyMetadata(
        SongController.currentSongMetadata,
      );
      res.write("event: currentSongData\n");
      res.write(`data: ${JSON.stringify(currentSongMetadata)}\n\n`);
    };

    const sendNextSongData = () => {
      const nextSongMetadata = this._clientifyMetadata(
        QueueService.getNextQueuedSongMetadata(),
      );
      res.write("event: nextSongData\n");
      res.write(`data: ${JSON.stringify(nextSongMetadata)}\n\n`);
    };

    const sendListenersData = () => {
      const listeners = Array.from(ClientManager._listeners.keys());
      const loggedInListeners = listeners.filter(
        (listener) => !listener.startsWith("anonymous-listener"),
      );
      const anonListeners = listeners.filter((listener) =>
        listener.startsWith("anonymous-listener"),
      );

      const listenerData = {
        count: {
          total: listeners.length,
          loggedIn: loggedInListeners.length,
          anonymous: anonListeners.length,
        },
        list: loggedInListeners,
      };
      res.write("event: listenersData\n");
      res.write(`data: ${JSON.stringify(listenerData)}\n\n`);
    };

    // Initial data
    sendCurrentSongData();
    sendNextSongData();
    sendListenersData();

    // Event listeners
    const songEndedListener = async () => {
      sendCurrentSongData();
      sendNextSongData();
    };

    const songStartedListener = () => {
      sendCurrentSongData();
      sendNextSongData();
    };

    const songQueuedListener = () => {
      sendNextSongData();
    };

    const listeningStatusListener = () => {
      sendListenersData();
    };

    EventService.onWithClientContext("songEnded", songEndedListener);
    EventService.onWithClientContext("songStarted", songStartedListener);
    EventService.onWithClientContext("songQueued", songQueuedListener);
    EventService.onWithClientContext(
      "clientConnected",
      listeningStatusListener,
    );
    EventService.onWithClientContext(
      "clientDisconnected",
      listeningStatusListener,
    );

    req.on("close", () => {
      EventService.removeListener("songEnded", songEndedListener);
      EventService.removeListener("songStarted", songStartedListener);
      EventService.removeListener("songQueued", songQueuedListener);
      EventService.removeListener("clientConnected", listeningStatusListener);
      EventService.removeListener(
        "clientDisconnected",
        listeningStatusListener,
      );
      res.end();
    });
  }
}

export default new StreamClient();
