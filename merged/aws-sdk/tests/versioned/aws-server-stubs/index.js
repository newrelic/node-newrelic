/*
* Copyright 2020 New Relic Corporation. All rights reserved.
* SPDX-License-Identifier: Apache-2.0
*/
'use strict'

const createSqsServer = require('./sqs-server')
const createEmptyResponseServer = require('./empty-response-server')

// Specific values are unimportant because we'll be hitting our
// custom servers. But they need to be populated.
const FAKE_CREDENTIALS = {
  accessKeyId: 'FAKE ID',
  secretAccessKey: 'FAKE KEY'
}

module.exports = {
  createSqsServer,
  createEmptyResponseServer,
  FAKE_CREDENTIALS
}
