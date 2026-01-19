// Authentication module - shared across all pages

const API_BASE = window.location.pathname.startsWith('/support') ? '/support' : '';
const AUTH_KEY = 'supportAuth';
const PASSWORD_KEY = 'supportPassword';

class AuthManager {
    constructor() {
        this.password = this.loadPassword();
        this.isAuthenticated = !!this.password;
    }

    loadPassword() {
        return sessionStorage.getItem(PASSWORD_KEY);
    }

    savePassword(password) {
        this.password = password;
        sessionStorage.setItem(PASSWORD_KEY, password);
        sessionStorage.setItem(AUTH_KEY, 'true');
        this.isAuthenticated = true;
    }

    logout() {
        sessionStorage.removeItem(AUTH_KEY);
        sessionStorage.removeItem(PASSWORD_KEY);
        this.password = null;
        this.isAuthenticated = false;
    }

    async verifyPassword(password) {
        try {
            const response = await fetch(`${API_BASE}/api/auth`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.savePassword(password);
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('Auth verification error:', error);
            return false;
        }
    }

    requireAuth() {
        if (!this.isAuthenticated) {
            window.location.href = '/';
            return false;
        }
        return true;
    }

    getAuthHeader() {
        return {
            'X-Support-Password': this.password
        };
    }
}

// Create global auth manager
const auth = new AuthManager();

// Redirect to login if not authenticated (for non-index pages)
if (!window.location.pathname.endsWith('/') &&
    !window.location.pathname.endsWith('/index.html') &&
    !auth.isAuthenticated) {
    window.location.href = '/';
}

// Helper function for API calls with auth
async function apiCall(endpoint, options = {}) {
    const headers = {
        ...options.headers,
        ...auth.getAuthHeader()
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });

    if (response.status === 401) {
        auth.logout();
        window.location.href = '/';
        return null;
    }

    return response;
}

// Export for use
// (In browser: auth, apiCall are global)
