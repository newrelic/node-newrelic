/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Transactions are limited to a specific set of transaction types. `Type`
 * codifies this list and provides mechanisms for enumerating and validating
 * types.
 */
class Type {
  static WEB = 'web'
  static BG = 'bg'
  static MESSAGE = 'message'

  /**
   * @returns {string[]} The valid transaction type values, e.g.
   * `['web', 'bg', 'message']`.
   */
  static values() {
    return [Type.WEB, Type.BG, Type.MESSAGE]
  }

  /**
   * Enumerates the types as `[name, value]` pairs, mirroring
   * `Object.entries` over a plain enum object (e.g.
   * `[['WEB', 'web'], ['BG', 'bg'], ['MESSAGE', 'message']]`).
   *
   * @returns {string[][]} The `[name, value]` pairs.
   */
  static entries() {
    return [
      ['WEB', Type.WEB],
      ['BG', Type.BG],
      ['MESSAGE', Type.MESSAGE]
    ]
  }

  /**
   * @param {string} value A candidate transaction type value.
   * @returns {boolean} True when `value` is a valid transaction type.
   */
  static isValid(value) {
    return Type.values().includes(value)
  }
}

module.exports = Type
