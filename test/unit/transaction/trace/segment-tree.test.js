/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const SegmentTree = require('../../../../lib/transaction/trace/segment-tree')

test('should add root to segment tree', () => {
  const segment = { id: '1', name: 'ROOT' }
  const tree = new SegmentTree(segment)
  assert.deepEqual(tree.root, { segment, children: [] })
})

test('should find the proper parent node', () => {
  const segment = { id: '1', name: 'ROOT', parentId: '0' }
  const tree = new SegmentTree(segment)
  const segment2 = { id: '2', parentId: '1', name: 'segment2' }
  tree.add(segment2)
  const segment3 = { id: '3', parentId: '2', name: 'segment3' }
  const segment4 = { id: '4', parentId: '2', name: 'segment4' }
  tree.add(segment3)
  tree.add(segment4)
  const segment5 = { id: '5', parentId: '1', name: 'segment5' }
  tree.add(segment5)
  const segment6 = { id: '6', parentId: '4', name: 'segment6' }
  tree.add(segment6)

  let parent = tree.find(segment6.parentId)
  assert.deepEqual(parent.segment, segment4)
  parent = tree.find(segment5.parentId)
  assert.deepEqual(parent.segment, segment)
  parent = tree.find(segment4.parentId)
  assert.deepEqual(parent.segment, segment2)
  parent = tree.find(segment3.parentId)
  assert.deepEqual(parent.segment, segment2)
  parent = tree.find(segment2.parentId)
  assert.deepEqual(parent.segment, segment)
  parent = tree.find(segment.parentId)
  assert.ok(!parent)
})

test('should not add child if parent cannot be found', () => {
  const segment = { id: '1', name: 'ROOT' }
  const tree = new SegmentTree(segment)
  const segment2 = { id: '2', parentId: '0', name: 'segment2' }
  tree.add(segment2)
  assert.deepEqual(tree.root.children, [])
})
