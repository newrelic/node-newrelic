/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * A configuration object that defines the necessary components for registering
 * a middleware within the AWS v3 SDK.
 *
 * @typedef {object} AwsSdkMiddleware
 * @property {AwsSdkBoundMiddlewareFunction} fn The actual middleware function
 * that will be registered.
 * @property {AwsSdkMiddlewareInitFunction} [init] Initialization function.
 * @property {AwsSdkMiddlewareConfig} config Defines details when registering
 * the middleware.
 */

/**
 * @typedef {Function} AwsSdkBoundMiddlewareFunction
 * @param {SmithyClientSendSubscriber} subscriber The subscriber instance that
 * governs the instrumentation the middleware provides.
 * @param {object} config AWS client configuration object.
 * @param {Function} next The next middleware function to invoke.
 * @param {object} context AWS invocation context object.
 * @returns {Function} A standard AWS SDK middleware function that performs
 * the actual middleware work.
 */

/**
 * @typedef {Function} AwsSdkMiddlewareInitFunction
 * @param {SmithyClientSendSubscriber} subscriber The subscriber instance that
 * governs the instrumentation the middleware provides.
 * @param {SubscriberHandlerData} data Data object passed to subscriber
 * handler functions.
 * @returns {boolean} True if the middleware should be registered given some
 * conditions, e.g. configuration. False if the middleware should be skipped.
 */

/**
 * @typedef {object} AwsSdkMiddlewareConfig
 * @property {string} name A unique name to identify the middleware, typically
 * named for the middleware chain being targeted, e.g. `MyDeserializer`.
 * @property {string} step The position in the middleware execution stack to
 * register the function. See
 * https://github.com/smithy-lang/smithy-typescript/blob/3c21a57/packages/middleware-stack/README.md?plain=1#L23-L33
 * @property {string} priority Indicates some level of importance. May be
 * one of 'low', 'normal', or 'high'. See
 * https://github.com/smithy-lang/smithy-typescript/blob/3c21a57/packages/middleware-stack/src/MiddlewareStack.ts#L351-L355
 * @property {boolean} override Indicates if this middleware should replace
 * any existing ones with the same name. See
 * https://github.com/smithy-lang/smithy-typescript/blob/3c21a57/packages/middleware-stack/src/MiddlewareStack.ts#L203
 */
