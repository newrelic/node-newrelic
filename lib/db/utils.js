/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports.extractDatabaseChangeFromUse = extractDatabaseChangeFromUse

function extractDatabaseChangeFromUse(sql) {
  // The character ranges for this were pulled from
  // http://dev.mysql.com/doc/refman/5.7/en/identifiers.html

  // Suppressing a warning on this regex because it is not obvious what this
  // regex does, and we don't want to break anything.
  // eslint-disable-next-line sonarjs/slow-regex, sonarjs/duplicates-in-character-class
  const match = /^\s*use[^\w`]+([\w$_\u0080-\uFFFF]+|`[^`]+`)[\s;]*$/i.exec(sql)
  return (match && match[1]) || null
}
