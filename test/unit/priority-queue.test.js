/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { match } = require('../lib/custom-assertions')

const PriorityQueue = require('../../lib/priority-queue')

test('#add', async (t) => {
  await t.test('structures the data as a min heap', () => {
    const queue = new PriorityQueue()

    queue.add('left grandchild', 10)
    queue.add('parent', 1)
    queue.add('right child', 5)
    queue.add('left child', 8)

    assert.equal(
      match(queue.toArray(), ['parent', 'left child', 'right child', 'left grandchild']),
      true
    )
  })

  await t.test('replaces lowest priority item if limit is met', () => {
    const queue = new PriorityQueue(4)

    queue.add('left grandchild', 10)
    queue.add('parent', 1)
    queue.add('right child', 5)
    queue.add('left child', 8)

    assert.equal(
      match(queue.toArray(), ['parent', 'left child', 'right child', 'left grandchild']),
      true
    )

    queue.add('new parent', 2)

    assert.equal(
      match(queue.toArray(), ['new parent', 'right child', 'left grandchild', 'left child']),
      true
    )
  })

  await t.test('does not insert events in the case the limit is 0', () => {
    const queue = new PriorityQueue(0)
    assert.equal(queue.add('test', 1), false)
    assert.equal(queue.length, 0)
  })
})

test('#merge', async (t) => {
  await t.test('merges two sources and maintains the limit', () => {
    const queueLimit = 4
    const queue1 = new PriorityQueue(queueLimit)
    const queue2 = new PriorityQueue(queueLimit)

    for (let pri = 0; pri < queueLimit; ++pri) {
      queue1.add('test', pri)
      queue2.add('test', pri)
    }

    queue1.merge(queue2)
    assert.equal(queue1.length, queueLimit)
  })
})

test('#setLimit', async (t) => {
  await t.test('resets the limit property and slices the data if necessary', () => {
    const queue = new PriorityQueue(5)

    assert.equal(queue.limit, 5)
    queue.setLimit(10)
    assert.equal(queue.limit, 10)

    for (let i = 0; i < 6; i++) {
      queue.add(i, i)
    }

    assert.equal(queue.length, 6)
    assert.equal(match(queue.toArray(), [0, 5, 4, 3, 2, 1]), true)
    queue.setLimit(5)
    assert.equal(match(queue.toArray(), [1, 2, 3, 4, 5]), true)
    assert.equal(queue.length, 5)
  })
})
