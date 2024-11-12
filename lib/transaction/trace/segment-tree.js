/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const defaultLogger = require('../../logger').child({ component: 'segment-tree' })

class Node {
  constructor(segment) {
    this.segment = segment
    this.children = []
  }
}

class SegmentTree {
  constructor(root, { logger = defaultLogger } = {}) {
    this.logger = logger
    this.root = new Node(root)
  }

  find(parentId, node = this.root) {
    if (parentId === node.segment.id) {
      return node
    }

    for (const child of node.children) {
      const result = this.find(parentId, child)
      if (result) {
        return result
      }
    }

    return null
  }

  add(segment) {
    const node = new Node(segment)
    const parent = this.find(segment.parentId)

    if (!parent) {
      this.logger.debug('Cannot find parent %s in tree', segment.parentId)
      return
    }

    parent.children.push(node)
  }
}

module.exports = SegmentTree
