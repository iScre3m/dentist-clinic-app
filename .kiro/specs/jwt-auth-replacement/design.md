# Design Document: JWT Authentication Replacement

## Architecture

### Components

The authentication system consists of the following components:

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │  /login      │  │  /app/*      │  │  /api/session   │   │
│  │  Page        │  │  Protected   │  │  Endpoint       │   │
│  └──────────────┘  └──────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Server Layer                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  hooks.server.ts - JWT Session Handler               │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                │
│          ┌─────────────────┴─────────────────┐              │
│          ▼                                   ▼              │
│  ┌──────────────────┐              ┌──────────────────┐     │
│  │  API Endpoints   │              │  Auth Service    │     │
│  │  - /api/login    │              │  - JWT.create()  │     │
│  │  - /api/logout   │              │  - JWT.verify()  │     │
│  │  - /api/session  │              │  - Cookie helpers│     │
│  └──────────────────┘              └──────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Environment Variables                   │
│  - AUTH_SECRET                                              │
│  - AUTH_USERNAME                                            │
│  - AUTH_PASSWORD_HASH                                       │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

**1. JWT Service (`src/lib/server/auth/jwt.ts`)**
- Create JWT tokens with payload
- Verify token signature and expiration
- Generate token expiration timestamps

**2. Cookie Service (`src/lib/server/auth/cookies.ts`)**
- Set auth_token cookie with proper settings
- Clear cookie on logout
- Extract token from request cookies

**3. API Endpoints**
- `/api/login` - Authenticate and set cookie
- `/api/logout` - Clear authentication cookie
- `/api/session` - Verify current session

**4. SvelteKit Hooks**
- Validate JWT from cookie on each request
- Attach session to `locals`
- Handle unauthenticated requests

### Interfaces

```typescript
// JWT Payload
interface JwtPayload {
  sub: string;           // Subject: "staff"
  username: string;      // Staff username
  role: "staff";         // Fixed role
  iat: number;           // Issued at (timestamp)
  exp: number;           // Expiration (timestamp)
}

// Session Object
interface Session {
  user: {
    id: string;
    username: string;
    role: 'staff';
  };
  expiresAt: Date;
}

// Auth Service Interface
interface AuthService {
  createToken(username: string): Promise<string>;
  verifyToken(token: string): JwtPayload | null;
  setCookie(res: Response, token: string): void;
  clearCookie(res: Response): void;
}
```

## Components and Interfaces

### JWT Service (`src/lib/server/auth/jwt.ts`)

```typescript
import jwt from 'jsonwebtoken';

const JWT_EXPIRY = 60 * 60 * 24 * 7; // 7 days

export function createToken(username: string, secret: string): string {
  const payload = {
    sub: 'staff',
    username,
    role: 'staff' as const,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + JWT_EXPIRY
  };
  
  return jwt.sign(payload, secret, { algorithm: 'HS256' });
}

export function verifyToken(token: string, secret: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}

export function isTokenExpired(payload: JwtPayload): boolean {
  return payload.exp < Math.floor(Date.now() / 1000);
}
```

### Cookie Service (`src/lib/server/auth/cookies.ts`)

```typescript
export function setAuthCookie(response: Response, token: string, secret: string) {
  const cookieValue = `auth_token=${token}; Path=/; HttpOnly; Max-Age=${60 * 60 * 24 * 7}`;
  const secure = process.env.NODE_ENV === 'production';
  
  if (secure) {
    response.headers.append('Set-Cookie', `${cookieValue}; Secure; SameSite=Lax`);
  } else {
    response.headers.append('Set-Cookie', `${cookieValue}; SameSite=Lax`);
  }
}

export function clearAuthCookie(response: Response) {
  response.headers.append(
    'Set-Cookie',
    'auth_token=; Path=/; HttpOnly; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  );
}

export function getAuthCookie(cookies: string): string | null {
  const match = cookies.match(/auth_token=([^;]+)/);
  return match ? match[1] : null;
}
```

## Data Models

### JWT Token Payload

The JWT token contains minimal user information:

| Field | Type | Description |
|-------|------|-------------|
| `sub` | string | Subject identifier ("staff") |
| `username` | string | Staff username from env |
| `role` | string | User role ("staff") |
| `iat` | number | Issued at timestamp |
| `exp` | number | Expiration timestamp (7 days) |

### Session Object

The session object attached to `locals`:

| Field | Type | Description |
|-------|------|-------------|
| `user` | object | User information |
| `user.id` | string | User ID ("staff") |
| `user.username` | string | Staff username |
| `user.role` | string | User role ("staff") |
| `expiresAt` | Date | Token expiration date |

## Overview

The JWT authentication system will:
- Store staff credentials in `.env` (not in database)
- Use JSON Web Tokens signed with a secret
- Store tokens in httpOnly cookies with 7-day expiration
- Maintain the same login page at `/login`
- Protect all routes under `/app`

## File Structure Changes

### New Files

```
src/
  lib/
    server/
      auth/
        jwt.ts              # JWT token creation and validation
        cookies.ts          # Cookie configuration helpers
        env-schema.ts       # Environment variable validation
        index.ts            # Auth service exports
  routes/
    api/
      login/
        +server.ts        # Login endpoint
      logout/
        +server.ts        # Logout endpoint
      session/
        +server.ts        # Session verification endpoint
    login/
      +page.server.ts     # Login page server load
  scripts/
    staff-update.ts       # Update staff credentials
```

### Removed Files/Folders

```
src/lib/server/auth.ts          # BetterAuth implementation
src/lib/auth-client.ts          # BetterAuth client
src/routes/api/auth/[...all]/   # BetterAuth route handler
```

### Modified Files

```
src/hooks.server.ts             # Replace BetterAuth with JWT session handling
src/app.d.ts                    # Update type definitions for JWT
src/lib/server/db/schema.ts     # Remove BetterAuth tables (user, session, account, verification)
```

## JWT Token Structure

```typescript
// Token payload
interface JwtPayload {
  sub: string;           // Subject: staff user ID (fixed: "staff")
  username: string;      // Staff username from env
  role: "staff";         // Fixed role
  iat: number;           // Issued at (timestamp)
  exp: number;           // Expiration (issued_at + 604800 seconds = 7 days)
}

// Token structure
{
  header: {
    alg: "HS256",
    typ: "JWT"
  },
  payload: {
    sub: "staff",
    username: "staff@example.com",
    role: "staff",
    iat: 1234567890,
    exp: 1235172690
  }
}
```

## Cookie Configuration

```typescript
// Cookie settings for JWT
const JWT_COOKIE_CONFIG = {
  name: 'auth_token',
  secret: env.AUTH_SECRET,
  options: {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7 // 7 days in seconds
  }
};
```

## API Endpoints

### POST `/api/login`

**Purpose:** Authenticate staff and set httpOnly cookie

**Request Body:**
```typescript
{
  username: string;
  password: string;
}
```

**Success Response (200 OK):**
- Sets httpOnly cookie with JWT token
- Returns empty body or success message

**Error Responses:**
- 400 Bad Request: Missing username or password
- 401 Unauthorized: Invalid credentials
- 500 Internal Server Error: Missing environment variables

**Behavior:**
1. Validate request body
2. Verify environment variables exist
3. Compare username with `AUTH_USERNAME` env
4. Verify password against `AUTH_PASSWORD_HASH` using bcrypt/argon2
5. Create JWT token with 7-day expiration
6. Set httpOnly cookie
7. Return success

### POST `/api/logout`

**Purpose:** Clear authentication cookie

**Request:** No body required

**Response (200 OK):**
- Clears `auth_token` cookie by setting expired date
- Returns empty body or success message

**Behavior:**
1. Clear the `auth_token` cookie
2. Return success

### GET `/api/session`

**Purpose:** Verify current session (internal use)

**Request:** No body (reads cookie)

**Success Response (200 OK):**
```typescript
{
  user: {
    id: "staff",
    username: string,
    role: "staff"
  }
}
```

**Error Responses:**
- 401 Unauthorized: Invalid or missing token

**Behavior:**
1. Read `auth_token` cookie
2. Verify token signature and expiration
3. Return user info if valid
4. Return 401 if invalid

## SvelteKit Hooks Implementation

### hooks.server.ts

```typescript
import { handleJwtSession } from '#lib/server/auth';
import type { Handle } from '@sveltejs/kit/hooks';

export const handle: Handle = async ({ event, resolve }) => {
  // Verify JWT session from cookie
  const session = await handleJwtSession(event.request.headers);
  event.locals.session = session;
  
  return resolve(event);
};
```

### Session Validation Logic

```typescript
export async function handleJwtSession(headers: Headers) {
  const cookie = headers.get('cookie') || '';
  const token = getCookieValue(cookie, 'auth_token');
  
  if (!token) {
    return null;
  }
  
  try {
    const payload = verifyJwt(token);
    return {
      user: {
        id: payload.sub,
        username: payload.username,
        role: payload.role
      },
      expiresAt: new Date(payload.exp * 1000)
    };
  } catch {
    return null;
  }
}
```

## Environment Variables

```env
# Authentication (REQUIRED - no defaults)
AUTH_SECRET=your-32-character-secret-here          # For JWT signing
AUTH_USERNAME=staff@example.com                    # Staff login username
AUTH_PASSWORD_HASH=$2b$10$...                      # bcrypt/argon2 hashed password
```

**Validation:**
- `AUTH_SECRET`: Must be at least 32 characters
- `AUTH_USERNAME`: Must be a valid email format
- `AUTH_PASSWORD_HASH`: Must be a valid bcrypt hash (starts with `$2b$` or `$2a$` or `$2y$`)

## Security Considerations

### 1. JWT Security
- Use HS256 algorithm with a strong secret (32+ characters)
- Set short expiration (7 days) with possibility of refresh
- Validate signature on every request
- Check expiration time before accepting token
- Never expose token to client-side JavaScript

### 2. Cookie Security
- `httpOnly: true` - Prevents JavaScript access
- `secure: true` in production - Only send over HTTPS
- `sameSite: 'lax'` - CSRF protection
- `maxAge: 604800` - 7-day expiration

### 3. Password Security
- Store only bcrypt/argon2 hashed passwords
- Never log passwords or hashes
- Use environment variables for credentials
- Consider implementing password rotation

### 4. Rate Limiting
- Apply rate limiting to login endpoint
- Block after N failed attempts (e.g., 5 attempts per minute)
- Use IP-based or username-based limiting

### 5. Secret Management
- Never commit `.env` file to git
- Use `.env.example` with placeholder values
- Rotate secrets periodically
- Use different secrets for development and production

## SvelteKit Hooks for Auth Protection

### Protected Routes

All routes under `/app` should be protected. This is handled by:

1. **Layout Server Load** (`src/routes/(app)/+layout.server.ts`):
```typescript
export const load: LayoutServerLoad = ({ locals }) => {
  if (!locals.session) {
    throw redirect(303, '/login');
  }
  return { user: locals.session.user };
};
```

2. **Page Server Load** (for individual pages):
```typescript
export const load: PageServerLoad = ({ locals }) => {
  if (!locals.session) {
    throw redirect(303, '/login');
  }
  // Additional data loading
};
```

3. **Form Actions**:
```typescript
export const actions: Actions = {
  default: async ({ request, locals }) => {
    if (!locals.session) {
      error(401, 'Iniciá sesión para continuar.');
    }
    // Action logic
  }
};
```

## Database Migration Plan

### Step 1: Create Migration File

Create a new migration to drop BetterAuth tables:

```sql
-- Drop BetterAuth tables
DROP TABLE IF EXISTS verification;
DROP TABLE IF EXISTS account;
DROP TABLE IF EXISTS session;
DROP TABLE IF EXISTS user;
```

### Step 2: Update Schema

Remove BetterAuth table definitions from `src/lib/server/db/schema.ts`:
- `user`
- `session`
- `account`
- `verification`

Keep the rest of the schema intact.

### Step 3: Update Type Definitions

Update `src/app.d.ts` to reflect JWT session structure:

```typescript
declare global {
  namespace App {
    interface Locals {
      db: DrizzleD1Database<typeof schema>;
      session: {
        user: {
          id: string;
          username: string;
          role: 'staff';
        };
        expiresAt: Date;
      } | null;
    }
  }
}

export {};
```

### Step 4: Run Migration

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

## Testing Strategy

### Unit Tests

**File:** `src/lib/server/auth/jwt.test.ts`

1. **Token Creation**
   - Token is created with correct payload structure
   - Expiration is set to 7 days from issue
   - Token is signed with secret

2. **Token Validation**
   - Valid token is accepted
   - Expired token is rejected
   - Invalid signature is rejected
   - Tampered token is rejected

3. **Cookie Configuration**
   - Cookie name is `auth_token`
   - httpOnly flag is true
   - Secure flag matches environment
   - Max age is 7 days

### Integration Tests

**File:** `tests/auth.test.ts`

1. **Login Flow**
   - Valid credentials set httpOnly cookie
   - Invalid credentials return 401
   - Missing credentials return 400
   - Cookie contains valid JWT

2. **Logout Flow**
   - Clears auth_token cookie
   - Returns success status

3. **Session Verification**
   - Valid cookie returns session data
   - Invalid cookie returns 401
   - Expired cookie returns 401

4. **Rate Limiting**
   - Multiple failed login attempts are blocked
   - Success rate limit is not triggered

5. **Protected Routes**
   - Unauthenticated requests to `/app/*` redirect to `/login`
   - Authenticated requests proceed normally

### End-to-End Tests

**File:** `tests/e2e/auth.spec.ts`

1. **Full Login Flow**
   - Navigate to `/login`
   - Fill username and password
   - Submit form
   - Verify redirect to `/app/dashboard`
   - Verify session cookie is set

2. **Failed Login**
   - Navigate to `/login`
   - Enter invalid credentials
   - Verify error message is shown
   - Verify cookie is not set

3. **Logout Flow**
   - Navigate to `/app/dashboard` (logged in)
   - Click sign out button
   - Verify redirect to `/login`
   - Verify cookie is cleared

4. **Session Persistence**
   - Navigate to `/app/dashboard`
   - Refresh page
   - Verify session persists
   - Verify redirect to `/login` after 7 days

### Test Coverage Checklist

- [ ] JWT token creation with correct payload
- [ ] JWT token validation (signature, expiration)
- [ ] Cookie settings (httpOnly, secure, sameSite, maxAge)
- [ ] Login with valid credentials
- [ ] Login with invalid credentials
- [ ] Login with missing credentials
- [ ] Logout clears cookie
- [ ] Session verification with valid token
- [ ] Session verification with invalid token
- [ ] Protected routes require authentication
- [ ] Rate limiting on login endpoint
- [ ] Environment variable validation
- [ ] Error messages in Spanish
- [ ] Loading states during authentication

## Migration Checklist

### Pre-Migration

- [ ] Create backup of existing database
- [ ] Document current staff credentials
- [ ] Test new implementation in development
- [ ] Update `.env.example` with new variables

### Deployment

1. Update `.env` with new JWT variables
2. Deploy updated application
3. Run database migration to drop BetterAuth tables
4. Verify login works with new implementation
5. Test protected routes
6. Verify logout functionality

### Post-Migration

- [ ] Monitor logs for authentication errors
- [ ] Verify session persistence
- [ ] Confirm BetterAuth tables are removed
- [ ] Test all staff workflows

## Error Handling

### Common Errors

1. **Missing Environment Variables**
   ```
   Error: Falta AUTH_SECRET, AUTH_USERNAME o AUTH_PASSWORD_HASH.
   ```

2. **Invalid Credentials**
   ```
   Error: Correo o contraseña incorrectos.
   ```

3. **Expired Token**
   - Redirect to `/login`

4. **Invalid Signature**
   - Clear cookie and redirect to `/login`

5. **Rate Limited**
   ```
   Error: Demasiados intentos. Intentá de nuevo en X minutos.
   ```

## Rollback Plan

If issues occur:

1. Revert code to previous commit
2. Restore database from backup
3. Re-add BetterAuth tables if needed
4. Update `.env` with old BetterAuth variables

## Timeline

- **Phase 1:** Implement JWT auth module (1-2 days)
- **Phase 2:** Update hooks and API routes (1 day)
- **Phase 3:** Update login page and client (1 day)
- **Phase 4:** Database migration and testing (1 day)
- **Phase 5:** Deployment and verification (1 day)

**Total:** ~5 days

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Session Validation

*For any* HTTP request to a protected route, if the request contains a valid JWT token in the `auth_token` cookie that was signed with the correct secret and has not expired, the system SHALL attach the session object to `locals.session` and allow the request to proceed.

**Validates: Requirements 5.2**

### Property 2: Expired Token Rejection

*For any* HTTP request containing an expired JWT token, the system SHALL NOT attach a session object to `locals.session` and SHALL redirect the request to the `/login` page for protected routes.

**Validates: Requirements 1.6**

### Property 3: Invalid Token Rejection

*For any* HTTP request containing a JWT token with an invalid signature or tampered payload, the system SHALL NOT attach a session object to `locals.session` and SHALL redirect the request to the `/login` page for protected routes.

**Validates: Requirements 2.2, 2.4**

### Property 4: Cookie HttpOnly Flag

*For any* login response that sets the `auth_token` cookie, the cookie SHALL have the `HttpOnly` flag set to `true`, ensuring the token is inaccessible to client-side JavaScript.

**Validates: Requirements 2.3**

### Property 5: Token Expiration Consistency

*For any* JWT token created by the system, the token's `exp` claim SHALL equal the `iat` claim plus exactly 604800 seconds (7 days), and this expiration SHALL be enforced during validation.

**Validates: Requirements 1.3**

### Property 6: Protected Route Access Control

*For any* request to a route under `/app/*`, if no valid session exists in `locals.session`, the system SHALL redirect the request to `/login` with a 303 status code.

**Validates: Requirements 1.6, 5.2**

### Property 7: Logout Cookie Clearing

*For any* logout request to `/api/logout`, the system SHALL clear the `auth_token` cookie by setting its expiration date to a past time, and subsequent requests SHALL NOT have a valid session.

**Validates: Requirements 1.5**

### Property 8: Rate Limit Enforcement

*For any* sequence of login attempts that exceeds the rate limit (e.g., 5 attempts per minute), the system SHALL reject subsequent attempts with a 429 status code until the rate limit window resets.

**Validates: Requirements 2.5**

### Property 9: Environment Variable Requirements

*For any* authentication operation (login, session validation, token creation), if required environment variables (`AUTH_SECRET`, `AUTH_USERNAME`, `AUTH_PASSWORD_HASH`) are missing, the system SHALL return a 500 error with a descriptive message.

**Validates: Requirements 6.1, 6.2, 6.3**

### Property 10: Password Hash Validation

*For any* login attempt with valid username, the system SHALL verify the provided password against the stored hash using bcrypt or argon2, and only create a token if verification succeeds.

**Validates: Requirements 2.1**

### Property 11: Session Persistence

*For any* authenticated session that has not expired, a page refresh or subsequent request within the session lifetime SHALL maintain the same session without requiring re-authentication.

**Validates: Requirements 5.5**

### Property 12: Spanish Error Messages

*For any* authentication error response, the error message SHALL be displayed in Spanish (es-AR) locale, using phrases like "Correo o contraseña incorrectos" for invalid credentials.

**Validates: Requirements 5.3**