/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports.extractDatabaseChangeFromUse = extractDatabaseChangeFromUse

function extractDatabaseChangeFromUse(sql) {
  // The character ranges for this were pulled from
  // http://dev.mysql.com/doc/refman/5.7/en/identifiers.html

  // The lint rule being suppressed here has been evaluated, and it has been
  // determined that the regular expression is sufficient for our use case.
  // eslint-disable-next-line sonarjs/slow-regex
  const match = /^\s*use[^\w`]+([\w$\u0080-\uFFFF]+|`[^`]+`)[\s;]*$/i.exec(sql)
  return (match && match[1]) || null
}
