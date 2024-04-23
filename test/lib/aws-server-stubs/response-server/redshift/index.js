/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const helpers = module.exports
const { readFromXml } = require('../common')

let acceptExchangeResponse = null
helpers.getAcceptExchangeResponse = function getAcceptExchangeResponse(callback) {
  if (acceptExchangeResponse) {
    setImmediate(() => {
      callback(null, acceptExchangeResponse)
    })
    return
  }

  readFromXml('./redshift/responses/accept-exchange-response.xml', (err, data) => {
    if (err) {
      callback(err)
      return
    }

    acceptExchangeResponse = data
    callback(null, acceptExchangeResponse)
  })
}
