/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const STATIC_PROMISE_METHODS = [
  'reject',
  'resolve',
  'all',
  'any',
  'some',
  'map',
  'reduce',
  'filter',
  'reduceRight'
]

const WHEN_SPEC = {
  name: 'when',
  // name of the property where the Promise constructor lives
  constructor: 'Promise',
  // wrap The Promise constructor
  executor: true,
  /**
   * The mapping for Promise instance method concepts (i.e. `then`). These are
   * mapped on the Promise class' prototype.
   */
  $proto: {
    then: ['then', 'done', 'spread', 'finally', 'ensure'],
    catch: ['catch', 'otherwise']
  },
  /**
   * The mapping for Promise static method concepts (i.e. `settle`, `race`). These
   * are mapped on the Promise class itself.
   */
  $static: {
    cast: STATIC_PROMISE_METHODS,
    $copy: STATIC_PROMISE_METHODS.concat([
      '_defer',
      '_handler',
      'race',
      '_traverse',
      '_visitRemaining',
      'settle',
      'iterate',
      'unfold',
      'never'
    ]),
    $passThrough: [
      'enterContext',
      'exitContext',
      'createContext',
      'onFatalRejection',
      'onPotentiallyUnhandledRejectionHandled',
      'onPotentiallyUnhandledRejection'
    ]
  },
  // The mapping for library-level static method concepts (i.e. `reject`, `resolve`).
  $library: {
    cast: STATIC_PROMISE_METHODS
  }
}

module.exports.WHEN_SPEC = WHEN_SPEC
