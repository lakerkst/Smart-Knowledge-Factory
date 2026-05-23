import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { db } from '~/../db'
import { companies } from '~/../db/schema'

export const getCompanyNameFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data }) => {
    const [company] = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, data.companyId))
      .limit(1)

    return company?.name || null
  })
