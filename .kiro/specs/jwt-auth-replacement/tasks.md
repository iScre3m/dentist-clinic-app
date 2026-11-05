# Implementation Plan: JWT Authentication Replacement

## Overview

This task plan replaces BetterAuth with a simpler JWT-based authentication system. The implementation will store staff credentials in environment variables, use JWT tokens in httpOnly cookies, and maintain the same user experience for staff.

## Tasks

- [x] 1. Environment Setup
  - [x] 1.1 Update `.env.example` with new authentication variables
    - Add `AUTH_SECRET`, `AUTH_USERNAME`, and `AUTH_PASSWORD_HASH` variables
    - Provide clear descriptions for each variable
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [x] 1.2 Create environment validation schema
    - Create `src/lib/server/auth/env-schema.ts` using Valibot
    - Validate `AUTH_SECRET` (minimum 32 characters)
    - Validate `AUTH_USERNAME` (email format)
    - Validate `AUTH_PASSWORD_HASH` (bcrypt format)
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 2. Install Dependencies
  - [x] 2.1 Install jsonwebtoken library
    - Run `pnpm add jsonwebtoken`
    - _Requirements: 2.2_
  
  - [x] 2.2 Install bcryptjs for password hashing
    - Run `pnpm add bcryptjs`
    - _Requirements: 2.1_

- [x] 3. Implement Auth Service Modules
  - [x] 3.1 Create JWT service (`src/lib/server/auth/jwt.ts`)
    - Implement `createToken()` function
    - Implement `verifyToken()` function
    - Implement `isTokenExpired()` function
    - Set 7-day expiration (604800 seconds)
    - _Requirements: 2.2, 3.1_
  
  - [x] 3.2 Create cookie service (`src/lib/server/auth/cookies.ts`)
    - Implement `setAuthCookie()` function
    - Implement `clearAuthCookie()` function
    - Implement `getAuthCookie()` function
    - Configure httpOnly, secure, sameSite, maxAge options
    - _Requirements: 2.3, 2.4, 5.1_
  
  - [x] 3.3 Create main auth service (`src/lib/server/auth/index.ts`)
    - Export JWT and cookie functions
    - Implement `authenticate()` function for login
    - Implement session validation logic
    - _Requirements: 4.1, 4.3_

- [x] 4. Implement API Endpoints
  - [x] 4.1 Create `/api/login` endpoint (`src/routes/api/login/+server.ts`)
    - Accept username and password from request body
    - Validate required fields
    - Verify credentials against environment variables
    - Create JWT token on success
    - Set httpOnly cookie with token
    - Return appropriate error responses
    - _Requirements: 4.1, 5.1_
  
  - [x] 4.2 Create `/api/logout` endpoint (`src/routes/api/logout/+server.ts`)
    - Clear auth_token cookie
    - Return success response
    - _Requirements: 4.2, 5.1_
  
  - [x] 4.3 Create `/api/session` endpoint (`src/routes/api/session/+server.ts`)
    - Read auth_token from cookie
    - Verify token validity
    - Return session user info
    - Return 401 for invalid tokens
    - _Requirements: 4.3, 5.1_

  - [x] 4.4 Add rate limiting to login endpoint
    - Implement simple rate limiting (5 attempts per minute)
    - Track failed attempts per IP or username
    - Return 429 status when limit exceeded
    - _Requirements: 2.5_

- [x] 5. Update SvelteKit Hooks
  - [x] 5.1 Update `hooks.server.ts`
    - Replace BetterAuth session handler with JWT handler
    - Extract JWT from auth_token cookie
    - Validate token and attach session to `locals`
    - Handle unauthenticated requests
    - _Requirements: 5.2_
  
  - [x] 5.2 Update `app.d.ts` type definitions
    - Update `App.Locals` interface for JWT session
    - Add session type with user object and expiresAt
    - _Requirements: 5.2_

- [x] 6. Update Login Page
  - [x] 6.1 Update login page server load (`src/routes/login/+page.server.ts`)
    - Replace BetterAuth client initialization with form action
    - Implement login form action that posts to `/api/login`
    - Handle error messages from authentication
    - Show loading state during authentication
    - _Requirements: 5.1, 5.4_
  
  - [x] 6.2 Update login page UI (`src/routes/login/+page.svelte`)
    - Keep existing form structure
    - Ensure error messages display in Spanish
    - Add loading state during submission
    - _Requirements: 5.1, 5.4_

- [x] 7. Protect App Routes
  - [x] 7.1 Create layout server load (`src/routes/(app)/+layout.server.ts`)
    - Check for valid session in `locals`
    - Redirect to `/login` if no session
    - Return user info for the layout
    - _Requirements: 5.2_
  
  - [x] 7.2 Update existing app pages to use new auth
    - Verify all pages check session correctly
    - Update form actions to handle auth errors
    - _Requirements: 5.2_

- [x] 8. Database Migration
  - [x] 8.1 Create migration file to drop BetterAuth tables
    - Drop `verification`, `account`, `session`, and `user` tables
    - _Requirements: 3.1_
  
  - [x] 8.2 Update database schema
    - Remove BetterAuth table definitions from `src/lib/server/db/schema.ts`
    - Keep other tables (patients, appointments, etc.)
    - _Requirements: 3.1_
  
  - [x] 8.3 Run migration and verify
    - Run `pnpm drizzle-kit generate`
    - Run `pnpm drizzle-kit migrate`
    - Verify tables are dropped
    - _Requirements: 3.1_

- [x] 9. Cleanup BetterAuth Dependencies
  - [x] 9.1 Remove BetterAuth from package.json
    - Remove `@better-auth/sveltekit` dependency
    - Run `pnpm install`
    - _Requirements: N/A_
  
  - [x] 9.2 Remove BetterAuth client code
    - Delete `src/lib/auth-client.ts`
    - Delete `src/routes/api/auth/[...all]/` directory
    - _Requirements: N/A_
  
  - [x] 9.3 Update import statements
    - Remove BetterAuth imports from other files
    - Replace with new auth service imports
    - _Requirements: N/A_

- [x] 10. Staff Credential Management
  - [x] 10.1 Create staff update script (`scripts/staff-update.ts`)
    - Update staff username in `.env`
    - Regenerate password hash
    - Provide clear instructions for use
    - _Requirements: N/A_

- [ ] 11. Testing
  - [x] 11.1 Write unit tests for auth modules
    - Test JWT token creation with correct payload
    - Test JWT token validation (signature, expiration)
    - Test cookie configuration (httpOnly, secure, etc.)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 11.2 Write integration tests for API endpoints
    - Test login with valid credentials
    - Test login with invalid credentials
    - Test logout clears cookie
    - Test session verification
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 11.3 Write property tests for correctness properties
    - **Property 1: Session Validation** - Validate JWT tokens in cookies
    - **Property 2: Expired Token Rejection** - Reject expired tokens
    - **Property 3: Invalid Token Rejection** - Reject tampered tokens
    - **Property 4: Cookie HttpOnly Flag** - Verify httpOnly setting
    - **Property 5: Token Expiration Consistency** - Verify 7-day expiration
    - **Property 6: Protected Route Access Control** - Redirect unauthenticated requests
    - **Property 7: Logout Cookie Clearing** - Clear cookie on logout
    - **Property 8: Rate Limit Enforcement** - Block excessive attempts
    - **Property 9: Environment Variable Requirements** - Validate env vars exist
    - **Property 10: Password Hash Validation** - Verify bcrypt verification
    - **Property 11: Session Persistence** - Maintain sessions across requests
    - **Property 12: Spanish Error Messages** - Display errors in Spanish
    - _Requirements: All properties in design.md_

  - [x] 11.4 Write end-to-end tests
    - Test full login flow
    - Test failed login handling
    - Test logout flow
    - Test session persistence
    - Test protected routes
    - _Requirements: 5.1, 5.2, 5.3_

- [ ] 12. Documentation and Verification
  - [x] 12.1 Update environment documentation
    - Document new auth variables in `.env.example`
    - Add instructions for setting up credentials
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 12.2 Verify all tests pass
    - Run unit tests — 12 files, 100 tests passed
    - Run integration tests — included in vitest run
    - Run property tests — included in `auth/property.test.ts`
    - Run E2E tests — 37 tests passed via Playwright
    - _Requirements: N/A_

  - [x] 12.3 Test manual scenarios
    - Login with valid credentials — redirects to /dashboard ✅
    - Login with invalid credentials — shows "Correo o contraseña incorrectos." in Spanish, stays on login page ✅
    - Logout functionality — clicking "Salir" clears session and redirects to /login ✅
    - Protected routes redirect — unauthenticated access to /dashboard, /pacientes, /follow-ups all 303→/login ✅
    - Token expiration behavior — expired JWT rejected by /api/session with 401 "No autorizado"; no-cookie requests to protected routes get 303→/login ✅
    - _Requirements: 1.1, 1.4, 1.5_

- [ ] 13. Final Checkpoint
  - [x] 13.1 Ensure all tests pass
    - Verify unit, integration, property, and E2E tests pass
    - Fix any failing tests
    - _Requirements: N/A_

  - [x] 13.2 Verify implementation meets all requirements
    - Review all requirements checklist
    - Ensure all environment variables are documented
    - Confirm BetterAuth is completely removed
    - _Requirements: All requirements_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1", "2.2"] },
    { "id": 1, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 2, "tasks": ["4.1", "4.2", "4.3", "4.4"] },
    { "id": 3, "tasks": ["5.1", "5.2"] },
    { "id": 4, "tasks": ["6.1", "6.2", "7.1", "7.2"] },
    { "id": 5, "tasks": ["8.1", "8.2", "8.3"] },
    { "id": 6, "tasks": ["9.1", "9.2", "9.3", "10.1"] },
    { "id": 7, "tasks": ["11.1", "11.2", "11.3", "11.4"] },
    { "id": 8, "tasks": ["12.1", "12.2", "12.3"] },
    { "id": 9, "tasks": ["13.1", "13.2"] }
  ]
}
```