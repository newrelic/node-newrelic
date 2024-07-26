/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { getPerson } from '../../../lib/functions'

export default async function Person({ params }) {
  const user = await getPerson(params.id)

  return (
    <div>
      <pre>{JSON.stringify(user, null, 4)}</pre>
    </div>
  )
}

