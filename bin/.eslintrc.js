/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
module.exports = {
  "rules": {
    "no-console": "off",
    "no-shadow": ["warn", {"allow": ["cb", "error", "err"]}],
  }
}
