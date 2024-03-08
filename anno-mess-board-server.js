require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const nocache = require("nocache");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");

const apiRoutes = require("./routes/api.js");
const fccTestingRoutes = require("./routes/fcctesting.js");
const runner = require("./test-runner");

const app = express();

// security
// comment out, restart sandbox, and refresh browser to see live version of app (for FCC testing)
////////////////////////////////////////////////
// app.use(
//   helmet({
//     referrerPolicy: { policy: "same-origin" },
//     hidePoweredBy: true,
//     xssFilter: true,
//     noSniff: true,
//     directives: { defaultSrc: ["'self'"] },
//     frameguard: { action: "sameorigin" },
//     dnsPrefetchControl: { allow: false }
//   })
// );

// app.use(nocache());
////////////////////////////////////////////////

// DB
mongoose
  .connect(process.env["DB"], {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000
  })
  .catch((err) => {
    console.error(err);
  });

const db = mongoose.connection;

db.once("open", (err, res) => {
  console.log("Connected to DB...");
  if (process.env["NODE_ENV"] === "test") {
    console.log("Running Tests...");
    setTimeout(function () {
      try {
        runner.run();
      } catch (e) {
        var error = e;
        console.log("Tests are not valid:");
        console.log(error);
      }
    }, 1500);
  }
});

process.on("SIGINT", () => {
  db.close(() => {
    console.log("Closing connection to database");
    process.exit(0);
  });
});

app.use("/public", express.static(process.cwd() + "/public"));

app.use(cors({ origin: "*" })); //For FCC testing purposes only

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//Sample front-end
app.route("/b/:board/").get(function (req, res) {
  res.sendFile(process.cwd() + "/views/board.html");
});
app.route("/b/:board/:threadid").get(function (req, res) {
  res.sendFile(process.cwd() + "/views/thread.html");
});

//Index page (static HTML)
app.route("/").get(function (req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

//For FCC testing purposes
fccTestingRoutes(app);

//Routing for API
apiRoutes(app);

//404 Not Found Middleware
app.use(function (req, res, next) {
  res.status(404).type("text").send("Not Found");
});

//Start our server and tests!
app.listen(process.env["PORT"] || 3000, function () {
  console.log("Listening on port " + process.env["PORT"]);
});

module.exports = app; //for testing
