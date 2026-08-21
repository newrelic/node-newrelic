/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// instrumentations are blank because the subscriber is not Orchestrion-based
module.exports = {
  child_process: [
    { path: './child_process/exec', instrumentations: [] },
    { path: './child_process/exec-file', instrumentations: [] }
  ]
}
