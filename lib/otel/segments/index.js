/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const createHttpExternalSegment = require('./http-external')
const createDbSegment = require('./database')
const createServerSegment = require('./server')
const createProducerSegment = require('./producer')

module.exports = {
  createDbSegment,
  createHttpExternalSegment,
  createProducerSegment,
  createServerSegment
}
