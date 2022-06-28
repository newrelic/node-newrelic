/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRouter } from 'next/router'
import { data } from '../../../../data'

export async function getServerSideProps(context) {
  const { id } = context.params
  const user = data.find((person) => person.id.toString() === id)

  return {
    props: { user }
  }
}

export default function Person({ user }) {
  const router = useRouter()

  return (
    <div>
      <button onClick={() => router.back()}>Back</button>
      <pre>{JSON.stringify(user, null, 4)}</pre>
    </div>
  )
}
