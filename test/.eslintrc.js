/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
module.exports = {
  "env": {
    "mocha": true
  },
  "rules": {
    "max-nested-callbacks": "off",
    "func-names": "off",
    "no-shadow": ["warn", {"allow": ["cb", "t", "shim", "error", "err"]}],
    "brace-style": ["error", "1tbs", {"allowSingleLine": true}]
  }
}
