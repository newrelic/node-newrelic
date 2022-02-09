/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { data } from '../../../data'

export default function handler(request, response) {
  const { method } = request

  if (method === 'GET') {
    return response.status(200).json(data)
  }

  if (method === 'POST') {
    const { body } = request
    data.push({ ...body, id: data.length + 1 })
    return response.status(200).json(data)
  }

  return response.status(400).json({ message: 'invalid method' })
}
