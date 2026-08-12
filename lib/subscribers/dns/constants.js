/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const RESOLVE_METHODS = [
  'resolve',
  'resolve4',
  'resolve6',
  'resolveCname',
  'resolveMx',
  'resolveNaptr',
  'resolveNs',
  'resolvePtr',
  'resolveSrv',
  'resolveTxt',
  // missing
  // resolveAny
  // resolveCaa
  // resolveNaptr
  // resolveSoa
  // resolveTlsa
]
const INSTRUMENTED_METHODS = [
  'lookup',
  'reverse',
  ...RESOLVE_METHODS
]

module.exports = { INSTRUMENTED_METHODS, RESOLVE_METHODS }
