/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const Timer = require('../../lib/timer')

tap.test('Timer', function (t) {
  t.autoend()
  t.test("should know when it's active", function (t) {
    const timer = new Timer()
    t.equal(timer.isActive(), true)
    t.end()
  })

  t.test("should know when it hasn't yet been started", function (t) {
    const timer = new Timer()
    t.equal(timer.isRunning(), false)
    t.end()
  })

  t.test("should know when it's running", function (t) {
    const timer = new Timer()
    timer.begin()
    t.equal(timer.isRunning(), true)
    t.end()
  })

  t.test("should know when it's not running", function (t) {
    const timer = new Timer()
    t.equal(timer.isRunning(), false)

    timer.begin()
    timer.end()
    t.equal(timer.isRunning(), false)
    t.end()
  })

  t.test("should know when it hasn't yet been stopped", function (t) {
    const timer = new Timer()
    t.equal(timer.isActive(), true)

    timer.begin()
    t.equal(timer.isActive(), true)
    t.end()
  })

  t.test("should know when it's stopped", function (t) {
    const timer = new Timer()
    timer.begin()
    timer.end()

    t.equal(timer.isActive(), false)
    t.end()
  })

  t.test('should return the time elapsed of a running timer', function (t) {
    const timer = new Timer()
    timer.begin()
    setTimeout(function () {
      t.ok(timer.getDurationInMillis() > 3)

      t.end()
    }, 5)
  })

  t.test('should allow setting the start as well as the duration of the range', function (t) {
    const timer = new Timer()
    const start = Date.now()
    timer.setDurationInMillis(5, start)

    t.equal(timer.start, start)
    t.end()
  })

  t.test('should return a range object', function (t) {
    const timer = new Timer()
    const start = Date.now()
    timer.setDurationInMillis(5, start)

    t.same(timer.toRange(), [start, start + 5])
    t.end()
  })

  t.test('should calculate start times relative to other timers', function (t) {
    const first = new Timer()
    first.begin()

    const second = new Timer()
    second.begin()

    first.end()
    second.end()

    let delta
    t.doesNotThrow(function () {
      delta = second.startedRelativeTo(first)
    })
    t.ok(typeof delta === 'number')
    t.end()
  })

  t.test('should support updating the duration with touch', function (t) {
    const timer = new Timer()
    timer.begin()

    setTimeout(function () {
      timer.touch()
      const first = timer.getDurationInMillis()

      t.ok(first > 0)
      t.equal(timer.isActive(), true)

      setTimeout(function () {
        timer.end()

        const second = timer.getDurationInMillis()
        t.ok(second > first)
        t.equal(timer.isActive(), false)

        t.end()
      }, 20)
    }, 20)
  })

  t.test('endsAfter indicates whether the timer ended after another timer', (t) => {
    t.autoend()
    t.beforeEach(function (t) {
      const start = Date.now()
      const first = new Timer()
      first.setDurationInMillis(10, start)
      t.context.second = new Timer()
      t.context.start = start
      t.context.first = first
    })

    t.test('with the same start and duration', function (t) {
      const { start, second, first } = t.context
      second.setDurationInMillis(10, start)
      t.equal(second.endsAfter(first), false)
      t.end()
    })

    t.test('with longer duration', function (t) {
      const { start, second, first } = t.context
      second.setDurationInMillis(11, start)
      t.equal(second.endsAfter(first), true)
      t.end()
    })

    t.test('with shorter duration', function (t) {
      const { start, second, first } = t.context
      second.setDurationInMillis(9, start)
      t.equal(second.endsAfter(first), false)
      t.end()
    })

    t.test('with earlier start', function (t) {
      const { start, second, first } = t.context
      second.setDurationInMillis(10, start - 1)
      t.equal(second.endsAfter(first), false)
      t.end()
    })

    t.test('with later start', function (t) {
      const { start, second, first } = t.context
      second.setDurationInMillis(10, start + 1)
      t.equal(second.endsAfter(first), true)
      t.end()
    })
  })

  t.test('overwriteDurationInMillis', function (t) {
    t.autoend()
    t.test('stops the timer', function (t) {
      const timer = new Timer()
      timer.begin()
      t.equal(timer.isActive(), true)

      timer.overwriteDurationInMillis(10)
      t.equal(timer.isActive(), false)
      t.end()
    })

    t.test('overwrites duration recorded by end() and touch()', function (t) {
      const timer = new Timer()
      timer.begin()
      setTimeout(function () {
        t.equal(timer.getDurationInMillis() > 1, true)
        timer.overwriteDurationInMillis(1)
        t.equal(timer.getDurationInMillis(), 1)
        t.end()
      }, 2)
    })
  })
})
