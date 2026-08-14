import { requestJson, TokenStorage } from './httpClient';
import type { HttpRequestOptions } from './httpClient';
import { resolveApiPayload, resolveThrownErrorMessage } from '../utils/backendRequest';

/**
 * Issue an authentication request and reduce the response to its business payload.
 *
 * These endpoints previously used the response *as* the payload. That held only because they are still served
 * by the mock backend, which returns bare fixtures; the real backend wraps every controller return value in an
 * `ApiResponse`, so `data` is where the payload actually is. Reading `token` off the envelope would simply find
 * `undefined` — a silent login failure reported as "no token in the response", which names the symptom and
 * buries the cause.
 *
 * Failures arrive in two shapes and both are funnelled through the console's shared resolvers, so the user gets
 * a translated message either way rather than a raw i18n key:
 *
 * - **HTTP 200 with `success: false`** — a declined business rule, which is what a wrong password is. Handled
 *   by {@link resolveApiPayload}.
 * - **non-2xx** — `requestJson` throws `HttpResponseError`, whose message is the envelope's own, i.e. an
 *   unresolved key such as `sys.error-msg.default.401`.
 *
 * @param path endpoint path
 * @param options request options passed through to the HTTP client
 * @param fallbackMessage used when the failure carries no usable message
 * @returns the business payload, or null when the response carries none
 * @author K
 * @author AI: Claude
 * @since 1.0.0
 */
async function requestAuthPayload<T>(
  path: string,
  options: HttpRequestOptions,
  fallbackMessage: string,
): Promise<T | null> {
  let raw: unknown;
  try {
    raw = await requestJson<unknown>(path, options);
  } catch (error) {
    const resolved = await resolveThrownErrorMessage(error);
    throw resolved != null ? new Error(resolved) : error;
  }
  return resolveApiPayload<T>(raw, fallbackMessage);
}

export type LoginValidation = {
  usernameError: string | null;
  passwordError: string | null;
  totpError: string | null;
  isValid: () => boolean;
};

/**
 * Login request contract and client-side validation.
 *
 * @author K
 * @author AI: Codex
 * @since 1.0.0
 */
export class LoginRequest {
  constructor(
    readonly username: string,
    readonly password: string,
    readonly totpCode: string,
  ) {}

  validate(): LoginValidation {
    const usernameError = !this.username.trim()
      ? 'Please enter username'
      : this.username.length < 2
        ? 'Username must be at least 2 characters'
        : null;
    const passwordError = !this.password.trim()
      ? 'Please enter password'
      : this.password.length < 6
        ? 'Password must be at least 6 characters'
        : null;
    const totpError = !this.totpCode.trim()
      ? 'Please enter the Google Authenticator code'
      : !/^\d{6}$/.test(this.totpCode)
        ? 'Verification code must be 6 digits'
        : null;

    return {
      usernameError,
      passwordError,
      totpError,
      isValid: () => usernameError == null && passwordError == null && totpError == null,
    };
  }
}

export type User = {
  id: string;
  username: string;
  displayName: string;
  roles: string[];
  unreadMessageCount?: number;
};

export type MenuItem = {
  path: string;
  name: string;
  icon?: string | null;
  children?: MenuItem[] | null;
};

export type LoginResponse = {
  token: string;
  user: User;
};

/**
 * Native TypeScript authentication client.
 *
 * @author K
 * @author AI: Codex
 * @since 1.0.0
 */
export class AuthApi {
  async login(request: LoginRequest): Promise<LoginResponse> {
    const response = await requestAuthPayload<LoginResponse>(
      '/api/auth/login',
      {
        method: 'POST',
        body: {
          username: request.username,
          password: request.password,
          totpCode: request.totpCode,
        },
      },
      'Login failed',
    );
    if (!response?.token) throw new Error('Login response does not contain a token');
    TokenStorage.set(response.token);
    return response;
  }

  async getMe(): Promise<User> {
    const user = await requestAuthPayload<User>('/api/me', {}, 'Failed to load the current user');
    if (!user) throw new Error('The current-user response does not contain a user');
    return user;
  }

  async getMenus(): Promise<MenuItem[]> {
    const menus = await requestAuthPayload<MenuItem[]>('/api/menus', {}, 'Failed to load menus');
    return menus ?? [];
  }

  logout(): void {
    TokenStorage.clear();
  }

  hasToken(): boolean {
    return TokenStorage.has();
  }
}

export const authApi = new AuthApi();
