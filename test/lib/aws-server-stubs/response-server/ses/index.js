/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const helpers = module.exports
const { readFromXml } = require('../common')

let sendEmailResponse = null
helpers.getSendEmailResponse = function getSendEmailResponse(callback) {
  if (sendEmailResponse) {
    setImmediate(() => {
      callback(null, sendEmailResponse)
    })
    return
  }

  readFromXml('./ses/responses/send-email-response.xml', (err, data) => {
    if (err) {
      callback(err)
      return
    }

    sendEmailResponse = data
    callback(null, sendEmailResponse)
  })
}
