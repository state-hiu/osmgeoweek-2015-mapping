var express = require('express');
var app = express();
var server = require('http').Server(app);
// var io = require('socket.io')(server);
var path = require('path');
var Redis = require('ioredis');
var compress = require('compression');
var cors = require('cors');

var redis = new Redis();
server.listen(8080);

app.use(cors());
app.use(compress());
app.use(express.static(path.join(__dirname, 'static')));


// respond with "Hello World!" on the homepage
app.get('/hello', function (req, res) {
  res.send('Hello World!');
});


// Buildings per hashtag route
  app.get('/buildings/:hashtag/', function (req, res) {
    redis.zrevrange('geoweek:#' + req.params.hashtag + ':buildings', 0, 10, 'WITHSCORES').then(function (result) {
      res.send(result);
    });
  });

// Waterways per hashtag route
  app.get('/waterways/:hashtag/', function (req, res) {
    redis.zrevrange('geoweek:#' + req.params.hashtag + ':waterways', 0, 10, 'WITHSCORES').then(function (result) {
      res.send(result);
    });
  });

  // Highways per hashtag route
  app.get('/highways/:hashtag/', function (req, res) {
    redis.zrevrange('geoweek:#' + req.params.hashtag + ':highways', 0, 10, 'WITHSCORES').then(function (result) {
      res.send(result);
    });
  });

  // Changes per hashtag route
  app.get('/changes/:hashtag/', function (req, res) {
    redis.zrevrange('geoweek:#' + req.params.hashtag + ':changes', 0, 10, 'WITHSCORES').then(function (result) {
      res.send(result);
    });
  });



//Main routes for OSM GeoWeek, all #osmgeoweek tags

// Buildings route
app.get('/buildings', function (req, res) {
  redis.zrevrange('geoweek:buildings', 0, 10, 'WITHSCORES').then(function (result) {
    res.send(result);
  });
});

// Waterways route
app.get('/waterways', function (req, res) {
  redis.zrevrange('geoweek:waterways', 0, 10, 'WITHSCORES').then(function (result) {
    res.send(result);
  });
});

// Highways route
app.get('/highways', function (req, res) {
  redis.zrevrange('geoweek:highways', 0, 10, 'WITHSCORES').then(function (result) {
    res.send(result);
  });
});

// Changes route
app.get('/changes', function (req, res) {
  redis.zrevrange('geoweek:changes', 0, 10, 'WITHSCORES').then(function (result) {
    res.send(result);
  });
});

// Timeline route, used the geojson diffs to populate the map
app.get('/timeline', function (req, res) {
  redis.lrange('geoweek:timeline', 0, 1000).then(function (result) {
    res.send(result);
  });
});

//Individual user timelines
app.get('/user/:user', function (req, res, next) {
  //var user = req.params.user;
  redis.lrange('geoweek:timeline:' + req.params.user, 0, 1000).then(function (result) {
    res.send(result);
  });
});
