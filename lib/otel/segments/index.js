/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const createConsumerSegment = require('./consumer')
const createDbSegment = require('./database')
const createHttpExternalSegment = require('./http-external')
const createProducerSegment = require('./producer')
const createServerSegment = require('./server')
const createInternalSegment = require('./internal')

module.exports = {
  createConsumerSegment,
  createDbSegment,
  createHttpExternalSegment,
  createInternalSegment,
  createProducerSegment,
  createServerSegment
}
