/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

function record(segment, scope, transaction) {
  const duration = segment.getDurationInMillis()
  const exclusive = segment.getExclusiveDurationInMillis(transaction.trace)

  if (scope) {
    transaction.measure(segment.name, scope, duration, exclusive)
  }

  transaction.measure(segment.name, null, duration, exclusive)
}

module.exports = record
