// JWT helpers using the `jose` library (works in all environments)
import { SignJWT, jwtVerify } from "jose";

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET ?? "fallback_secret");

export interface TokenPayload {
  userId: string;
  email: string;
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export function getCookieToken(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)bw_token=([^;]+)/);
  return match ? match[1] : null;
}

export async function getUserFromRequest(request: Request): Promise<TokenPayload | null> {
  const token = getCookieToken(request);
  if (!token) return null;
  return verifyToken(token);
}

export function authCookie(token: string): string {
  return `bw_token=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`;
}

export function clearCookie(): string {
  return `bw_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}
