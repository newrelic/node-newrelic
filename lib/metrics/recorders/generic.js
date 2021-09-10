/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

function record(segment, scope) {
  const duration = segment.getDurationInMillis()
  const exclusive = segment.getExclusiveDurationInMillis()
  const transaction = segment.transaction

  if (scope) {
    transaction.measure(segment.name, scope, duration, exclusive)
  }

  transaction.measure(segment.name, null, duration, exclusive)
}

module.exports = record
