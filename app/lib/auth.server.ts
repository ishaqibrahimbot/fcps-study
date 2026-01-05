import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "~/db";
import { users } from "~/db/schema";

// Session cookie configuration
const COOKIE_NAME = "session";
const SESSION_EXPIRY_DAYS = 30;

// Get the secret key for JWT signing
function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

// Session payload type
export interface SessionPayload {
  userId: string;
  email: string;
  name: string | null;
  image: string | null;
  expiresAt: number;
}

/**
 * Create a JWT session token
 */
export async function createSessionToken(
  payload: Omit<SessionPayload, "expiresAt">
): Promise<string> {
  const expiresAt = Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

  return new SignJWT({ ...payload, expiresAt })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt / 1000)
    .sign(getSecretKey());
}

/**
 * Verify and decode a JWT session token
 */
export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Parse cookies from request headers
 */
export function parseCookies(request: Request): Record<string, string> {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies: Record<string, string> = {};

  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split("=");
    if (name) {
      cookies[name] = decodeURIComponent(rest.join("="));
    }
  });

  return cookies;
}

/**
 * Get session from request cookies
 */
export async function getSession(
  request: Request
): Promise<SessionPayload | null> {
  const cookies = parseCookies(request);
  const token = cookies[COOKIE_NAME];

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

/**
 * Create a Set-Cookie header for the session
 */
export function createSessionCookie(token: string): string {
  const expires = new Date(
    Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  );
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;
}

/**
 * Create a cookie that clears the session (for logout)
 */
export function createLogoutCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/**
 * Authenticate a user with email and password
 */
export async function authenticateUser(
  email: string,
  password: string
): Promise<{ user: SessionPayload; token: string } | { error: string }> {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    return { error: "Invalid email or password" };
  }

  if (!user.passwordHash) {
    return {
      error:
        "This account uses Google sign-in. Please use the Google button above.",
    };
  }

  // Allow login without email verification - users have 7 days to verify
  // The dashboard will show a banner reminding them to verify

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatch) {
    return { error: "Invalid email or password" };
  }

  const sessionPayload: Omit<SessionPayload, "expiresAt"> = {
    userId: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
  };

  const token = await createSessionToken(sessionPayload);

  return {
    user: { ...sessionPayload, expiresAt: Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000 },
    token,
  };
}

/**
 * Hash a password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
