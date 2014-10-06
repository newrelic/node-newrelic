'use strict'

var path      = require('path')
  , architect = require('architect')
  , logger    = require('./logger')
  

var services = path.join(__dirname, 'services.js')

module.exports = function bootstrap(next) {
  logger.debug("Awakening the architect.")

  var config = architect.loadConfig(services)
  architect.createApp(config, function (error, app) {
    if (error) {
      logger.debug('The architect was unable to awaken! Abandoning hope.')

      app.destroy()
      return next(error)
    }
    else {
      logger.debug("The architect is in control.")
      return next()
    }
  })
}
