# Requirements Document

## Introduction

This document specifies the requirements for replacing BetterAuth with a simpler JWT-based authentication system in the dental practice management application (Consultorio Dra. Laura).

The current BetterAuth implementation needs to be replaced with a minimal custom JWT system that maintains security while reducing dependencies. The application serves one dental practice with one dentist and one assistant who need secure access to patient information.

## Background

The application currently uses BetterAuth for authentication with:
- Email/password authentication stored in SQLite database
- Session management with 7-day expiry
- Rate limiting for security
- Integration with SvelteKit server routes

## Goals

1. Replace BetterAuth with a simpler JWT-based authentication
2. Maintain security while reducing dependencies
3. Keep the same user experience for staff
4. Store staff credentials in `.env` file (not in database)
5. Use httpOnly cookies for token storage

## Requirements

### Authentication Flow

- [ ] Staff can log in with username and password stored in `.env`
- [ ] Successful login creates an httpOnly cookie with JWT token
- [ ] Token expires after 7 days (604800 seconds)
- [ ] Failed login attempts show appropriate error message
- [ ] Logout clears the authentication cookie
- [ ] Unauthenticated requests are redirected to login page

### Security Requirements

- [ ] Passwords are hashed using bcrypt or argon2
- [ ] JWT tokens are signed with a secret from `.env`
- [ ] Tokens are stored in httpOnly cookies (not accessible to JavaScript)
- [ ] Tokens have a 7-day expiration
- [ ] No tokens are exposed to client-side code
- [ ] Rate limiting applies to login attempts

### Database Changes

- [ ] Remove BetterAuth-related database tables (user, session, account, verification)
- [ ] Keep staff credentials in `.env` file only
- [ ] Remove database dependency for authentication

### API Endpoints

- [ ] POST `/api/login` - Authenticate staff and set httpOnly cookie
- [ ] POST `/api/logout` - Clear authentication cookie
- [ ] GET `/api/session` - Verify current session (internal use)

### User Experience

- [ ] Login page remains at `/login`
- [ ] Staff interface at `/app` requires authentication
- [ ] Error messages shown in Spanish
- [ ] Loading states during authentication
- [ ] "Sign out" button works correctly

### Environment Variables

- [ ] `AUTH_SECRET` - JWT signing secret
- [ ] `AUTH_USERNAME` - Staff login username
- [ ] `AUTH_PASSWORD_HASH` - bcrypt/argon2 hashed password

## Non-Requirements

- [ ] Password reset functionality
- [ ] Email verification
- [ ] Multi-factor authentication
- [ ] Social login
- [ ] Session revocation (except logout)
- [ ] Password complexity requirements
- [ ] Account lockout after failed attempts
- [ ] User registration

## Out of Scope

- Patient authentication (patients don't log in)
- Role-based access control (only one staff role)
- OAuth integration
- Single sign-on
- Mobile app authentication