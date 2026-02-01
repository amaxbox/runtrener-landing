// Authentication module - shared across all pages
// JWT token stored in localStorage for persistence across tabs and sessions

const API_BASE = window.location.pathname.startsWith('/support') ? '/support' : '';
const AUTH_KEY = 'supportAuth';
const TOKEN_KEY = 'supportToken';

class AuthManager {
    constructor() {
        this.token = this.loadToken();
        this.isAuthenticated = !!this.token;
    }

    loadToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    saveToken(token) {
        this.token = token;
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(AUTH_KEY, 'true');
        this.isAuthenticated = true;
    }

    logout() {
        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem(TOKEN_KEY);
        this.token = null;
        this.isAuthenticated = false;

        // Clear all saved filters and periods from localStorage
        try {
            localStorage.removeItem('usersFilters');
            localStorage.removeItem('paymentsFilters');
            localStorage.removeItem('dashboardPeriods');
        } catch (e) {
            console.error('Error clearing localStorage:', e);
        }
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
                if (data.success && data.token) {
                    this.saveToken(data.token);
                    return true;
                }
            } else if (response.status === 429) {
                // Rate limit exceeded
                throw new Error('Слишком много попыток входа. Попробуйте позже.');
            }
            return false;
        } catch (error) {
            console.error('Auth verification error:', error);
            throw error;
        }
    }

    requireAuth() {
        if (!this.isAuthenticated) {
            // Save current URL with parameters to restore after login
            const returnUrl = window.location.pathname + window.location.search;
            sessionStorage.setItem('returnUrl', returnUrl);
            window.location.href = `${API_BASE}/`;
            return false;
        }
        return true;
    }

    getAuthHeader() {
        return {
            'Authorization': `Bearer ${this.token}`
        };
    }
}

// Create global auth manager
const auth = new AuthManager();

// Redirect to login if not authenticated (for non-index pages)
if (!window.location.pathname.endsWith('/') &&
    !window.location.pathname.endsWith('/index.html') &&
    !auth.isAuthenticated) {
    // Save current URL with parameters to restore after login
    const returnUrl = window.location.pathname + window.location.search;
    sessionStorage.setItem('returnUrl', returnUrl);
    window.location.href = `${API_BASE}/`;
}

// Helper function for API calls with auth
async function apiCall(endpoint, options = {}) {
    // Get current bot ID from botManager (if available)
    const botId = typeof botManager !== 'undefined' ? botManager.getCurrentBotId() : 'alex';

    // Add botId to URL query parameter
    const separator = endpoint.includes('?') ? '&' : '?';
    const urlWithBot = `${endpoint}${separator}botId=${botId}`;

    const headers = {
        'Content-Type': 'application/json',
        'X-Bot-Id': botId,  // Also add to header
        ...options.headers,
        ...auth.getAuthHeader()
    };

    const response = await fetch(`${API_BASE}${urlWithBot}`, {
        ...options,
        headers
    });

    if (response.status === 401) {
        auth.logout();
        window.location.href = `${API_BASE}/`;
        return null;
    }

    return response;
}

// Export for use
// (In browser: auth, apiCall are global)
