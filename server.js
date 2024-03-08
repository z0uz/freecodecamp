require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const expect = require('chai');
const socket = require('socket.io');
const helmet = require('helmet');
const nocache = require("nocache");
const compression  = require('compression');
const cors  = require('cors');

const fccTestingRoutes = require('./routes/fcctesting.js');
const runner = require('./test-runner.js');

const app = express();

app.use(cors());

app.use(compression())// compress all responses before server sends them to make site faster

app.use('/public', express.static(process.cwd() + '/public'));
app.use('/assets', express.static(process.cwd() + '/assets'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Cybersecurity
app.use(helmet.noSniff());
app.use(helmet.xssFilter());
app.use(nocache());
app.use(helmet.hidePoweredBy( {setTo: 'PHP 7.4.3'} ));

// Index page (static HTML)
app.route('/')
  .get(function (req, res) {
    res.sendFile(process.cwd() + '/views/index.html');
  }); 

//For FCC testing purposes
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

// Socket.io setup:
const Player = require('./public/Player');
const Collectible = require('./public/Collectible');
const {dimension} = require('./public/dimension');

const random = (min, max) => {
      return Math.floor(Math.random() * (max - min + 1)) + min;
}

const getRandomPosition = () => {
  let x = random(dimension.minX+50, dimension.maxX-50);
  let y = random(dimension.minY+50, dimension.maxY-50);
  x = Math.floor(x/10) * 10;
  y = Math.floor(y/10) * 10;

  return [x,y];
}

let playersList = [];
let [beerX,beerY] = getRandomPosition();
let beer = new Collectible({x:beerX,y:beerY,value:1, id:Date.now()})
let [bouncerX,bouncerY] = getRandomPosition();
let bouncer = new Player({x:bouncerX,y:bouncerY,value:1, id:Date.now()});
let connections = [];


const io = socket(server);
io.sockets.on('connection', socket => {
  console.log(`New connection ${socket.id}`);
  connections.push(socket);
  console.log('Connected: %s sockets connected.',connections.length);

  let [positionX,positionY] = getRandomPosition();
  let player = new Player({x:positionX,y:positionY,score:0,id:socket.id});

  playersList.push(player)

  socket.emit('init', {id: socket.id, players: playersList, beer: beer, bouncer:bouncer});

  socket.on('update', (updatedUser) => {
      playersList.forEach(user => {
          if(user.id === socket.id){
              user.x = updatedUser.x;
              user.y = updatedUser.y;
              user.score = updatedUser.score;
              user.radius = updatedUser.radius;
          }
      });
      io.emit('update', {players: playersList,bouncer:bouncer,beer:beer,player: null});
  });

  socket.on('disconnect', () => {
    console.log(`deconnection ${socket.id}`);
    socket.broadcast.emit('remove-player', socket.id);
    connections.splice(connections.indexOf(socket), 1);
    playersList = playersList.filter(player => player.id !== socket.id);
    console.log('Disconnected: %s sockets connected.', connections.length);
  });
  
});

var interval = setInterval(draw, 1000/50); 
let vx = 2;
let vy = 2;
function draw() {
    // move the bouncer
    if(bouncer.x+ bouncer.radius > dimension.maxX) vx = -vx;
    if(bouncer.y+ bouncer.radius > dimension.maxY) vy = -vy;
    if(bouncer.x-bouncer.radius <= dimension.minX) vx = -vx;
    if(bouncer.y-bouncer.radius <= dimension.minY) vy = -vy;
    bouncer.x += vx;
    bouncer.y += vy;
    let playerUpdate = null

    playersList.forEach(player => {
      if(bouncer.collision(player)) {
        let [positionX,positionY] = getRandomPosition();
        player.x = positionX;
        player.y = positionY;
        player.score -= 20;
        playerUpdate = player;
        if (player.score <= -60) {
          io.emit("lost", player.id, interval);
        }

      }
      let p = new Player(player);
      if (p.collision(beer)) {
        player.score += 10;
        let [beerX,beerY] = getRandomPosition();
        beer = new Collectible({x:beerX,y:beerY,value:1, id:Date.now()})
        playerUpdate = player;
        if (player.score >= 30) {
          io.emit("won", player.id, interval);
        }

      }
    });


    io.emit('update', {
      players: playersList,
      bouncer:bouncer,
      beer: beer,
      player: playerUpdate
    });


}


module.exports = app; // For testing
