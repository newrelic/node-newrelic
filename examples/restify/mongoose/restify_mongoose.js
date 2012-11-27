'use strict';

require('newrelic');

var path      = require('path')
  , architect = require('architect')
  , restify   = require('restify')
  , logger    = require('../../../lib/logger').child({component : 'restify_mongoose'})
  ;

function bootstrapRestify(Model) {
  var server = restify.createServer();

  server.use(restify.bodyParser());
  server.on('after', restify.auditLogger({log : logger}));

  server.post('/test', function (request, response, next) {
    var entity = new Model(request.params);

    entity.save(function (error) {
      if (error) {
        response.send(500, {success : false, error : error});
        return next(error);
      }

      response.send({success : true, id : entity.id});
      return next();
    });
  });

  server.get('/test/:id', function (request, response, next) {
    Model.find({"_id" : request.params.id}, function (error, entities) {
      if (error) {
        response.send(500, {success : false, error   : error});
        return next(error);
      }

      if (!entities || entities.length < 1) {
        response.send(404, {success : false, error   : 'not_found'});
        return next();
      }

      if (entities.length > 1) {
        // https://github.com/joho/7XX-rfc
        response.send(712, {success : false, error   : 'wat'});
        return next();
      }

      response.send(entities[0]);
      return next();
    });
  });

  server.get('/test/entity/:id', function (request, response, next) {
    Model.find({"entity" : request.params.id}, function (error, entities) {
      if (error) {
        response.send(500, {success : false, error   : error});
        return next(error);
      }

      if (!entities || entities.length < 1) {
        response.send(404, {success : false, error   : 'not_found'});
        return next();
      }

      response.send(entities);
      return next();
    });
  });

  server.get('/test/value/:id', function (request, response, next) {
    Model.find({"value" : request.params.id}, function (error, entities) {
      if (error) {
        response.send(500, {success : false, error   : error});
        return next(error);
      }

      if (!entities || entities.length < 1) {
        response.send(404, {success : false, error   : 'not_found'});
        return next();
      }

      response.send(entities);
      return next();
    });
  });

  server.listen(8088, 'localhost', function () {
    console.info("Restify + Mongoose server up and ready for connections.");
    logger.info("Restify + Mongoose server up and ready for connections.");
  });
}

var configPath = path.join(__dirname, 'architecture', 'mongoose-bootstrapped.js');
architect.createApp(architect.loadConfig(configPath), function (error, app) {
  if (error) return console.error(error);

  var dal    = app.getService('mongooseDAL')
    , db     = dal.db
    , Schema = dal.mongoose.Schema
    ;

  var schema = new Schema({
    entity    : String,
    attribute : String,
    value     : String
  });

  var TestEAV = db.model('test_eav', schema);

  var sundowner = function (exitCode) {
    var mongod = app.getService('mongodbProcess');
    mongod.shutdown(function () {
      process.exit(exitCode);
    });
  };

  process.on('SIGINT', function () {
    console.error("erk!");
    sundowner(0);
  });

  bootstrapRestify(TestEAV);
});
