/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRouter } from 'next/router'
import * as http from 'http'

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
  // TODO: Update to use global fetch once agent can properly
  // propagate context through it
  const data = await new Promise((resolve, reject) => {
    http.get(`http://${host}/api/person/${id}`, (res) => {
      let body = ''
      res.on('data', (data) => (body += data.toString(('utf8'))))
      res.on('end', () => {
        resolve(body)
      })
    }).on('error', reject)
  })

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
