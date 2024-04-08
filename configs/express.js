/*jslint node: true */
// jshint esversion:8

"use strict";

const logger = require("../logger");
// const { HTTP_NOT_FOUND } = require("../utils/http.response.code");
global.H = require("../utils/helper");
logger.info({ msg1: 'Test' })
const express = require("express");
const fileupload = require("express-fileupload");
logger.info({ msg1: 'Test' })
const fs = require("fs");
const cors = require("cors");
const morgan = require("morgan");
logger.info({ msg2: 'Test' })
const PlatformService = require("../services/platform.service");
logger.info({ msg3: 'Test' })
const app = express();
const path = require("path");
logger.info({ msg4: 'Test' })
const config = require("./config");
const database = require("./database");
const route = require(path.resolve("routes", config.version));
const { createStream } = require("rotating-file-stream");
const ApiResponse = require(path.resolve("../utils/http.response"));
const {
    HTTP_OK,
    HTTP_NOT_FOUND,
    HTTP_INTERNAL_SERVER_ERROR,
  } = require("../utils/http.response.code"),
  {
    WELCOME_MESSAGE,
    INTERNAL_SERVER_ERROR,
    ROUTE_NOT_FOUND,
  } = require(path.resolve("../utils/http.response.message"));
console.log({ expressTifo1: app });

logger.debug("Overriding 'Express' logger");
logger.info(`Server running in ${config.env.toUpperCase()} environment`);

const filename = "access.log";
const logDirectory = path.join(__dirname, "../logs");

const accessLogStream = createStream(filename, {
  interval: "7d", // rotate weekly
  compress: "gzip", // compress rotated files
  maxFiles: 20,
  size: "30M",
  maxSize: "30M",
  mode: 0o0640,
  history: "logHistory.txt",
  path: logDirectory,
  teeToStdout: true,
});
let morganLog;
if (config.env.toLowerCase() === "development") {
  morganLog = morgan("combined");
} else {
  morganLog = morgan("combined", {
    stream: accessLogStream,
  });
}
// setup the logger
app.use(morganLog);

const configData = {
  useTempFiles: true,
  tempFileDir: path.join("uploads", "tmp"),
  preserveExtension: true,
  limits: { fileSize: config.max_file_upload },
  debug: true,
  abortOnLimit: true,
  limitHandler: (req, res, next) => {
    fs.readdirSync(path.join("uploads", "tmp")).forEach((file) =>
      fs.unlinkSync(path.join("uploads", "tmp", file))
    );

    const data = {
      message: `Uploaded file must be ${H.getFileSize({
        size: config.max_file_upload,
      })} or below.`,
      code: 413,
    };
    res.status(data.code).json(data);
  },
};
if (config.env.toLowerCase() != "development") delete configData.debug;
// File Upload
app.use(fileupload(configData));

database.connect(config.mongodb_uri);

app.use(express.static(path.resolve(__dirname, "../public")));
app.set("view engine", "ejs");
app.set("views", path.resolve("views"));

app.use(
  express.json({
    limit: "50mb",
  })
);
app.use(
  express.urlencoded({
    limit: "50mb",
    extended: true,
  })
);

app.set("port", config.port);

const corsOption = {
  origin: (origin, callback) => {
    config.env.toLowerCase() == "development"
      ? logger.info(`Cors Request from: ${origin || config.host}`)
      : null;

    if (
      /undefined/.test(origin) ||
      /localhost:\d{1,4}$/.test(origin) ||
      /\.github\.io$/.test(origin)
    ) {
      callback(null, true);
    } else {
      const err = new Error("CORS rejected from origin: " + origin);
      logger.error(err);
      callback(err);
    }
  },
  optionsSuccessStatus: 200,
};

// app.use(cors(corsOption));
app.use(cors());

const apiVersion = config.version;

app.get(`/${apiVersion}`, (req, res, next) => {
  logger.info({ method: req.method, path: req.originalUrl });
  const data = ApiResponse.gen(HTTP_OK, WELCOME_MESSAGE, {
    name: "Vince-Service",
    version: "1.0.0",
  });

  res.status(data.code).json(data);
});

PlatformService.mornitorAutomation();

app.use(`/${apiVersion}`, route);

app.use("*", (req, res, next) => {
  const data = ApiResponse.gen(HTTP_NOT_FOUND, ROUTE_NOT_FOUND);
  res.status(data.code).json(data);

  app.use((err, req, res, next) => {
    logger.error(err);
    res
      .status(HTTP_INTERNAL_SERVER_ERROR)
      .json(
        ApiResponse.gen(
          HTTP_INTERNAL_SERVER_ERROR,
          INTERNAL_SERVER_ERROR,
          err.message
        )
      );
  });
});

console.log({ expressTifo22: app });
module.exports = app;
