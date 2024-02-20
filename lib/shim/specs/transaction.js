/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const SegmentSpec = require('./segment')

/* eslint-disable jsdoc/require-property-description */
/**
 * @typedef {object} TransactionSpecParams
 * @mixes SegmentSpecParams
 * @property {boolean} [nest]
 * @property {string} [type]
 */

/**
 * Spec that describes the type of agent transaction to be created by the
 * function being wrapped by {@link TransactionShim.bindCreateTransaction}.
 */
class TransactionSpec extends SegmentSpec {
  /**
   * Indicates if the transaction being created is allowed to be nested within
   * another transaction of the same type. If `false`, the default, the
   * transaction will only be created if there is no existing transaction, or
   * the current transaction is of a different type. If `true`, the transaction
   * will be created regardless of the current transaction's type.
   *
   * @type {boolean}
   */
  nest

  /**
   * The type of the transaction to create. Must be one of the values from
   * {@link TransactionShim.TRANSACTION_TYPES}.
   *
   * @type {string}
   */
  type

  /* eslint-disable jsdoc/require-param-description */
  /**
   * @param {TransactionSpecParams} params
   */
  constructor(params) {
    super(params)

    this.nest = params.nest ?? false

    if (typeof params.type !== 'string') {
      throw Error('params.type must be a string')
    }
    this.type = params.type
  }
}

module.exports = TransactionSpec
