'use strict'

var Logger = require('bunyan')

// logger setup
module.exports = new Logger({name: 'everything-bot', level : 'trace'})
