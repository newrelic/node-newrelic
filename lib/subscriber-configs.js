/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// The expected export of these files is:
// 'package-name': [ { path: 'subscriberPath', instrumentations: [] }, ... ]
const subscribers = {
  ...require('./subscribers/elasticsearch/config'),
  ...require('./subscribers/ioredis/config'),
  ...require('./subscribers/mcp-sdk/config'),
  ...require('./subscribers/pino/config'),
}

module.exports = subscribers
