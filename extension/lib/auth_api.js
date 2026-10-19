/**
 * chitgit Authentication Client
 * Supports Supabase Auth (OTP & Password), Firebase Auth, and local demo fallback.
 */
const AuthAPI = {
  // Provider types: 'supabase' | 'firebase' | 'local'
  DEFAULT_PROVIDER: 'supabase',

  /**
   * Returns current auth configuration from chrome.storage.local
   */
  async getConfig() {
    return new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([
          'authProvider',
          'supabaseUrl',
          'supabaseAnonKey',
          'firebaseApiKey',
          'backendUrl',
          'currentUser',
          'authToken'
        ], (data) => {
          resolve({
            provider: data.authProvider || 'supabase',
            supabaseUrl: data.supabaseUrl || 'https://kpuiszcppdmizpzaicab.supabase.co',
            supabaseAnonKey: data.supabaseAnonKey || 'sb_publishable_WsZiTZmi71ghFGRoP3y_LQ_qVkmS8q5',
            firebaseApiKey: data.firebaseApiKey || '',
            backendUrl: data.backendUrl || '',
            user: data.currentUser || null,
            token: data.authToken || null
          });
        });
      } else {
        const user = localStorage.getItem('gitlense_user');
        resolve({
          provider: localStorage.getItem('gitlense_auth_provider') || 'supabase',
          supabaseUrl: localStorage.getItem('gitlense_sb_url') || 'https://kpuiszcppdmizpzaicab.supabase.co',
          supabaseAnonKey: localStorage.getItem('gitlense_sb_key') || 'sb_publishable_WsZiTZmi71ghFGRoP3y_LQ_qVkmS8q5',
          backendUrl: localStorage.getItem('gitlense_backend_url') || '',
          user: user ? JSON.parse(user) : null,
          token: localStorage.getItem('gitlense_token')
        });
      }
    });
  },

  /**
   * Saves active session to storage
   */
  async saveSession(user, token) {
    return new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ currentUser: user, authToken: token }, resolve);
      } else {
        localStorage.setItem('gitlense_user', JSON.stringify(user));
        if (token) localStorage.setItem('gitlense_token', token);
        resolve();
      }
    });
  },

  /**
   * Clears active session
   */
  async clearSession() {
    return new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.remove(['currentUser', 'authToken'], resolve);
      } else {
        localStorage.removeItem('gitlense_user');
        localStorage.removeItem('gitlense_token');
        resolve();
      }
    });
  },

  /**
   * Send OTP Code to user's email via Supabase or Backend Proxy
   */
  async sendOtp({ email }) {
    if (!email || !email.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const config = await this.getConfig();

    // 1. Supabase Auth REST (/auth/v1/otp)
    if (config.supabaseUrl && config.supabaseAnonKey) {
      const endpoint = `${config.supabaseUrl.replace(/\/+$/, '')}/auth/v1/otp`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.supabaseAnonKey
        },
        body: JSON.stringify({
          email: cleanEmail,
          create_user: true
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error_description || data.msg || data.message || 'Failed to send verification OTP.');
      }
      return { success: true, method: 'supabase', message: 'Verification code sent to your email.' };
    }

    // 2. Vercel Backend Proxy (/api/auth/otp/send)
    if (config.backendUrl) {
      try {
        const endpoint = `${config.backendUrl.replace(/\/+$/, '')}/api/auth/otp/send`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          return { success: true, method: 'backend', message: data.message || 'OTP code sent successfully.' };
        }
      } catch (e) {
        console.warn('Backend OTP proxy failed, falling back to local simulation:', e);
      }
    }

    // 3. Built-in Local Demo Simulation (Instant testing without setup)
    await new Promise(r => setTimeout(r, 450));
    // Generate deterministic 6-digit demo code for user convenience: 123456
    const demoCode = '123456';
    if (typeof window !== 'undefined') {
      window._lastDemoOtp = demoCode;
    }
    return {
      success: true,
      method: 'local',
      message: `Demo OTP is: ${demoCode} (Enter this code to sign in)`
    };
  },

  /**
   * Verify OTP Code and establish user session
   */
  async verifyOtp({ email, token }) {
    if (!email || !token) {
      throw new Error('Email and 6-digit OTP code are required.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = token.trim();
    const config = await this.getConfig();

    // 1. Supabase Auth REST (/auth/v1/verify)
    if (config.supabaseUrl && config.supabaseAnonKey) {
      const endpoint = `${config.supabaseUrl.replace(/\/+$/, '')}/auth/v1/verify`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.supabaseAnonKey
        },
        body: JSON.stringify({
          type: 'email',
          email: cleanEmail,
          token: cleanToken
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error_description || data.msg || data.message || 'Invalid or expired OTP code.');
      }

      const user = {
        id: data.user?.id || 'sb_' + Math.random().toString(36).substring(2, 9),
        email: data.user?.email || cleanEmail,
        provider: 'supabase',
        signedInAt: new Date().toISOString()
      };
      await this.saveSession(user, data.access_token);
      return user;
    }

    // 2. Vercel Backend Proxy (/api/auth/otp/verify)
    if (config.backendUrl) {
      try {
        const endpoint = `${config.backendUrl.replace(/\/+$/, '')}/api/auth/otp/verify`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, token: cleanToken })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.user) {
          const user = {
            id: data.user.id || 'usr_' + Math.random().toString(36).substring(2, 9),
            email: data.user.email || cleanEmail,
            provider: 'supabase',
            signedInAt: new Date().toISOString()
          };
          await this.saveSession(user, data.token || 'jwt_session');
          return user;
        }
      } catch (e) {
        console.warn('Backend OTP verification failed, trying demo fallback:', e);
      }
    }

    // 3. Built-in Local Demo Simulation
    if (cleanToken.length !== 6) {
      throw new Error('Please enter the 6-digit OTP code.');
    }

    await new Promise(r => setTimeout(r, 400));
    const mockUser = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      email: cleanEmail,
      provider: 'local',
      signedInAt: new Date().toISOString()
    };
    const mockToken = 'jwt_' + btoa(JSON.stringify(mockUser)).substring(0, 32);

    await this.saveSession(mockUser, mockToken);
    return mockUser;
  },

  /**
   * Traditional Sign In with Email and Password
   */
  async signIn({ email, password }) {
    if (!email || !password) {
      throw new Error('Email and password are required.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const config = await this.getConfig();

    // 1. Supabase Auth REST
    if (config.supabaseUrl && config.supabaseAnonKey) {
      const endpoint = `${config.supabaseUrl.replace(/\/+$/, '')}/auth/v1/token?grant_type=password`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.supabaseAnonKey
        },
        body: JSON.stringify({ email: cleanEmail, password })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error_description || data.msg || 'Authentication failed');
      }

      const user = {
        id: data.user.id,
        email: data.user.email,
        provider: 'supabase'
      };
      await this.saveSession(user, data.access_token);
      return user;
    }

    // 2. Firebase Auth REST
    if (config.firebaseApiKey) {
      const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.firebaseApiKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password, returnSecureToken: true })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error?.message || 'Firebase sign-in failed');
      }

      const user = {
        id: data.localId,
        email: data.email,
        provider: 'firebase'
      };
      await this.saveSession(user, data.idToken);
      return user;
    }

    // 3. Local Mock Provider
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    await new Promise(r => setTimeout(r, 400));
    const mockUser = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      email: cleanEmail,
      provider: 'local',
      signedInAt: new Date().toISOString()
    };
    const mockToken = 'jwt_' + btoa(JSON.stringify(mockUser)).substring(0, 32);

    await this.saveSession(mockUser, mockToken);
    return mockUser;
  },

  /**
   * Traditional Sign Up with Email and Password
   */
  async signUp({ email, password }) {
    if (!email || !password) {
      throw new Error('Email and password are required.');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const config = await this.getConfig();

    // 1. Supabase Auth REST
    if (config.supabaseUrl && config.supabaseAnonKey) {
      const endpoint = `${config.supabaseUrl.replace(/\/+$/, '')}/auth/v1/signup`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.supabaseAnonKey
        },
        body: JSON.stringify({ email: cleanEmail, password })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error_description || data.msg || 'Registration failed');
      }

      const user = {
        id: data.user?.id || 'new_user',
        email: data.user?.email || cleanEmail,
        provider: 'supabase'
      };
      if (data.access_token) {
        await this.saveSession(user, data.access_token);
      }
      return user;
    }

    // 2. Firebase Auth REST
    if (config.firebaseApiKey) {
      const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${config.firebaseApiKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password, returnSecureToken: true })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error?.message || 'Registration failed');
      }

      const user = {
        id: data.localId,
        email: data.email,
        provider: 'firebase'
      };
      await this.saveSession(user, data.idToken);
      return user;
    }

    // 3. Local Mock Provider
    await new Promise(r => setTimeout(r, 400));
    const mockUser = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      email: cleanEmail,
      provider: 'local',
      signedInAt: new Date().toISOString()
    };
    const mockToken = 'jwt_' + btoa(JSON.stringify(mockUser)).substring(0, 32);

    await this.saveSession(mockUser, mockToken);
    return mockUser;
  },

  /**
   * Sign Out
   */
  async signOut() {
    await this.clearSession();
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthAPI;
}
