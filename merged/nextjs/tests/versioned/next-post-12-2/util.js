/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
module.exports.getNextAppPath = function getNextAppPath() {
  const path = __dirname.split('/')
  return `${path[path.length - 1]}/app`
}
