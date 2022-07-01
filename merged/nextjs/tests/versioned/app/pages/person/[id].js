/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRouter } from 'next/router'

const Person = ({ user }) => {
  const router = useRouter()

  return (
    <div>
      <button onClick={() => router.back()}>Back</button>
      <pre>{JSON.stringify(user, null, 4)}</pre>
    </div>
  )
}

export async function getServerSideProps(context) {
  const { id } = context.params
  const host = context.req.headers.host
  const user = await fetch(`http://${host}/api/person/${id}`)
  const data = await user.json()

  if (!data) {
    return {
      notFound: true
    }
  }

  return {
    props: { user: data }
  }
}

export default Person
