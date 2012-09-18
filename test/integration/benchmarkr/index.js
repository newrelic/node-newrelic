'use strict';

var path       = require('path')
  , app        = require('express')()
  , connect    = require('connect')
  , mongodb    = require('mongodb')
  , bootstrap  = require(path.join(__dirname, 'bootstrap'))
  , logger     = require(path.join(__dirname, 'logger'))
  , Collection = mongodb.Collection
  , DB         = mongodb.Db
  , Server     = mongodb.Server
  ;

app.use(connect.logger('dev'));

bootstrap(function (error) {
  if (error) return logger.error(error);

  logger.info('External servers started.');

  // MongoDB setup
  var server = new Server('127.0.0.1', 27017);
  var db     = new DB('everything-bot', server);

  db.open(function (error, client) {
    if (error) return logger.error(error);

    // preseed state
    var things = new Collection(client, 'things');
    things.insert({stuff : "doin' it", position : 1337});

    app.get('/test', function (req, res) {
      var cursor = things.find({position : 1337});
      cursor.nextObject(function (error, document) {
        if (error) return logger.error(error);

        res.send(document);
      });
    });

    app.listen(8765);
  });
});
