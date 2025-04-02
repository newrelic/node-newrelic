/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

class Stack {
  #elements = []
  #maxElements

  constructor(maxElements = 100) {
    this.#maxElements = maxElements
  }

  add(item) {
    let idx = 0
    if (this.#elements.length === this.#maxElements) {
      idx = 1
    }
    this.#elements = [...this.#elements.slice(idx), item]
  }

  get elements() {
    return this.#elements
  }
}

module.exports = Stack
