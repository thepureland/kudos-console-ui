import { requestJson, TokenStorage } from './httpClient';

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
    const response = await requestJson<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: {
        username: request.username,
        password: request.password,
        totpCode: request.totpCode,
      },
    });
    if (!response?.token) throw new Error('Login response does not contain a token');
    TokenStorage.set(response.token);
    return response;
  }

  getMe(): Promise<User> {
    return requestJson<User>('/api/me');
  }

  getMenus(): Promise<MenuItem[]> {
    return requestJson<MenuItem[]>('/api/menus');
  }

  logout(): void {
    TokenStorage.clear();
  }

  hasToken(): boolean {
    return TokenStorage.has();
  }
}

export const authApi = new AuthApi();
