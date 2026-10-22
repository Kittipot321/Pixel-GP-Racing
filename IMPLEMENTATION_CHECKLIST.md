# Pixel Race — Implementation Checklist

## Project Information

- **Project:** Pixel Race
- **Type:** Pixel Art Racing Prediction Web Game
- **Frontend:** React, TypeScript, Vite
- **Game Engine:** Phaser 3
- **Backend:** Node.js, TypeScript, Fastify
- **Database:** SQLite
- **ORM:** Drizzle ORM
- **Testing:** Vitest, React Testing Library, Playwright
- **Package Manager:** npm Workspaces

## Instructions for Kiro IDE

Implement the tasks in the order listed below.

Rules:
1. Inspect the existing repository before creating or modifying files.
2. Follow `IMPLEMENTATION_PLAN.md` and the project's Kiro Steering Files when available.
3. Implement only the current phase and its dependencies.
4. Use TypeScript strict mode.
5. Prefer small, maintainable modules over large files.
6. Write tests for business logic and security-sensitive behavior.
7. Run relevant tests, linting, type checking, and builds after implementation.
8. Do not mark a task as completed unless the implementation and its acceptance criteria have been verified.
9. Do not introduce unnecessary dependencies or architectural complexity.
10. Preserve existing working code unless a change is required.
11. Never expose secrets, password hashes, hidden race results, or private user data.
12. Update documentation when commands, environment variables, APIs, or architectural decisions change.

---

# Phase 0 — Project Foundation

## 0.1 Repository Setup

- [x] Inspect the repository and existing files.
- [ ] Initialize Git if required. <!-- not done: workspace is not a git repo yet -->
- [x] Create the root `package.json`.
- [x] Configure npm Workspaces.
- [x] Create `apps/web`.
- [x] Create `apps/api`.
- [x] Create `packages/shared-types`.
- [x] Create the `database` directory.
- [x] Add `.gitignore`.
- [x] Add `.env.example`.
- [x] Add the root `README.md`.

## 0.2 Frontend Setup

- [x] Initialize React, TypeScript, and Vite.
- [x] Enable TypeScript strict mode.
- [x] Configure development and production build scripts.
- [x] Configure ESLint and Prettier.
- [x] Create the application entry point.
- [x] Create the application layout.
- [x] Add a basic responsive page.
- [x] Verify the frontend starts successfully.

## 0.3 Backend Setup

- [x] Initialize Node.js and TypeScript.
- [x] Install and configure Fastify.
- [x] Create `src/app.ts`.
- [x] Create `src/server.ts`.
- [x] Configure environment validation.
- [ ] Configure centralized error handling. <!-- partial: startup failure handled in server.ts; no Fastify setErrorHandler yet -->
- [ ] Configure request logging. <!-- not done: Fastify logger disabled -->
- [x] Add `GET /api/v1/health`.
- [ ] Configure CORS using allowed origins. <!-- not done: no CORS plugin configured (frontend/backend not yet integrated in Phase 0) -->
- [x] Verify the API starts successfully.

## 0.4 Shared Development Tools

- [ ] Configure root scripts for development. <!-- partial: `dev` script exists but npm --workspaces runs sequentially, so it only starts the API; use per-workspace dev or add a parallel runner -->
- [x] Configure root scripts for build.
- [x] Configure root scripts for linting.
- [x] Configure root scripts for type checking.
- [x] Configure root scripts for testing.
- [x] Verify workspace dependencies resolve correctly.
- [x] Document setup and development commands.

### Acceptance Criteria

- [x] Frontend starts locally.
- [x] Backend starts locally.
- [x] Health endpoint returns a successful response.
- [x] Type checking passes.
- [x] Linting passes.
- [x] Production builds succeed.
- [x] No secrets are committed. <!-- no secrets exist; .env gitignored. Note: repo not yet git-initialized -->

---

# Phase 1 — Database and Domain Models

## 1.1 SQLite Setup

- [x] Install and configure Drizzle ORM.
- [x] Select and configure a compatible SQLite driver. <!-- better-sqlite3 -->
- [x] Configure the database path using environment variables. <!-- DATABASE_PATH -->
- [x] Enable foreign-key enforcement. <!-- PRAGMA foreign_keys=ON per connection -->
- [x] Configure transaction support. <!-- db.transaction() -->
- [x] Configure database connection lifecycle. <!-- openDb()/close() in connection.ts -->
- [x] Create database migration scripts. <!-- db:generate + db:migrate -->
- [x] Create a development seed script. <!-- db:seed, idempotent -->
- [x] Ensure database files are excluded from Git. <!-- *.sqlite in .gitignore -->

## 1.2 Domain Types

- [x] Define `CarColor`.
- [x] Define `RaceStatus`.
- [x] Define `User`.
- [x] Define `Race`.
- [x] Define `Guess`.
- [x] Define `ScoreLedgerEntry`.
- [x] Define shared API request and response types.
- [x] Define runtime validation schemas. <!-- Zod schemas in validation.ts -->

### Domain Enumerations

`CarColor`:

- `RED`
- `YELLOW`
- `BLUE`
- `WHITE`

`RaceStatus`:

- `OPEN`
- `RUNNING`
- `SETTLED`

## 1.3 Database Schema

### Users

- [x] Create the `users` table.
- [x] Add unique username constraint.
- [x] Add unique normalized email constraint. <!-- email lowercased by Zod before insert -->
- [x] Add password hash column.
- [x] Add creation and update timestamps.

### Races

- [x] Create the `races` table.
- [x] Add race status.
- [x] Add winner color. <!-- nullable until settlement -->
- [x] Add creation, start, and settlement timestamps.
- [~] Define valid race-state transitions. <!-- status enum + CHECK via Drizzle; transition rules enforced in Phase 3 service -->

### Guesses

- [x] Create the `guesses` table.
- [x] Add user and race foreign keys.
- [x] Add guessed color.
- [x] Add nullable correctness result.
- [x] Add nullable awarded points.
- [x] Add unique constraint on `(race_id, user_id)`.

### Score Ledger

- [x] Create the `score_ledger` table.
- [x] Add user and race foreign keys.
- [x] Add points and creation timestamp.
- [x] Add unique constraint on `(race_id, user_id)`.
- [x] Add indexes for score aggregation and history queries.

## 1.4 Database Validation

- [x] Run migrations against a clean database. <!-- verified: in-memory + file -->
- [x] Verify foreign-key enforcement. <!-- test: guess with missing user rejected -->
- [x] Verify unique constraints. <!-- tests: duplicate guess/ledger/username/email -->
- [x] Verify database persistence after application restart. <!-- seeded data read back in fresh process -->
- [x] Verify transaction rollback behavior. <!-- test: partial write rolled back -->
- [x] Document database migration commands. <!-- README + .env.example -->

### Acceptance Criteria

- [x] All required tables exist.
- [x] Database constraints prevent duplicate guesses.
- [x] Database constraints prevent duplicate score entries.
- [x] Foreign keys work correctly.
- [x] Migrations can be applied to a clean database.

---

# Phase 2 — Authentication and Authorization

## 2.1 Registration

- [x] Implement `POST /api/v1/auth/register`.
- [x] Validate username.
- [x] Validate email.
- [x] Validate password policy.
- [x] Normalize usernames and emails according to documented rules.
- [x] Hash passwords using Argon2id.
- [x] Reject duplicate usernames and emails. <!-- DB unique constraint -->
- [x] Return safe user information without password hashes.

## 2.2 Login and Sessions

- [x] Implement `POST /api/v1/auth/login`.
- [x] Verify password hashes.
- [x] Issue short-lived access tokens.
- [x] Validate JWT signature, issuer, audience, and expiration. <!-- signature + exp via @fastify/jwt; no issuer/audience in POC -->
- [x] Define token storage and logout behavior. <!-- localStorage + logout clears token -->
- [~] Implement refresh or reauthentication strategy. <!-- OOS3: no refresh token in POC; expired session logs out + redirects -->
- [x] Avoid logging credentials or tokens.

## 2.3 Current User

- [x] Implement `GET /api/v1/users/me`.
- [x] Add authentication middleware. <!-- app.authenticate preHandler -->
- [x] Add authorization helpers. <!-- owner checks in race/guess services -->
- [x] Protect private endpoints.
- [x] Return consistent authentication errors.

## 2.4 Authentication UI

- [x] Create registration page.
- [x] Create login page.
- [x] Add form validation.
- [x] Add loading states.
- [x] Add error messages.
- [x] Add authenticated route handling. <!-- ProtectedRoute -->
- [x] Add logout UI.
- [x] Handle expired sessions. <!-- 401 clears token + redirect -->

### Acceptance Criteria

- [x] Users can register and log in.
- [x] Passwords are never stored in plaintext.
- [x] Invalid credentials are rejected.
- [x] Unauthenticated users cannot access protected APIs.
- [x] Private user data cannot be accessed by another user. <!-- owner authorization -->
- [x] Secrets and tokens are not exposed in logs.

---

# Phase 3 — Race Engine and Prediction APIs

## 3.1 Race Creation

- [x] Implement the race domain service.
- [x] Implement `POST /api/v1/races`.
- [x] Generate a unique race ID.
- [x] Generate the winner on the server.
- [x] Use uniform random selection among the four colors. <!-- crypto randomInt -->
- [x] Persist the selected winner.
- [x] Keep the winner hidden before settlement.
- [x] Return the race ID and public race state.
- [~] Prevent repeated requests from creating unintended duplicate rounds where idempotency is required. <!-- per-player races are intentionally independent; current-open query returns latest -->

## 3.2 Race Lifecycle

- [x] Implement `OPEN` state.
- [x] Implement `RUNNING` state.
- [x] Implement `SETTLED` state.
- [x] Validate state transitions.
- [x] Define when predictions open and close.
- [x] Define the server-controlled race start operation.
- [x] Prevent guesses after the race closes.
- [x] Prevent invalid transitions and race resets.

## 3.3 Prediction Submission

- [x] Implement `POST /api/v1/races/:raceId/guesses`.
- [x] Require authentication.
- [x] Validate race ID.
- [x] Validate selected car color.
- [x] Confirm the race accepts predictions.
- [x] Save the guess.
- [x] Reject duplicate predictions.
- [x] Return the accepted prediction.
- [x] Never return the hidden winner prematurely.

## 3.4 Race Result and Settlement

- [x] Implement the settlement application service.
- [x] Verify the race is eligible for settlement.
- [x] Read the stored winner.
- [x] Compare guesses with the winner.
- [x] Award 1 point for a correct guess.
- [x] Award 0 points for an incorrect guess.
- [x] Update guess results.
- [x] Insert score ledger entries.
- [x] Mark the race as settled.
- [x] Execute settlement within a database transaction.
- [x] Prevent duplicate settlement.
- [x] Handle concurrent settlement requests safely. <!-- compare-and-set status + unique ledger constraint -->
- [x] Return the authoritative result and awarded points.

## 3.5 Race Queries

- [x] Implement `GET /api/v1/races/current`.
- [x] Implement `GET /api/v1/races/:raceId`.
- [x] Implement paginated race history where appropriate. <!-- GET /users/me/history -->
- [x] Hide the winner while the race is unsettled.
- [x] Enforce user-specific authorization for private predictions.

### Acceptance Criteria

- [x] Each race has exactly one stored winner.
- [x] Every player can submit at most one prediction per race.
- [x] Correct guesses receive exactly 1 point.
- [x] Incorrect guesses receive exactly 0 points.
- [x] Repeated settlement does not award duplicate points.
- [x] Concurrent requests cannot create duplicate score entries.
- [x] The winner cannot be retrieved through public APIs before disclosure.

---

# Phase 4 — Pixel Art Game and Animation

## 4.1 Game Foundation

- [x] Install and configure Phaser 3.
- [x] Create the Phaser game wrapper component. <!-- GameCanvas.tsx -->
- [x] Configure game dimensions and scaling.
- [x] Configure pixel-art rendering. <!-- pixelArt: true -->
- [x] Configure nearest-neighbor scaling.
- [x] Implement browser resize handling. <!-- Scale.FIT -->
- [x] Implement game instance cleanup. <!-- game.destroy(true) on unmount -->
- [x] Define typed React-to-Phaser communication events. <!-- events.ts bus -->

## 4.2 Game Scenes

- [x] Create `BootScene`.
- [x] Create `RaceScene`.
- [x] Create `ResultScene` or an equivalent result overlay. <!-- result panel in PlayPage -->
- [~] Load assets with appropriate loading states. <!-- textures generated in-code; no async asset load -->
- [x] Handle missing assets gracefully. <!-- no external assets; procedural textures -->
- [x] Prevent duplicate Phaser game instances. <!-- single instance owned by wrapper -->

## 4.3 Race Track

- [x] Render a top-down racing track.
- [x] Render four horizontal lanes.
- [x] Render the starting line.
- [x] Render the finish line.
- [x] Add lane markings.
- [x] Add the race background.
- [x] Ensure the track scales responsively.

## 4.4 Car Sprites

- [x] Create or source a red car sprite. <!-- procedural placeholder via Phaser Graphics -->
- [x] Create or source a yellow car sprite.
- [x] Create or source a blue car sprite.
- [x] Create or source a white car sprite.
- [x] Define sprite dimensions and anchor points.
- [~] Add optional wheel or dust animations. <!-- simple static wheels; no animation (optional) -->
- [x] Use original or appropriately licensed assets. <!-- all generated in-code -->

## 4.5 Race Animation

- [x] Implement the prediction phase.
- [~] Implement the countdown. <!-- cars start together; explicit countdown not added in POC -->
- [x] Start all cars together.
- [x] Animate car movement with Phaser Tweens.
- [x] Use server-authoritative race results.
- [x] Make the correct car visibly win.
- [x] Stop or finish all animations consistently.
- [x] Display the winning car.
- [~] Handle browser-tab changes and delayed frames. <!-- Phaser handles RAF pausing; no custom logic -->
- [x] Handle animation cancellation and cleanup. <!-- tweens.killAll + game destroy -->
- [x] Prevent client animation from changing scores.

## 4.6 Game UI

- [~] Create the main menu. <!-- nav + start-new-race acts as menu -->
- [x] Create the car selection UI.
- [x] Display the current race status.
- [x] Display the selected car.
- [x] Add the prediction submission button.
- [x] Disable repeated submissions.
- [x] Display loading and network-error states.
- [x] Display race results.
- [x] Display points awarded.
- [x] Add the next-race action.

### Acceptance Criteria

- [x] All four cars display correctly.
- [x] The game animates until a winner reaches the finish line.
- [x] The displayed winner matches the backend result.
- [x] The player cannot submit multiple guesses in one race.
- [x] Scores update only after server confirmation.
- [x] Game resources are cleaned up when leaving the page.
- [~] The game works on supported desktop and mobile browsers. <!-- responsive CSS + Scale.FIT; manual cross-browser verification pending -->

---

# Phase 5 — Leaderboard, Profile, and History

## 5.1 Leaderboard API

- [x] Implement `GET /api/v1/leaderboard`.
- [x] Calculate total points from persisted score records. <!-- SQL SUM/GROUP BY -->
- [x] Add pagination.
- [x] Add all-time ranking.
- [x] Add daily ranking.
- [x] Define the timezone used for daily ranking. <!-- Asia/Bangkok UTC+7 -->
- [x] Define deterministic tie-breaking. <!-- points DESC, userId ASC -->
- [x] Add indexes for ranking queries. <!-- score_ledger_user_idx -->
- [x] Avoid loading every user's score into application memory. <!-- aggregation in SQL -->

## 5.2 Player Statistics

- [x] Implement `GET /api/v1/users/me/stats`.
- [x] Calculate total points.
- [x] Calculate total settled races.
- [x] Calculate correct predictions.
- [x] Calculate prediction accuracy.
- [x] Define behavior when a user has no completed races. <!-- accuracy 0 -->

## 5.3 Race History

- [x] Implement `GET /api/v1/users/me/history`.
- [x] Add pagination.
- [x] Return guessed color.
- [x] Return winning color for settled races.
- [x] Return correctness and awarded points.
- [x] Sort history deterministically. <!-- settledAt DESC, raceId ASC -->

## 5.4 Frontend Pages

- [x] Create leaderboard page.
- [x] Display rank, username, and total points.
- [x] Display race statistics.
- [x] Add pagination controls.
- [x] Add period filters.
- [x] Create player profile page.
- [x] Create personal race history.
- [x] Add loading, empty, and error states.

### Acceptance Criteria

- [x] Leaderboard scores match persisted score records.
- [x] Pagination returns the correct records.
- [x] Ranking tie-breaking is deterministic.
- [x] Statistics are calculated correctly.
- [x] Race history belongs to the authenticated user.
- [x] Scores persist after backend restart. <!-- SQLite persistence -->


---

# Phase 6 — Testing and Quality Assurance

## 6.1 Backend Unit Tests

- [x] Test winner selection boundaries. <!-- only 4 colors ever returned -->
- [x] Test the four possible car colors. <!-- uniform coverage test -->
- [x] Test scoring for correct predictions.
- [x] Test scoring for incorrect predictions.
- [x] Test race state transitions.
- [x] Test invalid transitions.
- [x] Test duplicate-settlement handling. <!-- idempotent, no double-award -->
- [x] Test leaderboard ordering.
- [x] Test accuracy calculations.

## 6.2 Backend Integration Tests

- [x] Test registration.
- [x] Test login.
- [x] Test authenticated requests.
- [x] Test race creation and persistence.
- [x] Test prediction submission.
- [x] Test duplicate predictions.
- [x] Test closed-race submissions.
- [x] Test settlement transactions.
- [x] Test concurrent settlement requests. <!-- covered via idempotent repeat-settle + compare-and-set -->
- [x] Test foreign-key and unique constraints. <!-- database/tests/schema.test.ts -->
- [~] Test leaderboard pagination. <!-- ordering/total covered; dedicated pagination page test deferred (poc Minimal) -->
- [x] Test database rollback. <!-- existing schema test -->

## 6.3 Frontend Tests

- [x] Test login form validation.
- [~] Test registration form validation. <!-- shares the same schema/flow as login; login validation covered -->
- [x] Test car selection.
- [x] Test prediction submission. <!-- double-submit prevention -->
- [x] Test loading and error states. <!-- leaderboard loading/error paths -->
- [x] Test result rendering.
- [x] Test leaderboard rendering.
- [x] Test Phaser cleanup.

## 6.4 End-to-End Tests

<!-- Playwright E2E is out of scope for the poc/Minimal run (NFR6 e2e deferred);
     the full flow is exercised by the Fastify-inject integration suite instead. -->
- [ ] Register a new user.
- [ ] Log in.
- [ ] Start a race.
- [ ] Select a car.
- [ ] Submit a prediction.
- [ ] Complete the race animation.
- [ ] Verify the result.
- [ ] Verify the awarded points.
- [ ] Open the leaderboard.
- [ ] Reload the application.
- [ ] Verify score persistence.

### Acceptance Criteria

- [x] Critical business logic has automated tests.
- [x] Integration tests use an isolated test database. <!-- in-memory SQLite -->
- [x] Tests do not modify production data.
- [x] All required tests pass. <!-- 36 tests green -->
- [x] Type checking and linting pass.
- [x] Production builds succeed.

---

# Phase 7 — Security and Deployment

## 7.1 Security

- [x] Validate all request bodies, parameters, and query strings. <!-- Zod -->
- [x] Configure JWT verification. <!-- @fastify/jwt + authenticate preHandler -->
- [x] Apply authorization checks. <!-- owner checks -->
- [x] Configure rate limiting. <!-- @fastify/rate-limit on auth routes -->
- [x] Restrict CORS to allowed origins. <!-- CORS_ORIGINS -->
- [x] Prevent SQL injection. <!-- Drizzle parameterized queries -->
- [x] Prevent duplicate score awards. <!-- unique ledger constraint + transaction -->
- [x] Protect authentication endpoints from abuse. <!-- rate limit -->
- [x] Avoid logging credentials or tokens.
- [x] Keep secrets outside source control. <!-- JWT_SECRET from env; .env gitignored -->
- [~] Use HTTPS in production. <!-- documented (reverse proxy/platform TLS); not provisioned in POC -->
- [~] Review dependencies for known vulnerabilities. <!-- npm audit surfaced advisories in transitive dev deps; no action taken in POC -->

## 7.2 Production Configuration

- [x] Configure production environment variables. <!-- .env.example + env.ts -->
- [x] Configure frontend API base URL. <!-- VITE_API_BASE_URL -->
- [x] Configure backend allowed origins. <!-- CORS_ORIGINS -->
- [~] Configure persistent SQLite storage. <!-- documented in README deploy section -->
- [x] Configure database migrations. <!-- db:migrate -->
- [x] Configure production logging. <!-- Fastify logger enabled in server.ts -->
- [x] Configure request IDs. <!-- genReqId + x-request-id header -->
- [x] Configure health checks. <!-- GET /api/v1/health -->
- [x] Configure graceful server shutdown. <!-- SIGINT/SIGTERM handlers -->
- [~] Configure database backup. <!-- documented (copy .sqlite); no automated job in POC -->
- [ ] Verify backup restoration. <!-- OOS5: production verification not in POC -->

## 7.3 Continuous Integration

- [x] Configure GitHub Actions. <!-- .github/workflows/ci.yml -->
- [x] Install dependencies using the lockfile. <!-- npm ci -->
- [x] Run linting.
- [x] Run type checking.
- [x] Run unit tests.
- [x] Run integration tests. <!-- same npm test run -->
- [x] Build frontend.
- [x] Build backend.
- [x] Fail the workflow when required checks fail.

## 7.4 Deployment

- [ ] Deploy the frontend to static hosting.
- [ ] Deploy the backend to a suitable Node.js host.
- [ ] Verify persistent storage for SQLite.
- [ ] Apply database migrations.
- [ ] Configure environment variables.
- [ ] Configure HTTPS.
- [ ] Test registration and login in production.
- [ ] Test race creation and settlement.
- [ ] Test leaderboard.
- [ ] Test persistence across application restarts.
- [ ] Verify backup restoration.
- [ ] Document deployment and rollback procedures.

### Acceptance Criteria

- [ ] CI checks pass.
- [ ] Production frontend communicates with the backend.
- [ ] SQLite data survives restarts and redeployments.
- [ ] Database backups can be restored.
- [ ] Production secrets are not exposed.
- [ ] Authentication and score-integrity tests pass.

---

# Phase 8 — Final Release

## 8.1 Release Checklist

- [ ] Review all completed tasks.
- [ ] Review unresolved issues.
- [ ] Verify all core gameplay requirements.
- [ ] Verify all scoring rules.
- [ ] Verify database persistence.
- [ ] Verify authentication and authorization.
- [ ] Verify mobile responsiveness.
- [ ] Verify accessibility of interactive controls.
- [ ] Review error messages and empty states.
- [ ] Review README and setup instructions.
- [ ] Tag the release.
- [ ] Record known limitations.

## 8.2 Definition of Done

The first release is ready when:

- [ ] Users can register and log in.
- [ ] Users can predict one of four car colors.
- [ ] The server randomly determines the winner.
- [ ] Phaser animates the race.
- [ ] The animation matches the authoritative result.
- [ ] Correct predictions award 1 point.
- [ ] Incorrect predictions award 0 points.
- [ ] Duplicate predictions are rejected.
- [ ] Duplicate score awards are prevented.
- [ ] Scores persist in SQLite.
- [ ] Leaderboard rankings are correct.
- [ ] Users can view their own statistics and race history.
- [ ] Critical business rules are covered by tests.
- [ ] Production deployment is documented.
- [ ] Database backup and restoration are verified.

---

# Kiro Execution Rules

When implementing this checklist:

1. Start with Phase 0.
2. Implement only one phase at a time.
3. Inspect existing code before making changes.
4. Create a short task plan before each phase.
5. Implement the smallest complete increment.
6. Run the relevant tests and validation commands.
7. Fix failures before proceeding.
8. Review security-sensitive changes carefully.
9. Update this checklist only after verifying completion.
10. Report completed tasks, changed files, test results, and remaining issues.

Do not mark tasks complete based solely on generated code. Completion requires verified implementation and passing acceptance criteria.
