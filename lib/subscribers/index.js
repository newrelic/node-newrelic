/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// This index.js exists solely to add jsdoc blocks.

/**
 * Represents the object passed as the first parameter to an Orchestrion handler
 * functions.
 *
 * @typedef {object} SubscriberHandlerData
 * @property {any[]} arguments Represents the arguments that were originally
 * passed to the instrumented function. For example, given a function with the
 * signature `function foo(a, b, c) {}` that is invoked as
 * `foo({a: 'a'}, 1, [42])`, the arguments array received in the handler will
 * be `[{a: 'a'}, 1, [42]]`.
 * @property {string} moduleVersion The version of the module being instrumented
 * as it is discovered from the module's package manifest.
 * @property {object} self The module instance that is being instrumented. This
 * is the state of the module as if one had done `const mod = require('mod')`.
 */

/**
 * Represents the context object passed as the second parameter to an
 * Orchestrion handler.
 *
 * @typedef {object} SubscriberHandlerContext
 * @property {object} extras A hash of metadata that Orchestrion has determined
 * is useful in this instrumentation. Usually this is an empty object.
 * @property {TraceSegment} segment The New Relic segment that is the parent
 * of current operation.
 * @property {Transaction} transaction The New Relic transaction that is
 * tracking the current trace.
 */
