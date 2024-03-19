/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

class IdGenerator {
  #tracked = new Map()

  /**
   * Get the next available identifier for the provided `name`.
   *
   * @param {string} name The label to get an id for.
   *
   * @returns {number} The id.
   */
  idFor(name) {
    const key = Symbol.for(name)
    let val = this.#tracked.get(key)
    if (val === undefined) {
      val = 0
    } else {
      val += 1
    }
    this.#tracked.set(key, val)
    return val
  }
}

module.exports = IdGenerator
