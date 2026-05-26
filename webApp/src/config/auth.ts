/**
 * Authentication config (injected at build time).
 *
 * REQUIRE_AUTH: whether login authentication is enabled.
 * - true: user app — shows the login page when not authenticated.
 * - false: sys app — skips the login page and goes straight to the main UI.
 *
 * Controlled by the VITE_REQUIRE_AUTH env variable and baked into the build artifact.
 * Defaults to true (secure by default).
 *
 * @see .env      - default user mode
 * @see .env.sys  - sys mode
 */
export const REQUIRE_AUTH = import.meta.env.VITE_REQUIRE_AUTH !== 'false';
