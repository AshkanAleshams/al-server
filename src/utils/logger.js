import log4js from "log4js";
import { getContext } from "./asyncLocalStorage.js";
import { nanoid } from "nanoid";
import chalk from "chalk";
import crypto from "crypto";

const levelColors = {
  error: chalk.red,
  info: chalk.gray,
  warn: chalk.yellow,
  default: chalk.white,
};

const getColorForText = (text) => {
  const hash = crypto.createHash("sha256").update(text).digest("hex");
  return chalk.hex(`#${hash.slice(0, 6)}`);
};

log4js.configure({
  appenders: {
    out: {
      type: "stdout",
      layout: {
        type: "pattern",
        pattern: "%m",
      },
    },
  },
  categories: {
    default: { appenders: ["out"], level: "info" },
  },
});

const logger = log4js.getLogger();

const buildColoredLog = ({
  taskType,
  taskId,
  category,
  previousTaskId,
  requestMethod,
  requestUrl,
  args,
  allowlist,
}) => {
  const taskTypeColored =
    allowlist.taskType && taskType
      ? getColorForText(taskType)(`[${taskType}]`)
      : "";
  const taskIdColored =
    allowlist.taskId && taskId ? getColorForText(taskId)(`[${taskId}]`) : "";
  const categoryColored =
    allowlist.category && category
      ? getColorForText(category)(`[${category}]`)
      : "";
  const prevTaskIdColored =
    allowlist.category && category === "EVENT" && previousTaskId
      ? getColorForText(previousTaskId)(`[${previousTaskId}]`)
      : "";
  const requestMethodColored =
    allowlist.category && category === "REQUEST" && requestMethod
      ? getColorForText(requestMethod)(`[${requestMethod}]`)
      : "";
  const requestUrlColored =
    allowlist.category && category === "REQUEST" && requestUrl
      ? getColorForText(requestUrl)(`[${requestUrl}]`)
      : "";

  const argsColored = args
    .filter((arg) => arg !== taskId)
    .map((arg) => getColorForText(arg)(`[${arg}]`))
    .join(" ");

  return {
    taskTypeColored,
    taskIdColored,
    categoryColored,
    prevTaskIdColored,
    requestMethodColored,
    requestUrlColored,
    argsColored,
  };
};

const logCore = (level, message, allowlist, ...args) => {
  const {
    taskType = "",
    taskId = "",
    category = "",
    previousTaskId = "",
    requestMethod = "",
    requestUrl = "",
  } = getContext();

  const levelColor = levelColors[level] || levelColors.default;

  const {
    taskTypeColored,
    taskIdColored,
    categoryColored,
    prevTaskIdColored,
    requestMethodColored,
    requestUrlColored,
    argsColored,
  } = buildColoredLog({
    taskType,
    taskId,
    category,
    previousTaskId,
    requestMethod,
    requestUrl,
    args,
    allowlist,
  });

  const logMessage = [
    levelColor(`[${level.toUpperCase()}]`),
    taskTypeColored,
    taskIdColored,
    prevTaskIdColored,
    categoryColored,
    requestMethodColored,
    requestUrlColored,
    argsColored,
    chalk.grey(message),
  ]
    .filter(Boolean)
    .join(" ");

  logger[level](logMessage);
};

const log = (level, message, ...args) => {
  const allowlist = { taskType: true, taskId: true };
  logCore(level, message, allowlist, ...args);
};

const logFullContext = (level, message, ...args) => {
  const allowlist = {
    taskType: true,
    taskId: true,
    category: true,
  };
  logCore(level, message, allowlist, ...args);
};

const generateTaskId = () => nanoid(8);
export { log, logFullContext, generateTaskId };
