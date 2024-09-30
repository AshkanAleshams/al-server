import axios from "axios";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { log } from "../utils/logger.js";

class OpenAiService {
  constructor() {
    this._baseUrl = "https://api.openai.com/v1";
    this._apiKey = process.env.OPENAI_API_KEY;
    this._systemPrompt = `
    Your name is Al. You are a radio host at Al Radio, a Toronto-based radio station.
    Your task is to introduce the current song as a radio announcer.

    If there's a previous song, provide a transition between the two. Either,
    a quick one, or a more detailed one contrasting them or connecting them.

    Important Requirements:
    1. Ensure each introduction is only a few sentences long.
    2. Be conversational. You're talking to a listener, not reading a script.
    This includes using modern slang, contractions, making mistakes, and being casual.
    3. Do not say "shift gears", "spoiler", "let's dive in", "without further ado",
    "let's get started", "let's jump right in", or anything similar to these.
    4. Ensure you state who the songs were suggested by. If there is none, do not mention it.
    `;
  }

  _generateSystemPrompt() {
    const jokeFormats = [
      `Why did {artist / fans of artist} {action}? To {ironic/genrephobic/anti-joke action related to the song data).
    For example: Why did Rage against the machine fans buy all their albums? To prove they're anti-consumerist.`,
      `What do you get when you cross {artist} with {another artist}? {something that makes fun of the fanbase}.
    For example: What do you get when you cross The Smiths and Neutral Milk Hotel? Declining birth rate.`,
      `How does a {artist} fan {action}? {something that makes fun of the fanbase}.
    For example: How does a Radiohead fan get home after a night out? They call their girlfriend.`,
    ];
    const jokePrefix =
      "Add a joke relating to the song data. Do not introduce the joke, just say it. Ensure it adheres to the following format: ";

    return Math.random() < 0.25
      ? `${this._systemPrompt}\n\n${jokePrefix + jokeFormats[Math.floor(Math.random() * jokeFormats.length)]}`
      : this._systemPrompt + " Do not add jokes.";
  }

  _getTodaysDateAndTimeEST() {
    const date = new Date();
    date.setHours(date.getHours() - 4);
    return date.toLocaleString("en-US", { timeZone: "America/New_York" });
  }

  _generateUserPrompt(thisSongMetadata, previousSongMetadata) {
    const currentSongPrompt = `
    Current song:
    - Title: ${thisSongMetadata.title}
    - Artist: ${thisSongMetadata.artist}
    - Album: ${thisSongMetadata.album}
    - Genres: ${thisSongMetadata.genres.join(", ")}
    - Release date: ${thisSongMetadata.releaseDate}
    - Suggested by: ${thisSongMetadata.userSubmittedId}`;

    const previousSongPrompt = previousSongMetadata.title
      ? `
    Previous song:
    - Title: ${previousSongMetadata.title}
    - Artist: ${previousSongMetadata.artist}
    - Album: ${previousSongMetadata.album}
    - Genres: ${previousSongMetadata.genres.join(", ")}
    - Release date: ${previousSongMetadata.releaseDate}
    - Suggested by: ${previousSongMetadata.userSubmittedId}`
      : "";

    return `${currentSongPrompt}\n\n${previousSongPrompt}`;
  }

  async generateSongIntro(thisSongMetadata, previousSongMetadata) {
    log("info", "Generating song intro", this.constructor.name);
    if (!thisSongMetadata.title) {
      throw new Error("Missing song metadata");
    }

    try {
      const systemPrompt = this._generateSystemPrompt();
      const userPrompt = this._generateUserPrompt(
        thisSongMetadata,
        previousSongMetadata,
      );
      const response = await axios.post(
        `${this._baseUrl}/chat/completions`,
        {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          model: "gpt-4o-mini",
          n: 1,
          max_tokens: 200,
          frequency_penalty: 1.0,
          presence_penalty: 1.0,
        },
        {
          headers: {
            Authorization: `Bearer ${this._apiKey}`,
          },
        },
      );
      const songIntro = response.data.choices[0].message.content;

      log("info", `Generated song intro: ${songIntro}`, this.constructor.name);
      return songIntro;
    } catch (error) {
      throw new Error("Failed to generate song intro:", error);
    }
  }

  async textToSpeech(text) {
    log("info", `Converting text to speech: ${text}`, this.constructor.name);
    try {
      const response = await axios.post(
        `${this._baseUrl}/audio/speech`,
        {
          input: text,
          model: "tts-1",
          voice: "nova",
        },
        {
          headers: {
            Authorization: `Bearer ${this._apiKey}`,
          },
          responseType: "arraybuffer",
        },
      );
      const date = new Date().getTime();
      const tempAudioPath = `./audio/${date}_temp.mp3`;
      const audioPath = `./audio/${date}.mp3`;
      fs.writeFileSync(tempAudioPath, response.data);

      try {
        const command = `ffmpeg -i "${tempAudioPath}" -filter:a "volume=3.0" "${audioPath}"`;
        const execAsync = promisify(exec);
        await execAsync(command);
      } catch (error) {
        log(
          "error",
          `Failed to adjust audio volume: ${error}`,
          this.constructor.name,
        );
      }

      fs.unlinkSync(tempAudioPath);

      return audioPath;
    } catch (error) {
      throw new Error("Failed to convert text to speech:", error);
    }
  }
}

export default new OpenAiService();
