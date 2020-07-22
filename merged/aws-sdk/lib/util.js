/*
* Copyright 2020 New Relic Corporation. All rights reserved.
* SPDX-License-Identifier: Apache-2.0
*/
'use strict'
function grabLastUrlSegment(url = '/') {
  // cast URL as string, and an empty
  // string for null, undefined, NaN etc.
  url = '' + (url || '/')
  const lastSlashIndex = url.lastIndexOf('/')
  const lastItem = url.substr(lastSlashIndex + 1)

  return lastItem
}

module.exports = {
  grabLastUrlSegment
}
