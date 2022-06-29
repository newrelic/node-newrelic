/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRouter } from 'next/router'
import { data } from '../../data'

export async function getServerSideProps(context) {
  return {
    props: { users: data }
  }
}

export default function People({ users }) {
  const router = useRouter()

  return (
    <div>
      <button onClick={() => router.back()}>Back</button>
      <pre>{JSON.stringify(users)}</pre>
    </div>
  )
}
