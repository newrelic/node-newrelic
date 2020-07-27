'use strict'

const createSqsServer = require('./sqs-server')
const createDynamoDbServer = require('./dynamodb-server')

module.exports = {
  createSqsServer,
  createDynamoDbServer
}
