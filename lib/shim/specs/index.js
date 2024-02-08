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

const { ARG_INDEXES } = require('./constants')
exports.ARG_INDEXES = ARG_INDEXES

exports.MiddlewareSpec = MiddlewareSpec
exports.RecorderSpec = RecorderSpec
exports.SegmentSpec = SegmentSpec
exports.WrapSpec = WrapSpec
exports.MessageSpec = MessageSpec
exports.MessageSubscribeSpec = MessageSubscribeSpec

function WrapSpec(spec) {
  return new SpecWrap(spec)
}

function SegmentSpec(spec) {
  return new SpecSegment(spec)
}

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
