/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const SpecSegment = require('./segment')
const SpecRecorder = require('./recorder')
const SpecWrap = require('./wrap')
const SpecMiddleware = require('./middleware')
const SpecMessage = require('./message')
const SpecMessageSubscribe = require('./message-subscribe')
exports.SpecSegment = SpecSegment
exports.SpecRecorder = SpecRecorder
exports.SpecWrap = SpecWrap
exports.SpecMiddleware = SpecMiddleware
exports.SpecMessage = SpecMessage
exports.SpecMessageSubscribe = SpecMessageSubscribe

const { ARG_INDEXES } = require('./constants')
exports.ARG_INDEXES = ARG_INDEXES

exports.MiddlewareSpec = MiddlewareSpec
exports.RecorderSpec = RecorderSpec
exports.MessageSpec = MessageSpec
exports.MessageSubscribeSpec = MessageSubscribeSpec

function RecorderSpec(spec) {
  return new SpecRecorder(spec)
}

function MiddlewareSpec(spec) {
  return new SpecMiddleware(spec)
}

function MessageSpec(spec) {
  return new SpecMessage(spec)
}

function MessageSubscribeSpec(spec) {
  return new SpecMessageSubscribe(spec)
}
