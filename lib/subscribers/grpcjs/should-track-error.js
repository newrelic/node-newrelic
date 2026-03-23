/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = function shouldTrackError(statusCode, config) {
  return statusCode > 0 &&
    config.grpc.record_errors === true &&
    config.grpc.ignore_status_codes.includes(statusCode) === false
}
