// importing packages
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

// configuring packages
dotenv.config();
const app = express();
app.use(cors());

// defining the port from environment variables
const port = process.env.PORT;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
