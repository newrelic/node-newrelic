/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const subscribers = {
  ...require('./subscribers/elasticsearch/config'),
  ...require('./subscribers/ioredis/config'),
  ...require('./subscribers/pino/config'),
  ...require('./subscribers/mcp-sdk/config'),
}

module.exports = subscribers
