'use strict';

require('newrelic');

var path      = require('path')
  , http      = require('http')
  , architect = require('architect')
  , express   = require('express')
  , logger    = require('../../../lib/logger').child({component : 'express_sequelize'})
  ;

function bootstrapExpress(Model) {
  var app = express();

  app.use(express.logger('dev'));
  app.use(express.bodyParser());

  app.post('/test', function (request, response) {
    Model.create(request.body).success(function (model) {
      response.send({
        success : true,
        id : model.id
      });
    }).error(function (error) {
      response.send({
        success : false,
        reason  : error
      }, 500);
    });
  });

  app.get('/test/:id', function (request, response) {
    // smh Sequelize explodes if you pass a string to the finder
    var id = parseInt(request.params.id, 10);
    Model.find(id).success(function (model) {
      if (!model) return response.send({
        success : false,
        reason : 'not_found'
      }, 404);

      response.send(model);
    }).error(function (error) {
      response.send({
        success : false,
        reason  : error
      }, 500);
    });
  });

  var server = http.createServer(app);
  server.listen(8088, 'localhost', function () {
    console.info("Express + Sequelize server up and ready for connections.");
    logger.info("Express + Sequelize server up and ready for connections.");
  });
}

var configPath = path.join(__dirname, 'architecture', 'sequelize-bootstrapped.js');
architect.createApp(architect.loadConfig(configPath), function (error, app) {
  if (error) return console.error(error);

  var dal = app.getService('sequelizeDAL')
    , sequelize = dal.sequelize
    , Sequelize = dal.Sequelize
    ;

  var TestEAV = sequelize.define('test_eav', {
    // everyone's favorite relational antipattern
    entity    : {type : Sequelize.STRING, allowNull : false},
    attribute : {type : Sequelize.STRING, allowNull : false},
    value     : {type : Sequelize.TEXT,   allowNull : false}
  });

  var sundowner = function (exitCode) {
    var mysqld = app.getService('mysqldProcess');
    mysqld.shutdown(function () {
      process.exit(exitCode);
    });
  };

  process.on('SIGINT', function () {
    sundowner(0);
  });

  TestEAV.sync().success(function () {
    bootstrapExpress(TestEAV);
  }).error(function (error) {
    console.error(error);
    console.error("Welp, that didn\'t work. Bailing out!");
    sundowner(-1);
  });
});
