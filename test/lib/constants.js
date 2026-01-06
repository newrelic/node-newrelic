/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// used to centralize all the indices in use for redis libraries
// the values should not overlap as there may be conflict when running concurrent versioned tests
// built-in index values of 0-15 are supported
const REDIS_INDICES = {
  REDIS: {
    INDEX: 2,
    SELECTED_INDEX: 3
  },
  IOREDIS: {
    INDEX: 4,
    SELECTED_INDEX: 5
  },
  IOREDIS_ESM: {
    INDEX: 6,
    SELECTED_INDEX: 7
  },
  IOVALKEY: {
    INDEX: 8,
    SELECTED_INDEX: 9
  }
}

module.exports = {
  REDIS_INDICES
}
