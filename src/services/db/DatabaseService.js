import mongoose from "mongoose";
import { log } from "../../utils/logger.js";

class DatabaseService {
  constructor() {
    this._mongoUri = process.env.MONGO_URI;
    this._dbName = process.env.ENVIRONMENT === "prod" ? "ALsDB" : "ALsDB-stage";
  }

  async initialize() {
    await this._connectWithMongoose();
  }

  async _connectWithMongoose() {
    try {
      await mongoose.connect(this._mongoUri, {
        dbName: this._dbName,
      });
      log(
        "info",
        `Mongoose connected to ${this._dbName}`,
        this.constructor.name,
      );
    } catch (error) {
      log(
        "error",
        "Error connecting to MongoDB with Mongoose:",
        error,
        this.constructor.name,
      );
    }
  }
}

export default new DatabaseService();
