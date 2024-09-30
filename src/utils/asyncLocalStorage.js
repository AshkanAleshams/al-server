import { AsyncLocalStorage } from "async_hooks";

const asyncLocalStorage = new AsyncLocalStorage();
const runWithContext = (context, fn) => {
  // check the previous context. if there is a taskId, log it
  const previousContext = asyncLocalStorage.getStore();
  if (previousContext && previousContext.taskId) {
    context.previousTaskId = previousContext.taskId;
  }
  asyncLocalStorage.run(context, fn);
};
const getContext = () => asyncLocalStorage.getStore() || {};

export { runWithContext, getContext };
