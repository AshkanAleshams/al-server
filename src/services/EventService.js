import EventEmitter from "events";
import { runWithContext } from "../utils/asyncLocalStorage.js";
import { generateTaskId, logFullContext } from "../utils/logger.js";

class EventService extends EventEmitter {
  constructor() {
    super();
  }

  onWithClientContext(eventName, listener) {
    const wrappedListener = (...args) => {
      runWithContext(
        {
          taskType: "client-task",
          taskId: generateTaskId(),
          category: "EVENT",
        },
        () => {
          logFullContext("info", "", eventName);
          listener(...args);
        },
      );
    };
    this.on(eventName, wrappedListener);
  }

  onWithServerContext(eventName, listener) {
    const wrappedListener = (...args) => {
      runWithContext(
        {
          taskType: "server-task",
          taskId: generateTaskId(),
          category: "EVENT",
        },
        () => {
          logFullContext("info", "", eventName);
          listener(...args);
        },
      );
    };
    this.on(eventName, wrappedListener);
  }
}

export default new EventService();
