import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'

const fetchHandler = createStartHandler(defaultStreamHandler)

export default {
  async fetch(...args: Parameters<typeof fetchHandler>) {
    return await fetchHandler(...args)
  },
}
