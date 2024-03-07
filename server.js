require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const fccTestingRoutes = require('./routes/fcctesting.js');
const runner = require('./test-runner.js');

const app = express();

// Replaces bodyParser with express built-in middleware as bodyParser is deprecated
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Helmet configs for security headers
app.use(helmet.xssFilter());
app.use(helmet.noSniff());
app.use(helmet.noCache());
app.use((req, res, next) => {
  res.setHeader("X-Powered-By", "PHP 7.4.3");
  next();
});

app.use('/public', express.static(process.cwd() + '/public'));
app.use('/assets', express.static(process.cwd() + '/assets'));

// For FCC testing purposes and enables user to connect from outside the hosting platform
app.use(cors({origin: '*'}));

// Index page (static HTML)
app.route('/')
  .get(function (req, res) {
    res.sendFile(process.cwd() + '/views/index.html');
  });

// For FCC testing purposes
fccTestingRoutes(app);

// 404 Not Found Middleware
app.use(function(req, res, next) {
  res.status(404)
    .type('text')
    .send('Not Found');
});

const portNum = process.env.PORT || 3000;

// Set up server and tests
const server = app.listen(portNum, () => {
  console.log(`Listening on port ${portNum}`);
  if (process.env.NODE_ENV==='test') {
    console.log('Running Tests...');
    setTimeout(function () {
      try {
        runner.run();
      } catch (error) {
        console.log('Tests are not valid:');
        console.error(error);
      }
    }, 1500);
  }
});

// Socket.io setup for real-time communication
const socket = require('socket.io');
const io = socket(server);

let gameState = {
  players: [],
  collectible: getNewCollectable()
}

function getNewCollectable() {
  const randX = Math.floor(Math.random() * 420 + 20);
  const randY = Math.floor(Math.random() * 440 + 20);
  const randId = Math.floor(Math.random() * 999999999);
  return {x: randX, y: randY, value: 1, id: randId};
}

io.on('connection', client => {
  client.emit('init', "YOU ARE CONNECTED!");

  client.on('updatePlayer', playerObj => {
    // Update or add the player in one step, checking for presence more efficiently
    const playerIndex = gameState.players.findIndex(player => player.playerObj.id === playerObj.playerObj.id);

    if (playerIndex !== -1) {
      gameState.players[playerIndex] = playerObj;
    } else {
      gameState.players.push(playerObj);
    }

    io.emit('updatedGameState', gameState);
  });

  client.on('refresh-collectible', (boolean) => {
    if (boolean) {
      gameState.collectible = getNewCollectable();
      io.emit('updatedGameState', gameState);
    }
  });

  client.on('disconnect', () => {
    gameState.players = gameState.players.filter(player => player.playerObj.id !== client.id);
    io.emit('updatedGameState', gameState);
  });
});

module.exports = app; // For testing
