/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const createHttpExternalSegment = require('./http-external')
const createDbSegment = require('./database')
const createServerSegment = require('./server')
const createProducerSegment = require('./producer')
const createInternalSegment = require('./internal')

module.exports = {
  createDbSegment,
  createHttpExternalSegment,
  createInternalSegment,
  createProducerSegment,
  createServerSegment
}
