import AccountModelService from "../services/db/AccountModelService.js";
import LastFMClient from "./auth_services/LastFMClient.js";
import SongController from "../controllers/SongController.js";
import { log } from "../utils/logger.js";
import EventService from "../services/EventService.js";

class ClientManager {
  constructor() {
    this._clients = new Set();
    this._listeners = new Map();
  }

  initialize() {
    log("info", "Initializing Client Manager", this.constructor.name);
    EventService.onWithClientContext("songStarted", (metadata) =>
      this.changeCurrentSongForClients(metadata),
    );
  }

  async addClient(res) {
    log("info", `Adding client: ${res.handle}`, this.constructor.name);
    if (res) {
      this._clients.add(res);
      res.on("close", () => {
        this.removeClient(res);
      });
    }

    const timeout = setTimeout(async () => {
      await LastFMClient.scrobbleTrackForUser(
        res.handle,
        SongController.currentSongMetadata,
      );
    }, 30000);

    clearTimeout(this._listeners.get(res.handle)?.timeout);
    this._listeners.set(res.handle, { timeout });
    await AccountModelService.updateUserOnlineStatus(res.handle, true);
    EventService.emit("clientConnected");
  }

  async removeClient(res) {
    log("info", `Removing client: ${res.handle}`, this.constructor.name);
    res.removeAllListeners("close");
    this._clients.delete(res);
    clearTimeout(this._listeners.get(res.handle)?.timeout);
    this._listeners.delete(res.handle);
    await AccountModelService.updateUserOnlineStatus(res.handle, false);
    EventService.emit("clientDisconnected");
  }

  changeCurrentSongForClients(metadata) {
    log("info", "Changing current song for clients", this.constructor.name);
    for (const handle of this._listeners.keys()) {
      const listener = this._listeners.get(handle);
      clearTimeout(listener.timeout);
      if (!metadata?.trackId) continue;

      listener.timeout = setTimeout(async () => {
        await LastFMClient.scrobbleTrackForUser(handle, metadata);
      }, 30000);
    }
  }

  getResFromHandle(handle) {
    return Array.from(this._clients).find((res) => res.handle === handle);
  }

  async changeClientHandle(oldHandle, newHandle) {
    log(
      "info",
      `Changing client handle from ${oldHandle} to ${newHandle}`,
      this.constructor.name,
    );
    const res = this.getResFromHandle(oldHandle);
    if (res) {
      await this.removeClient(res);
      res.handle = newHandle;
      await this.addClient(res);
    }
  }

  hasActiveClients() {
    const result = this._clients.size > 0;
    log(
      "info",
      `Checking if there are active clients: ${result}`,
      this.constructor.name,
    );
    return result;
  }
}

export default new ClientManager();
