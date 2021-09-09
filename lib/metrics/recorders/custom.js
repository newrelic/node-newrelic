/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const NAMES = require('../names')

function record(segment, scope) {
  const duration = segment.getDurationInMillis()
  const exclusive = segment.getExclusiveDurationInMillis()
  const transaction = segment.transaction
  const name = NAMES.CUSTOM + NAMES.ACTION_DELIMITER + segment.name

  if (scope) {
    transaction.measure(name, scope, duration, exclusive)
  }

  transaction.measure(name, null, duration, exclusive)
}

module.exports = record
