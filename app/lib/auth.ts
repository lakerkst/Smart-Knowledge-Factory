import { SignJWT, jwtVerify } from 'jose'
import type { Role } from './constants'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'skf-dev-secret-key-change-in-production-2024'
)

export interface AuthPayload {
  userId: string
  email: string
  role: Role
  companyId: string | null
  name: string
}

export async function createToken(payload: AuthPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .setIssuedAt()
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as AuthPayload
  } catch {
    return null
  }
}
