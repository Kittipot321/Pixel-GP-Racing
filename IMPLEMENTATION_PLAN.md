# Pixel Race — Implementation Plan

## 1. Project Overview

**Project Name:** Pixel Race

**Project Type:** Web-based Pixel Art Racing Prediction Game

**Goal:** Build a browser game where players predict which of four colored cars will finish first. The game randomly determines the winner, animates the race, and awards points based on the prediction.

### Core Gameplay

1. Players register or log in.
2. Players select one of four cars: Red, Yellow, Blue, or White.
3. Players submit their prediction before the race starts.
4. The server determines the winner randomly.
5. Phaser animates all four cars racing toward the finish line.
6. The server validates the prediction and awards points.
7. Players view their scores, game history, and leaderboard.

### Scoring Rules

- Correct prediction: +1 point.
- Incorrect prediction: 0 points.
- Each player can submit only one prediction per race.
- Each race can be settled only once.
- The backend is the source of truth for race results and scores.

### Initial Scope

- Single-player gameplay with shared online leaderboard.
- Account registration and login.
- Top-down 2D pixel-art racing.
- Four fixed car colors.
- Random winner selection with equal probability.
- Persistent scores and race history.
- Responsive web interface.
- No real-money betting, payments, or prizes.
- No multiplayer real-time racing in the initial release.

---

## 2. Technology Stack

### Frontend

- React
- TypeScript
- Vite
- Phaser 3
- React Router
- TanStack Query
- CSS Modules or plain CSS
- Vitest
- React Testing Library

### Backend

- Node.js
- TypeScript
- Fastify
- Zod for request validation
- JWT-based authentication
- Argon2id for password hashing
- Drizzle ORM
- SQLite
- Vitest
- Fastify `inject()` for API integration tests

### Development Tools

- npm Workspaces
- ESLint
- Prettier
- Git
- GitHub Actions
- Environment variables for configuration

### Architecture Decisions

- Use a monorepo containing separate frontend and backend applications.
- Use a modular monolith for the backend.
- Keep game rendering separate from React UI.
- Keep business logic independent of HTTP handlers and database implementations.
- Use database migrations to manage schema changes.
- Never trust client-provided scores or winner declarations.
- Do not introduce Redis, WebSockets, or microservices unless future requirements justify them.

---

## 3. Repository Structure

Create the following structure:

```text
pixel-race/
├── apps/
│   ├── web/
│   │   ├── public/
│   │   │   └── assets/
│   │   │       ├── cars/
│   │   │       ├── tracks/
│   │   │       ├── effects/
│   │   │       └── audio/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   ├── race/
│   │   │   │   ├── leaderboard/
│   │   │   │   └── profile/
│   │   │   ├── game/
│   │   │   │   ├── scenes/
│   │   │   │   ├── objects/
│   │   │   │   ├── events/
│   │   │   │   └── config/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   ├── services/
│   │   │   ├── styles/
│   │   │   ├── types/
│   │   │   └── main.tsx
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── api/
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── users/
│       │   │   ├── races/
│       │   │   ├── guesses/
│       │   │   └── leaderboard/
│       │   ├── plugins/
│       │   ├── shared/
│       │   ├── config/
│       │   ├── app.ts
│       │   └── server.ts
│       ├── tests/
│       │   ├── unit/
│       │   └── integration/
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   └── shared-types/
│       ├── src/
│       └── package.json
│
├── database/
│   ├── schema.ts
│   ├── migrations/
│   └── seeds/
│
├── .github/
│   └── workflows/
│       └── ci.yml
├── .env.example
├── .gitignore
├── package.json
├── IMPLEMENTATION_PLAN.md
└── README.md
```

Adjust the structure when necessary, but keep clear boundaries between frontend, backend, shared types, and database migrations.

---

## 4. Domain Model and Database Design

Use SQLite with Drizzle ORM.

### Users

Fields:

- `id`: UUID or equivalent stable identifier.
- `username`: unique username.
- `email`: unique email address.
- `passwordHash`: Argon2id password hash.
- `createdAt`: creation timestamp.
- `updatedAt`: last update timestamp.

Never store plaintext passwords.

### Races

Fields:

- `id`: unique race identifier.
- `status`: `OPEN`, `RUNNING`, or `SETTLED`.
- `winnerColor`: nullable until the result is disclosed.
- `createdAt`: creation timestamp.
- `startedAt`: nullable start timestamp.
- `settledAt`: nullable settlement timestamp.

Store race timing and lifecycle information consistently in UTC.

### Guesses

Fields:

- `id`: unique guess identifier.
- `raceId`: foreign key to `races`.
- `userId`: foreign key to `users`.
- `guessedColor`: `RED`, `YELLOW`, `BLUE`, or `WHITE`.
- `isCorrect`: nullable until settlement.
- `pointsAwarded`: nullable until settlement.
- `createdAt`: submission timestamp.

Add a unique constraint on `(raceId, userId)`.

### Score Ledger

Fields:

- `id`: unique record identifier.
- `raceId`: foreign key to `races`.
- `userId`: foreign key to `users`.
- `points`: integer.
- `createdAt`: record timestamp.

Add a unique constraint on `(raceId, userId)`.

Only award non-negative integer points according to the scoring rules.

### Database Requirements

- Enable SQLite foreign-key enforcement.
- Use appropriate indexes for leaderboard and race-history queries.
- Use transactions for race settlement and score recording.
- Use migrations instead of modifying production schemas manually.
- Store the SQLite database on persistent storage in production.
- Define and test backup and restore procedures.
- Keep the database file outside publicly served frontend assets.

---

## 5. Backend Architecture

Organize the backend into modules with clear responsibilities.

### Auth Module

Responsibilities:

- Register accounts.
- Authenticate users.
- Hash and verify passwords.
- Issue and validate access tokens.
- Expose the current user's profile.
- Handle authentication errors consistently.

### Users Module

Responsibilities:

- Return the authenticated user's profile.
- Return personal statistics.
- Return the user's race history.

### Races Module

Responsibilities:

- Create a new race.
- Manage race lifecycle.
- Generate the authoritative winner.
- Return race information without leaking hidden results.
- Enforce valid state transitions.

### Guesses Module

Responsibilities:

- Accept a prediction for an open race.
- Validate the selected car color.
- Prevent duplicate guesses.
- Reject guesses after the race closes.
- Return the recorded prediction.

### Leaderboard Module

Responsibilities:

- Calculate total scores.
- Return paginated rankings.
- Support all-time and daily leaderboard periods.
- Use deterministic tie-breaking.

### Shared Backend Principles

- HTTP handlers should be thin.
- Business rules belong in application services.
- Database operations belong in repositories or data-access modules.
- Validate request bodies, parameters, and query strings.
- Use consistent error response formats.
- Never accept `winnerColor`, `isCorrect`, or `pointsAwarded` as authoritative client input.
- Never expose password hashes or authentication secrets.
- Use database constraints in addition to application-level validation.

---

## 6. Race Lifecycle and Fairness

Use the following lifecycle:

```text
OPEN
  |
  | Submit prediction
  v
OPEN
  |
  | Server closes prediction window
  v
RUNNING
  |
  | Animation completes and result is settled
  v
SETTLED
```

The race lifecycle must be enforced by the backend, not by frontend state alone.

### Winner Generation

1. Generate the winner using a server-side random selection.
2. Store the result in the database.
3. Keep the winner hidden from clients until settlement.
4. Ensure retrying requests cannot regenerate the winner.
5. Use the stored winner for every subsequent request for that race.

For a casual game, a server-side uniform random selection among the four colors is sufficient.

If the game later offers prizes or other valuable rewards, revisit the randomness, auditability, security, and applicable legal requirements.

### Prediction Submission

The backend must:

1. Authenticate the player.
2. Confirm the race accepts predictions.
3. Validate the color.
4. Insert the guess.
5. Enforce the unique constraint.
6. Return the saved guess.

### Race Settlement

The backend must:

1. Confirm that the race can be settled.
2. Read the stored winner.
3. Compare each guess with the winner.
4. Calculate either 1 or 0 points.
5. Update each guess's result.
6. Insert the score ledger record.
7. Mark the race as settled.
8. Commit all changes in a database transaction.

Settlement must be idempotent. Repeating the settlement request must not award duplicate points.

If concurrent requests attempt to settle the same race, database constraints and transaction logic must ensure that the score is awarded only once.

---

## 7. API Contract

Use a versioned API prefix:

`/api/v1`

### Authentication

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout` if using revocable sessions
- `GET /users/me`

### Races

- `POST /races`
- `GET /races/current`
- `GET /races/:raceId`
- `POST /races/:raceId/guesses`
- `POST /races/:raceId/settle` if settlement is exposed as an authenticated application operation.

The settlement endpoint must never trust the caller to provide the winner. Prefer a server-controlled transition or internal service operation where practical.

### Leaderboard

- `GET /leaderboard?period=all-time&page=1&pageSize=20`
- `GET /users/me/stats`
- `GET /users/me/history?page=1&pageSize=20`

### API Requirements

- Use appropriate HTTP status codes.
- Validate all incoming parameters.
- Return consistent error objects.
- Enforce authentication on protected endpoints.
- Add rate limiting to login, registration, and race-related operations.
- Configure CORS for known frontend origins.
- Document the API with OpenAPI.
- Add request IDs and structured logging.

Example successful guess response:

```json
{
  "raceId": "example-race-id",
  "guessedColor": "RED",
  "status": "accepted"
}
```

Do not expose the winner in this response before the result is disclosed.

---

## 8. Frontend Architecture

### Application Pages

#### Login and Registration

- Registration form.
- Login form.
- Validation messages.
- Loading and error states.
- Protected-route handling.

#### Game Page

- Pixel-art racing track.
- Four horizontal lanes.
- Four colored cars.
- Finish line.
- Countdown and race status.
- Car-selection controls.
- Submit-prediction button.
- Race-result panel.
- Current score.

#### Leaderboard Page

- Ranked player list.
- Username.
- Total points.
- Number of races played.
- Number of correct predictions.
- Pagination.
- All-time and daily filters.

#### Profile Page

- Username.
- Total points.
- Total races.
- Correct predictions.
- Accuracy percentage.
- Recent race history.

### React and Phaser Integration

- Create a dedicated React component that owns the Phaser game instance.
- Initialize Phaser only when the game container is mounted.
- Destroy the Phaser instance and unregister event listeners when the component unmounts.
- Keep game rendering and animation state inside Phaser.
- Keep authentication, server data, and page navigation in React.
- Use TanStack Query for server-state fetching, caching, and invalidation.
- Use typed events or callbacks to communicate between Phaser and React.
- Do not allow Phaser to modify scores independently.
- Handle browser resize and device-pixel-ratio changes.
- Disable repeated prediction submissions while a request is pending.

### Game Assets

- Use original or appropriately licensed pixel-art assets.
- Start with placeholder sprites if custom assets are not ready.
- Prefer small sprites such as 32×32 or 48×48 pixels.
- Use nearest-neighbor scaling to preserve pixel edges.
- Add subtle engine, dust, and victory effects after the core gameplay works.

---

## 9. Animation Implementation

Use Phaser 3 and Tween-based movement.

### Race Scene

Responsibilities:

- Load the track and car sprites.
- Render four horizontal lanes.
- Place each car at the starting position.
- Display the finish line.
- Animate the countdown.
- Move the cars.
- Trigger the finish event.
- Display the final winner.

### Animation Rules

- All cars start at the same time.
- All cars move toward the finish line.
- The winner must match the server's stored result.
- The animation must never independently choose the winner.
- Use different speed curves and small variations to make the race visually interesting.
- Keep the winner visibly ahead near the finish.
- Avoid excessive randomness that makes the race outcome visually inconsistent with the server result.
- Handle skipped frames, browser-tab changes, and animation cleanup.
- Allow the game to recover if the animation finishes but the settlement request fails.

### Recommended Race Sequence

1. Show the prediction phase.
2. Lock the selected prediction when submitted.
3. Show a short countdown.
4. Start the race animation.
5. Animate the cars to the finish line.
6. Reveal the winning color.
7. Submit or confirm settlement through the backend.
8. Show the awarded points.
9. Allow the next race after the previous race is settled.

---

## 10. Security Requirements

- Use Argon2id or another appropriately configured password-hashing algorithm.
- Never store plaintext passwords.
- Never commit `.env` files or secrets.
- Validate JWT signatures, issuer, audience, and expiration.
- Use secure token storage and an appropriate session strategy.
- Consider HttpOnly, Secure, SameSite cookies if using cookie-based authentication.
- Protect cookie-authenticated requests against CSRF.
- Enforce authorization for user-specific data.
- Prevent SQL injection by using parameterized queries and ORM-supported operations.
- Rate-limit authentication endpoints.
- Enforce database uniqueness constraints.
- Prevent duplicate score awards.
- Do not trust client-provided race results.
- Do not expose the SQLite file through static file hosting.
- Use HTTPS in production.
- Keep dependencies updated and scan for known vulnerabilities.

For JWT-based authentication, prefer short-lived access tokens and a deliberate refresh or reauthentication strategy. Do not place long-lived secrets in browser local storage without evaluating the security trade-offs.

---

## 11. Testing Strategy

### Unit Tests

Test:

- Uniform winner selection.
- Valid and invalid car colors.
- Correct prediction awards 1 point.
- Incorrect prediction awards 0 points.
- Race state transitions.
- Leaderboard ordering.
- Accuracy calculation.
- Duplicate-settlement protection.

### Integration Tests

Test:

- Registration and login.
- Protected API endpoints.
- Race creation and result persistence.
- Prediction submission.
- Duplicate predictions.
- Submission after a race closes.
- Race settlement in a transaction.
- Concurrent settlement attempts.
- Leaderboard pagination.
- Foreign-key enforcement.

### Frontend Tests

Test:

- Login and registration validation.
- Car selection.
- Prediction submission.
- Loading and error states.
- Result display.
- Leaderboard rendering.
- Phaser instance cleanup.
- Game behavior when API requests fail.

### End-to-End Tests

Use Playwright to verify:

1. Register a new user.
2. Log in.
3. Open the game.
4. Select a car.
5. Submit a prediction.
6. Watch the animation.
7. View the result.
8. Confirm the score is correct.
9. Open the leaderboard.
10. Reload the page and verify the score persists.

---

## 12. Implementation Phases

Implement one phase at a time. Do not move to the next phase until its acceptance criteria pass.

### Phase 0 — Project Setup

Tasks:

- Initialize the monorepo.
- Configure npm Workspaces.
- Create React/Vite frontend.
- Create Fastify backend.
- Configure TypeScript.
- Add ESLint and Prettier.
- Configure environment variables.
- Add basic health endpoint.
- Add initial README.

Acceptance criteria:

- Frontend starts successfully.
- Backend starts successfully.
- TypeScript checks pass.
- Linting passes.
- Health endpoint returns success.
- No secrets are committed.

### Phase 1 — Database and Domain

Tasks:

- Configure SQLite.
- Configure Drizzle ORM.
- Define tables and relations.
- Add migrations.
- Add foreign keys and unique constraints.
- Add development seed scripts.
- Implement domain types and validation schemas.

Acceptance criteria:

- Migrations run on a clean database.
- Tables and constraints are correct.
- Invalid colors are rejected.
- Duplicate guesses cannot be inserted.
- Database persistence survives application restart.

### Phase 2 — Authentication

Tasks:

- Implement registration.
- Implement login.
- Hash passwords.
- Issue and validate access tokens.
- Implement current-user endpoint.
- Add frontend auth pages.
- Add protected routes.

Acceptance criteria:

- Users can register and log in.
- Invalid credentials are rejected.
- Passwords are hashed.
- Protected endpoints reject unauthenticated requests.
- User-specific endpoints do not expose other users' private information.

### Phase 3 — Race and Prediction APIs

Tasks:

- Implement race creation.
- Implement server-side winner generation.
- Store the hidden result.
- Implement prediction submission.
- Enforce race lifecycle.
- Prevent duplicate predictions.
- Implement safe settlement.
- Add transactional score recording.

Acceptance criteria:

- Every race has one stored winner.
- Winner information remains hidden before settlement.
- Each player can predict once per race.
- Correct guesses receive exactly 1 point.
- Incorrect guesses receive exactly 0 points.
- Repeated settlement cannot award duplicate points.

### Phase 4 — Pixel Race Game

Tasks:

- Create the game page.
- Integrate Phaser with React.
- Build the top-down track.
- Add four colored car sprites.
- Add the finish line.
- Implement countdown and race animation.
- Connect prediction submission.
- Display results and awarded points.
- Handle animation and network failures.

Acceptance criteria:

- All four cars render correctly.
- Cars animate toward the finish line.
- The visual winner matches the backend result.
- Repeated clicks cannot submit multiple guesses.
- Game resources are cleaned up when leaving the page.
- Results remain consistent after reloading the application.

### Phase 5 — Leaderboard and Profile

Tasks:

- Implement leaderboard queries.
- Add pagination.
- Add all-time and daily rankings.
- Implement player statistics.
- Implement race history.
- Create leaderboard and profile pages.

Acceptance criteria:

- Rankings match the persisted score data.
- Pagination works correctly.
- Ties use deterministic ordering.
- Player statistics are calculated correctly.
- Scores persist after restarting the backend.

### Phase 6 — Quality and Deployment

Tasks:

- Add unit and integration tests.
- Add Playwright end-to-end tests.
- Configure CI.
- Add production environment configuration.
- Deploy frontend and backend.
- Configure persistent storage for SQLite.
- Configure HTTPS and CORS.
- Set up logging and backups.
- Test database restoration.

Acceptance criteria:

- Automated tests pass in CI.
- Production build succeeds.
- Frontend can communicate with the deployed API.
- SQLite data persists across application restarts and redeployments.
- Backup restoration is verified.
- Authentication and score integrity checks pass.

---

## 13. Kiro IDE Workflow

Use Kiro to implement this plan incrementally.

### Step 1 — Add Steering Files

Create project guidance in `.kiro/steering/`.

Recommended files:

- `product.md`: product scope, gameplay, and business rules.
- `tech.md`: technology stack, architecture, coding conventions, and dependency rules.
- `structure.md`: repository layout and module boundaries.

Keep the steering files concise and consistent with this implementation plan.

### Step 2 — Create Feature Specifications

For each major feature, create a specification containing:

- Requirements.
- Acceptance criteria.
- Technical design.
- Implementation tasks.
- Test cases.

Recommended specifications:

1. Project foundation.
2. Database and authentication.
3. Race engine and predictions.
4. Pixel-art gameplay.
5. Leaderboard and player statistics.
6. Deployment and security.

### Step 3 — Implement in Small Tasks

For each task:

1. Ask Kiro to inspect the existing repository.
2. Ask it to implement only the current phase.
3. Review the generated code.
4. Run type checking and linting.
5. Run unit and integration tests.
6. Review database migrations and security-sensitive code.
7. Commit the working result.
8. Continue to the next task only after acceptance criteria pass.

Do not ask the agent to generate the entire application in a single prompt.

### Step 4 — Maintain the Plan

Update task status in the specification or implementation checklist. If requirements change, update the product and technical specifications before changing dependent code.

---

## 14. Definition of Done

The initial release is complete when:

- [ ] A user can register and log in.
- [ ] The game displays four pixel-art cars.
- [ ] A player can select one car and submit a prediction.
- [ ] The server randomly selects the winner.
- [ ] The animation displays the correct winner.
- [ ] Correct guesses earn 1 point.
- [ ] Incorrect guesses earn 0 points.
- [ ] Duplicate predictions and duplicate awards are prevented.
- [ ] The leaderboard displays persistent rankings.
- [ ] The user can view personal statistics and race history.
- [ ] The application works on desktop and mobile browsers.
- [ ] Automated tests cover critical business rules.
- [ ] Production data persists and can be restored from backup.
- [ ] Authentication and authorization checks pass.
- [ ] The application can be deployed using documented instructions.

**Final principle:** Prioritize correctness of race results, score integrity, and persistence before polishing animation effects or adding extra game modes.
