/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const PriorityQueue = require('../../lib/priority-queue')

tap.test('PriorityQueue', function (t) {
  t.autoend()
  let queue = null

  t.test('#add', function (t) {
    t.autoend()

    t.test('structures the data as a min heap', function (t) {
      queue = new PriorityQueue()

      queue.add('left grandchild', 10)
      queue.add('parent', 1)
      queue.add('right child', 5)
      queue.add('left child', 8)

      t.same(queue.toArray(), ['parent', 'left child', 'right child', 'left grandchild'])
      t.end()
    })

    t.test('replaces lowest priority item if limit is met', function (t) {
      queue = new PriorityQueue(4)

      queue.add('left grandchild', 10)
      queue.add('parent', 1)
      queue.add('right child', 5)
      queue.add('left child', 8)

      t.same(queue.toArray(), ['parent', 'left child', 'right child', 'left grandchild'])

      queue.add('new parent', 2)

      t.same(queue.toArray(), ['new parent', 'right child', 'left grandchild', 'left child'])
      t.end()
    })

    t.test('does not insert events in the case the limit is 0', function (t) {
      queue = new PriorityQueue(0)
      t.equal(queue.add('test', 1), false)
      t.equal(queue.length, 0)
      t.end()
    })
  })

  t.test('#merge', function (t) {
    t.autoend()

    t.test('merges two sources and maintains the limit', function (t) {
      const queueLimit = 4
      const queue1 = new PriorityQueue(queueLimit)
      const queue2 = new PriorityQueue(queueLimit)

      for (let pri = 0; pri < queueLimit; ++pri) {
        queue1.add('test', pri)
        queue2.add('test', pri)
      }

      queue1.merge(queue2)
      t.equal(queue1.length, queueLimit)
      t.end()
    })
  })

  t.test('#setLimit', function (t) {
    t.autoend()

    t.test('resets the limit property and slices the data if necessary', function (t) {
      queue = new PriorityQueue(5)

      t.equal(queue.limit, 5)
      queue.setLimit(10)
      t.equal(queue.limit, 10)

      for (let i = 0; i < 6; i++) {
        queue.add(i, i)
      }

      t.equal(queue.length, 6)
      t.same(queue.toArray(), [0, 5, 4, 3, 2, 1])
      queue.setLimit(5)
      t.same(queue.toArray(), [1, 2, 3, 4, 5])
      t.equal(queue.length, 5)
      t.end()
    })
  })
})
