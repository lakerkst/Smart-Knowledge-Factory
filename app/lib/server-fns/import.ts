import { createServerFn } from '@tanstack/react-start'
import { db } from '~/../db'
import { users } from '~/../db/schema'
import { generateToken } from '../utils'

export const importEmployeesFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { names: string[]; companyId: string }) => data)
  .handler(async ({ data }) => {
    const results: Array<{ name: string; token: string }> = []

    for (const rawName of data.names) {
      const name = rawName.trim()
      if (!name) continue

      const token = generateToken(24)
      await db.insert(users).values({
        name,
        role: 'employee',
        companyId: data.companyId,
        personalToken: token,
        isActive: true,
      })
      results.push({ name, token })
    }

    return { results }
  })
