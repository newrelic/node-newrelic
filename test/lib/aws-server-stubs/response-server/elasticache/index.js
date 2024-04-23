/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const helpers = module.exports
const { readFromXml } = require('../common')

let addTagsResponse = null
helpers.getAddTagsResponse = function getAddTagsResponse(callback) {
  if (addTagsResponse) {
    setImmediate(() => {
      callback(null, addTagsResponse)
    })
    return
  }

  readFromXml('./elasticache/responses/add-tags-response.xml', (err, data) => {
    if (err) {
      callback(err)
      return
    }

    addTagsResponse = data
    callback(null, addTagsResponse)
  })
}
