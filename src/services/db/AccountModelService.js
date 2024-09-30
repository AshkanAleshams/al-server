import Account from "../../models/Account.js";
import bcrypt from "bcrypt";
import ClientManager from "../../client/ClientManager.js";
import { log } from "../../utils/logger.js";
import EventService from "../EventService.js";

const PERMISSION_MAP = {
  noRateLimit: ["admin"],
};

class AccountModelService {
  async initialize() {
    EventService.onWithServerContext("songEnded", () =>
      this._incrementListenersPlayCount(),
    );
    await this._forceAllUsersOffline();
  }

  async getUserProfile(handle) {
    log(
      "info",
      `Fetching private profile for ${handle}`,
      this.constructor.name,
    );
    return Account.findOne(
      { handle },
      {
        ALThoughts: 1,
        avatarUrl: 1,
        bio: 1,
        createdDate: 1,
        favouriteSong: 1,
        friends: 1,
        handle: 1,
        isOnline: 1,
        lastOnline: 1,
        location: 1,
        numberOfSongsListened: 1,
        role: 1,

        appleMusicIsConnected: 1,
        lastFMUsername: 1,
        spotifyUserId: 1,
        spotifyDisplayName: 1,

        customizationPreferences: 1,
        email: 1,
        isEmailVerified: 1,
      },
    )
      .lean()
      .exec();
  }

  async getPublicUserProfile(handle) {
    log(
      "info",
      `Fetching public user profile for ${handle}`,
      this.constructor.name,
    );
    return Account.findOne(
      { handle },
      {
        ALThoughts: 1,
        avatarUrl: 1,
        bio: 1,
        createdDate: 1,
        favouriteSong: 1,
        friends: 1,
        handle: 1,
        isOnline: 1,
        lastOnline: 1,
        location: 1,
        numberOfSongsListened: 1,
        role: 1,

        appleMusicIsConnected: 1,
        lastFMUsername: 1,
        spotifyUserId: 1,
        spotifyDisplayName: 1,
      },
    )
      .lean()
      .exec();
  }

  async isEmailTaken(email) {
    const result = await Account.exists({ email });
    log(
      "info",
      `Checking if email ${email} is taken: ${result}`,
      this.constructor.name,
    );
  }

  async isHandleTaken(handle) {
    const result = await Account.exists({ handle });
    log(
      "info",
      `Checking if handle ${handle} is taken: ${result}`,
      this.constructor.name,
    );
  }

  async isAdmin(handle) {
    const user = await Account.findOne({ handle }, { role: 1 }).exec();
    const result = user.role === "admin";
    log(
      "info",
      `Checking if ${handle} is an admin: ${result}`,
      this.constructor.name,
    );
    return result;
  }

  async authorizeUser(handle, password) {
    log("info", `Authorizing user ${handle}`, this.constructor.name);
    const user = await Account.findOne({ handle }).exec();
    if (!user) {
      return false;
    }
    return bcrypt.compare(password, user.passwordHash);
  }

  async updateUserProfile(handle, updateData) {
    log("info", `Updating profile for ${handle}`, this.constructor.name);
    return Account.updateOne({ handle }, { $set: updateData }).exec();
  }

  async addUserProfile(profileData) {
    log(
      "info",
      `Creating new user profile for ${profileData.handle}`,
      this.constructor.name,
    );
    const newAccount = new Account(profileData);
    return newAccount.save();
  }

  async updateUserAvatar(handle, avatarUrl) {
    log("info", `Updating avatar for ${handle}`, this.constructor.name);
    return Account.updateOne({ handle }, { $set: { avatarUrl } }).exec();
  }

  async updateUserOnlineStatus(handle, isOnline) {
    log(
      "info",
      `Updating online status for ${handle}. Online: ${isOnline}`,
      this.constructor.name,
    );
    if (isOnline) {
      return Account.updateOne({ handle }, { $set: { isOnline } }).exec();
    } else {
      return Account.updateOne(
        { handle },
        { $set: { isOnline, lastOnline: new Date() } },
      ).exec();
    }
  }

  async updateCustomizationPreferences(handle, preferences) {
    log(
      "info",
      `Updating customization preferences for ${handle}`,
      this.constructor.name,
    );
    return Account.updateOne(
      { handle },
      { $set: { customizationPreferences: preferences } },
    ).exec();
  }

  async _incrementListenersPlayCount() {
    for (const handle of ClientManager._listeners.keys()) {
      log(
        "info",
        `Incrementing play count for ${handle}`,
        this.constructor.name,
      );
      await Account.updateOne(
        { handle },
        { $inc: { numberOfSongsListened: 1 } },
      ).exec();
    }
  }

  async _forceAllUsersOffline() {
    log("info", "Forcing all users offline", this.constructor.name);
    Account.updateMany(
      { isOnline: true },
      { $set: { isOnline: false } },
      { $set: { lastOnline: new Date() } },
    ).exec();
  }

  async userHasPermission(handle, permission) {
    const user = await Account.findOne({ handle }, { role: 1 }).exec();
    const result = PERMISSION_MAP[permission].includes(user.role);
    log(
      "info",
      `Checking if ${handle} has permission ${permission}: ${result}`,
      this.constructor.name,
    );
    return result;
  }

  // LastFM
  async addLastFMToken(handle, token) {
    log("info", `Adding LastFM token for ${handle}`, this.constructor.name);
    return Account.updateOne(
      { handle },
      { $set: { lastFMToken: token } },
    ).exec();
  }

  async addLastFMUsername(handle, username) {
    log("info", `Adding LastFM username for ${handle}`, this.constructor.name);
    return Account.updateOne(
      { handle },
      { $set: { lastFMUsername: username } },
    ).exec();
  }

  async getLastFMUsername(handle) {
    log(
      "info",
      `Fetching LastFM username for ${handle}`,
      this.constructor.name,
    );
    const user = await Account.findOne(
      { handle },
      { lastFMUsername: 1 },
    ).exec();
    return user || {};
  }

  async getLastFMToken(handle) {
    log("info", `Fetching LastFM token for ${handle}`, this.constructor.name);
    const user = await Account.findOne({ handle }, { lastFMToken: 1 }).exec();
    return user || {};
  }

  // Spotify
  async addSpotifyTokens(handle, token, refreshToken) {
    log("info", `Adding Spotify tokens for ${handle}`, this.constructor.name);
    return Account.updateOne(
      { handle },
      {
        $set: {
          spotifyAccessToken: token,
          spotifyRefreshToken: refreshToken,
        },
      },
    ).exec();
  }

  async addSpotifyUserId(handle, userId) {
    log("info", `Adding Spotify user ID for ${handle}`, this.constructor.name);
    return Account.updateOne(
      { handle },
      { $set: { spotifyUserId: userId } },
    ).exec();
  }

  async addSpotifyDisplayName(handle, displayName) {
    log(
      "info",
      `Adding Spotify display name for ${handle}`,
      this.constructor.name,
    );
    return Account.updateOne(
      { handle },
      { $set: { spotifyDisplayName: displayName } },
    ).exec();
  }

  async addSpotifyQuickAddPlaylistId(handle, playlistId) {
    log(
      "info",
      `Adding Spotify quick add playlist ID for ${handle}`,
      this.constructor.name,
    );
    return Account.updateOne(
      { handle },
      { $set: { spotifyQuickAddPlaylistId: playlistId } },
    ).exec();
  }

  async getSpotifyTokens(handle) {
    log("info", `Fetching Spotify tokens for ${handle}`, this.constructor.name);
    const user = await Account.findOne(
      { handle },
      {
        spotifyAccessToken: 1,
        spotifyRefreshToken: 1,
      },
    ).exec();
    return {
      accessToken: user?.spotifyAccessToken,
      refreshToken: user?.spotifyRefreshToken,
    };
  }

  async getSpotifyUserId(handle) {
    log(
      "info",
      `Fetching Spotify user ID for ${handle}`,
      this.constructor.name,
    );
    const user = await Account.findOne({ handle }, { spotifyUserId: 1 }).exec();
    return user || {};
  }

  async getSpotifyQuickAddPlaylistId(handle) {
    log(
      "info",
      `Fetching Spotify quick add playlist ID for ${handle}`,
      this.constructor.name,
    );
    const user = await Account.findOne(
      { handle },
      { spotifyQuickAddPlaylistId: 1 },
    ).exec();
    return user || {};
  }

  // Apple Music
  async addAppleMusicTokens(handle, token) {
    log(
      "info",
      `Adding Apple Music tokens for ${handle}`,
      this.constructor.name,
    );
    return Account.updateOne(
      { handle },
      {
        $set: {
          appleMusicToken: token,
          appleMusicIsConnected: token ? true : false,
        },
      },
    ).exec();
  }

  async addAppleMusicQuickAddPlaylistId(handle, playlistId) {
    log(
      "info",
      `Adding Apple Music playlist ID for ${handle}`,
      this.constructor.name,
    );
    return Account.updateOne(
      { handle },
      { $set: { appleMusicQuickAddPlaylistId: playlistId } },
    ).exec();
  }

  async getAppleMusicTokens(handle) {
    log(
      "info",
      `Fetching Apple Music tokens for ${handle}`,
      this.constructor.name,
    );
    const user = await Account.findOne(
      { handle },
      { appleMusicToken: 1 },
    ).exec();
    return user || {};
  }

  async getAppleMusicQuickAddPlaylistId(handle) {
    log(
      "info",
      `Fetching Apple Music playlist ID for ${handle}`,
      this.constructor.name,
    );
    const user = await Account.findOne(
      { handle },
      { appleMusicQuickAddPlaylistId: 1 },
    ).exec();
    return user || {};
  }
}

export default new AccountModelService();
