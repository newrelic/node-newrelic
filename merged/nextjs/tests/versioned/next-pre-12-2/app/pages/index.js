/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import Link from 'next/link'
import { useReducer, useState } from 'react'

function reducer(state, action) {
  switch (action.type) {
    case 'UPDATE_FIRST_NAME':
      return {
        ...state,
        firstName: action.payload.firstName
      }
    case 'UPDATE_MIDDLE_NAME':
      return {
        ...state,
        middleName: action.payload.middleName
      }
    case 'UPDATE_LAST_NAME':
      return {
        ...state,
        lastName: action.payload.lastName
      }
    case 'UPDATE_AGE':
      return {
        ...state,
        age: action.payload.age
      }
    case 'CLEAR':
      return initialState
    default:
      return state
  }
}

const initialState = {
  firstName: '',
  middleName: '',
  lastName: '',
  age: ''
}

export default function Home() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [data, setData] = useState([])

  const fetchData = async () => {
    const response = await fetch('/api/person')

    if (!response.ok) {
      throw new Error(`Error: ${response.status}`)
    }
    const people = await response.json()
    return setData(people)
  }

  const postData = async () => {
    const response = await fetch('/api/person', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(state)
    })

    if (!response.ok) {
      throw new Error(`Error: ${response.status}`)
    }

    dispatch({ type: 'CLEAR' })
    const people = await response.json()
    return setData(people)
  }
  return (
    <div style={{ margin: '0 auto', maxWidth: '400px' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label htmlFor="firstName">First Name</label>
        <input
          type="text"
          id="firstName"
          value={state.firstName}
          onChange={(e) =>
            dispatch({
              type: 'UPDATE_FIRST_NAME',
              payload: { firstName: e.target.value }
            })
          }
        />
        <label htmlFor="middleName">Middle Name</label>
        <input
          type="text"
          id="middleName"
          value={state.middleName}
          onChange={(e) =>
            dispatch({
              type: 'UPDATE_MIDDLE_NAME',
              payload: { middleName: e.target.value }
            })
          }
        />
        <label htmlFor="lastName">Last Name</label>
        <input
          type="text"
          id="lastName"
          value={state.lastName}
          onChange={(e) =>
            dispatch({
              type: 'UPDATE_LAST_NAME',
              payload: { lastName: e.target.value }
            })
          }
        />
        <label htmlFor="age">Age</label>
        <input
          type="text"
          id="age"
          value={state.age}
          onChange={(e) =>
            dispatch({
              type: 'UPDATE_AGE',
              payload: { age: e.target.value }
            })
          }
        />
      </div>
      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
        <button onClick={fetchData}>FETCH</button>
        <button onClick={postData}>CREATE</button>
      </div>
      <div>Data:</div>
      {data ? <pre>{JSON.stringify(data, null, 4)}</pre> : null}
      {data.length > 0 ? (
        <div style={{ textAlign: 'center' }}>
          Click a button to go to individual page
          <div
            style={{
              marginTop: '1rem',
              display: 'flex',
              justifyContent: 'center'
            }}
          >
            {data.map((person, index) => (
              <Link key={index} href="/person/[id]" as={`/person/${person.id}`} passHref>
                <span
                  style={{
                    padding: '5px 10px',
                    border: '1px solid black'
                  }}
                >{`${person.firstName} ${person.lastName}`}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
