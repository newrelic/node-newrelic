import { data } from '../data'
export async function getPerson(id) {
  const person = data.find((datum) => datum.id.toString() === id)

  return person || `Could not find person with id of ${id}`
}
