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
    this._ranges = null
  }
}

class SegmentTree {
  constructor(root, { logger = defaultLogger } = {}) {
    this.logger = logger
    this.root = new Node(root)
    this._nodes = new Map([[root.id, this.root]])
  }

  find(id) {
    return this._nodes.get(id) ?? null
  }

  add(segment) {
    const parent = this._nodes.get(segment.parentId)

    if (!parent) {
      this.logger.debug('Cannot find parent %s in tree', segment.parentId)
      return
    }

    const node = new Node(segment)
    this._nodes.set(segment.id, node)
    parent.children.push(node)
  }
}

module.exports = SegmentTree
