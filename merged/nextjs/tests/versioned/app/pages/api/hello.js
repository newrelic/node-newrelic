/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

export default function handler(req, res) {
  res.status(200).json({ name: 'John Doe' })
}
