// routes/api.js
const express = require("express");
const authMiddleware = require("../auth/middleware");
const mailRouter = require("./mail/index");
const gmailRouter = require("./gmail/index");
const aiRouter = require("./ai/index");

// Create a new router instance
const apiRouter = express.Router();

// Apply the authentication middleware to all routes in this router
apiRouter.use(authMiddleware);

// Correctly place the express.json() middleware here, before the routes are mounted.
// This ensures that all incoming request bodies are parsed before they reach the routers below.
// apiRouter.use(express.json());

// Mount the mail and gmail routers
apiRouter.use("/mail", mailRouter);
apiRouter.use("/gmail", gmailRouter);
apiRouter.use("/ai", aiRouter);

// Export the router to be used in index.js
module.exports = apiRouter;
