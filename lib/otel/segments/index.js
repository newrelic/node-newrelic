/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const HttpExternalSegment = require('./http-external')
const DatabaseSegment = require('./database')
const ServerSegment = require('./server')

module.exports = {
  DatabaseSegment,
  HttpExternalSegment,
  ServerSegment
}
