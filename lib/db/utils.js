/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports.extractDatabaseChangeFromUse = extractDatabaseChangeFromUse

function extractDatabaseChangeFromUse(sql) {
  // The character ranges for this were pulled from
  // http://dev.mysql.com/doc/refman/5.7/en/identifiers.html
  const match = /^\s*use[^\w`]+([\w$_\u0080-\uFFFF]+|`[^`]+`)[\s;]*$/i.exec(sql)
  return (match && match[1]) || null
}
