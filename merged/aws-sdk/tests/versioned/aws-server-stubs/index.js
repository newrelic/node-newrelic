/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const createEmptyResponseServer = require('./empty-response-server')
const createResponseServer = require('./response-server')

// Specific values are unimportant because we'll be hitting our
// custom servers. But they need to be populated.
const FAKE_CREDENTIALS = {
  accessKeyId: 'FAKE ID',
  secretAccessKey: 'FAKE KEY'
}

module.exports = {
  createEmptyResponseServer,
  createResponseServer,
  FAKE_CREDENTIALS
}
