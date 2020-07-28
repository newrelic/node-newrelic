'use strict'

const createSqsServer = require('./sqs-server')
const createEmptyResponseServer = require('./empty-response-server')

module.exports = {
  createSqsServer,
  createEmptyResponseServer
}
