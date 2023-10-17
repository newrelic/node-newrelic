/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { isSimpleObject } = require('../util/objects')

class MergeServerConfig {
  // eslint-disable-next-line max-params
  updateNestedIfChanged(config, remote, local, remoteKey, localKey, logger) {
    const value = remote[remoteKey]

    // if the value hasn't changed, skip this work.
    // currently, this will always treat objects as
    // new as it does not do a deep-check.
    if (value === null || local[localKey] === value) {
      return
    }

    // we need different update/merge logic if the server
    // value is an array, a simple object, or anything else
    if (Array.isArray(value) && Array.isArray(local[localKey])) {
      this.updateArray(value, local, localKey)
    } else if (isSimpleObject(value) && isSimpleObject(local[localKey])) {
      this.updateObject(value, local, localKey)
    } else {
      local[localKey] = value
    }
    config.emit(remoteKey, value)
    logger.debug('Configuration of %s was changed to %s by New Relic.', remoteKey, value)
  }

  updateArray(value, local, localKey) {
    value.forEach((element) => {
      if (local[localKey].indexOf(element) === -1) {
        local[localKey].push(element)
      }
    })
  }

  updateObject(value, local, localKey) {
    // go through each key of the object and update it
    Object.keys(value).forEach((element) => {
      if (Array.isArray(local[localKey][element]) && Array.isArray(value[element])) {
        // if both key-values are arrays, push the remote value onto the local array
        value[element].forEach((elementValue) => {
          if (-1 === local[localKey][element].indexOf(elementValue)) {
            local[localKey][element].push(elementValue)
          }
        })
      } else {
        // otherwise, replace the local value with the server value
        local[localKey][element] = value[element]
      }
    })
  }
}

module.exports = MergeServerConfig
