/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const createConsumerSegment = require('./consumer.js')
const createDbSegment = require('./database.js')
const createHttpExternalSegment = require('./http-external.js')
const createInternalSegment = require('./internal.js')
const createProducerSegment = require('./producer.js')
const createServerSegment = require('./server.js')

module.exports = {
  createConsumerSegment,
  createDbSegment,
  createHttpExternalSegment,
  createInternalSegment,
  createProducerSegment,
  createServerSegment
}
