/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const helpers = module.exports
const { readFromXml } = require('../common')

let publishMessageResponse = null
helpers.getPublishResponse = function getPublishResponse(callback) {
  if (publishMessageResponse) {
    setImmediate(() => {
      callback(null, publishMessageResponse)
    })
    return
  }

  readFromXml('./sns/responses/publish-message-response.xml', (err, data) => {
    if (err) {
      callback(err)
      return
    }

    publishMessageResponse = data
    callback(null, publishMessageResponse)
  })
}

let listTopicsResponse = null
helpers.getListTopicsResponse = function getListTopicsResponse(callback) {
  if (listTopicsResponse) {
    setImmediate(() => {
      callback(null, listTopicsResponse)
    })
    return
  }

  readFromXml('./sns/responses/list-topics-response.xml', (err, data) => {
    if (err) {
      callback(err)
      return
    }

    listTopicsResponse = data
    callback(null, listTopicsResponse)
  })
}
