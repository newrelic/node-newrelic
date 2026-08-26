/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Enumerates the kinds of transaction the agent can create and provides a
 * lookup for validating a candidate type value.
 *
 * The three type values are the only enumerable own static properties, so
 * `Object.entries(Type)` yields `[['WEB','web'],['BG','bg'],['MESSAGE','message']]`
 * — the shape `lib/shim/transaction-shim.js` relies on when defining its static
 * type members. Static methods are non-enumerable, so `values()`/`isValid()` do
 * not appear in that enumeration.
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
   * @param {string} value A candidate transaction type value.
   * @returns {boolean} True when `value` is a valid transaction type.
   */
  static isValid(value) {
    return Type.values().includes(value)
  }
}

module.exports = Type
