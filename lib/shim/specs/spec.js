/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * A spec is utilized by shims as a method of describing how an instrumentation
 * should be performed. They provide a convenient object to hang custom
 * properties on in addition to the set of well-known fields and methods.
 *
 * @private
 * @interface
 */
class Spec {}

module.exports = Spec
