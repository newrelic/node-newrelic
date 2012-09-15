'use strict';

var path      = require('path')
  , architect = require('architect')
  , logger    = require(path.join(__dirname, 'logger'))
  ;

var services = path.join(__dirname, 'services.js');

module.exports = function bootstrap(next) {
  logger.debug("Awakening the architect.");

  var config = architect.loadConfig(services);
  architect.createApp(config, function (error, app) {
    if (error) return next(error);

    logger.info("External services started.");
    return next();
  });
};
