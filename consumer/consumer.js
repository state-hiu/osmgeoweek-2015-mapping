var config = require('./credentials.js');
var Readable = require('kinesis-readable')(config);
var Redis = require('ioredis');
var R = require('ramda');

// Initialize redis
var redis = new Redis();

// Kinesis options
//put latest: false fo testing, it will grab everything from 24 hours ago
//https://github.com/rclark/kinesis-readable
var readable = new Readable({
  latest: false
});

// Hashtag array
//var hashTagArray = ["#hotosm-project-1185", "#MissingMaps", "#RedCross", "#Khayelitsha", "#MapGive" ];

// Hashtag array
var hashTagArray = ["#MapSouthKivu", "#MissingMaps", "#PeaceCorps", "#100mapathons", "#MapGive","#gmu","#HMSGW","#marywash","#colostate","#LahoreMapathon","#KCWU","#BNU","#FCCU",
"#UMT"];

//make lowercase
hashTagArray = R.map(R.toLower, hashTagArray);

console.log('lower case array');
console.log(hashTagArray);

console.log('starting up...');

//each record is a changeset by one user
//each record in kinesis is associated with 1 user, and that record can contains multiple ways
//so you can have multiple records with different changesets, from the same user
readable
.on('data', function (records) {
  //calling parseRecord for each changeset
  parseRecord(records[0].Data.toString());
})
.on('checkpoint', function (sequenceNumber) {
  // TODO Add sequenceNumber to redis
  console.log(sequenceNumber);
})
.on('error', function (error) {
  console.error(error);
});


function parseRecord (record) {
  var obj = JSON.parse(record);
  var pipeline = redis.pipeline();
  var user = obj.metadata.user;
  var elements = obj.elements;
  var changeset_hashtags = obj.metadata;

  //console.log('print out changeset obj: ')
  //console.log(obj)

    var geojsonDiff = {
    'type': 'FeatureCollection',
    'features': [],
    'properties': obj.metadata
  };

  //for each additional hashtag that is being tracked
  for (index = 0; index < hashTagArray.length; index++) {
    
    //console.log(hashTagArray[index]);

    //console.log('printing comment: ')
    //console.log(obj.metadata.comment)

    var hashtagRecords = R.map(R.toLower, getHashtags(obj.metadata.comment));

    if (hashtagRecords.indexOf(hashTagArray[index]) > -1) {

      //console.log('bam!: ')
      //console.log(hashTagArray[index])

      var hashtagElements = obj.elements;

      // Only process ways in the filtered records
      var hashtagWays = R.filter(R.propEq('type', 'way'), hashtagElements);

      //console.log('filtered changesets from: ')
      //console.log(hashTagArray[index])

      //console.log('print out Ways from filtered changeset: ')
      //console.log(hashtagWays)

      if (obj.metadata.num_changes) {
        // Add num_changes to count
        pipeline.zincrby('geoweek:' + hashTagArray[index] + ':changes', obj.metadata.num_changes, user);
        pipeline.zincrby('geoweek:' + hashTagArray[index] + ':changes', obj.metadata.num_changes, 'total');

        processHashtagRecord(hashtagWays,hashTagArray[index],pipeline,user,elements,geojsonDiff);

      }
      
    }
  }

  //for the main hashtag

  // Only process ways
  var ways = R.filter(R.propEq('type', 'way'), elements);

  ways.forEach(function (way) {
    var tags = R.keys(way.tags);
    // Process buildings
    if (R.contains('building', tags)) {
      pipeline.zincrby('geoweek:buildings', 1, user);
      pipeline.zincrby('geoweek:buildings', 1, 'total');
    }

    // Process highways
    if (R.contains('highway', tags)) {
      pipeline.zincrby('geoweek:highways', 1, user);
      pipeline.zincrby('geoweek:highways', 1, 'total');
    }

    // Process waterways
    if (R.contains('waterway', tags)) {
      pipeline.zincrby('geoweek:waterways', 1, user);
      pipeline.zincrby('geoweek:waterways', 1, 'total');
    }
    // Add way to timeline of each user
    // don't need to do this per hashtag
    pipeline.lpush('geoweek:timeline:' + user, JSON.stringify(way));
    pipeline.ltrim('geoweek:timeline:' + user, 1000);

    // Process to geojson
    var geojsonWay = toGeojson(way);
    geojsonDiff.features.push(geojsonWay);
  });

  // Add changeset to global timeline
  pipeline.lpush('geoweek:timeline', JSON.stringify(geojsonDiff));
  pipeline.ltrim('geoweek:timeline', 100);

  // Add num_changes to global count
  pipeline.zincrby('geoweek:changes', obj.metadata.num_changes, user);
  pipeline.zincrby('geoweek:changes', obj.metadata.num_changes, 'total');

  // Execute pipeline
  pipeline.exec(function (err, results) {
    if (err) console.error(err);
  });

  }

function getHashtags (str) {
  if (!str) return [];
  var wordlist = str.split(' ');
  var hashlist = [];
  wordlist.forEach(function (word) {
    if (word.startsWith('#') && !R.contains(word, hashlist)) {
      word = word.trim();
      word = word.replace(/,\s*$/, '');
      hashlist.push(word);
    }
  });
  return hashlist;
}

function processHashtagRecord (ways,hashtag,pipeline,user,elements,geojsonDiff) {
  //looping through each way (for each user)


    insertHashtag = hashtag + ':';
  

  console.log('display insertHashtag: ')
  console.log(insertHashtag)

  ways.forEach(function (way) {
    var tags = R.keys(way.tags);

    // Process buildings
    if (R.contains('building', tags)) {
      pipeline.zincrby('geoweek:' + insertHashtag + 'buildings', 1, user);
      pipeline.zincrby('geoweek:' + insertHashtag + 'buildings', 1, 'total');
    }

    // Process highways
    if (R.contains('highway', tags)) {
      pipeline.zincrby('geoweek:' + insertHashtag + 'highways', 1, user);
      pipeline.zincrby('geoweek:' + insertHashtag + 'highways', 1, 'total');
    }

    // Process waterways
    if (R.contains('waterway', tags)) {
      pipeline.zincrby('geoweek:' + insertHashtag + 'waterways', 1, user);
      pipeline.zincrby('geoweek:' + insertHashtag + 'waterways', 1, 'total');
    }
    // Add way to timeline of each user, is not being used right now
    pipeline.lpush('geoweek:' + insertHashtag + 'timeline:' + user, JSON.stringify(way));
    pipeline.ltrim('geoweek:' + insertHashtag + 'timeline:' + user, 1000);

    // Process to geojson

      //console.log("double check!!!")
      var geojsonWay = toGeojson(way);
      geojsonDiff.features.push(geojsonWay);

  });



    // Add changeset to hashtag timeline
    //console.log("double check!!!222")
    pipeline.lpush('geoweek:' + insertHashtag + 'timeline', JSON.stringify(geojsonDiff));
    pipeline.ltrim('geoweek:' + insertHashtag + 'timeline', 100);


  // Execute pipeline
  pipeline.exec(function (err, results) {
    if (err) console.error(err);
  });
}

function toGeojson (diffEl) {
  var properties = {};
  properties.id = diffEl.id;
  properties.timestamp = diffEl.timestamp;
  properties.changeset = diffEl.changeset;
  properties.user = diffEl.user;
  properties.tags = diffEl.tags;

  var geo = {
    'type': 'Feature',
    'geometry': {
      'type': 'LineString',
      'coordinates': []
    },
    'properties': properties
  };
  if (diffEl.action === 'create' || diffEl.action === 'modify') {
    var nodelist = diffEl.nodes.map(function (node) {
      return [node.lon, node.lat];
    });
    var first = nodelist[0];
    var last = nodelist[nodelist.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) {
      geo.geometry.coordinates = [nodelist];
      geo.geometry.type = 'Polygon';
    } else {
      geo.geometry.coordinates = nodelist;
    }
  }
  return geo;
}
