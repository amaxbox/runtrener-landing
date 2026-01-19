// Global state
let authPassword = null;
let currentPage = 0;
let usersPerPage = 50;
let totalUsers = 0;
let currentFilters = {};
let currentSubscriptionFilter = '';
let currentSortBy = 'created_at';
let currentSortOrder = 'DESC';
let currentSelectedUserId = null;

// Chat state
let chatMessagesPerPage = 50;
let currentChatPage = 0;
let allChatMessages = [];
let chatSortOrder = 'newest'; // 'newest' или 'oldest'

// API base path (для работы через /support/)
const API_BASE = window.location.pathname.startsWith('/support') ? '/support' : '';

// URL Routing
function updateURL(userId, tab = null) {
    const params = new URLSearchParams();
    params.set('user', userId);
    if (tab) params.set('tab', tab);

    const newURL = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({ userId, tab }, '', newURL);
}

function clearURL() {
    const newURL = window.location.pathname;
    window.history.pushState({}, '', newURL);
}

function getURLParams() {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('user');
    const tab = params.get('tab');

    // Validate
    const validUserId = userId && !isNaN(parseInt(userId)) ? userId : null;
    const validTabs = ['chat', 'therapy', 'payments', 'info'];
    const validTab = tab && validTabs.includes(tab) ? tab : null;

    return { userId: validUserId, tab: validTab };
}

// Handle browser back/forward
window.addEventListener('popstate', () => {
    const { userId, tab } = getURLParams();

    if (userId) {
        openUser(parseInt(userId));
        if (tab) switchTab(tab);
    } else {
        backToList();
    }
});

// Share user link
async function shareUserLink() {
    if (!currentSelectedUserId) return;

    const url = `${window.location.origin}${window.location.pathname}?user=${currentSelectedUserId}`;
    const message = `${url}\n\n⚠️ Для просмотра требуется авторизация в Support Dashboard`;

    try {
        await navigator.clipboard.writeText(message);

        const btn = document.getElementById('shareUserLinkBtn');
        const originalHTML = btn.innerHTML;

        btn.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            Скопировано!
        `;
        btn.classList.add('bg-green-50', 'border-green-500', 'text-green-700');

        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.classList.remove('bg-green-50', 'border-green-500', 'text-green-700');
        }, 2000);
    } catch (err) {
        console.error('Failed to copy:', err);
        alert('Не удалось скопировать ссылку');
    }
}

// Set initial body state for login
document.body.classList.add('login-active');

// Check if already logged in
if (sessionStorage.getItem('supportAuth') === 'true') {
    authPassword = sessionStorage.getItem('supportPassword');
    document.body.classList.remove('login-active');
    showDashboard();
}

// Login form handler
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(`${API_BASE}/api/auth`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password })
        });

        const data = await response.json();

        if (data.success) {
            authPassword = password;
            sessionStorage.setItem('supportAuth', 'true');
            sessionStorage.setItem('supportPassword', password);
            showDashboard();
        } else {
            showError('Неверный пароль');
        }
    } catch (error) {
        console.error('Auth error:', error);
        showError('Ошибка подключения к серверу');
    }
});

function showError(message) {
    const errorEl = document.getElementById('loginError');
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
    setTimeout(() => {
        errorEl.classList.add('hidden');
    }, 3000);
}

function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboard').classList.add('active');

    // Remove login scroll lock
    document.body.classList.remove('login-active');

    initTabs();
    initFilters();
    initPaymentsFilters();
    initScrollToTop();
    initChatControls();
    updateSortButtonStyles();
    loadUsersList();

    // Check URL for direct user link
    const { userId, tab } = getURLParams();
    if (userId) {
        openUser(parseInt(userId));
        if (tab) switchTab(tab);
    }

    // Adjust content padding based on header height
    adjustContentPadding();

    // Re-adjust on window resize
    window.addEventListener('resize', adjustContentPadding);
    window.addEventListener('resize', handleResize);
}

function logout() {
    sessionStorage.removeItem('supportAuth');
    sessionStorage.removeItem('supportPassword');
    authPassword = null;

    // Re-enable login scroll lock
    document.body.classList.add('login-active');

    location.reload();
}

// Scroll to Top functionality
function initScrollToTop() {
    const scrollBtn = document.getElementById('scrollToTop');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 500) {
            scrollBtn.classList.remove('opacity-0', 'pointer-events-none');
        } else {
            scrollBtn.classList.add('opacity-0', 'pointer-events-none');
        }
    });

    scrollBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// Chat controls functionality
function initChatControls() {
    const newestBtn = document.getElementById('sortNewestFirst');
    const oldestBtn = document.getElementById('sortOldestFirst');

    if (newestBtn && oldestBtn) {
        newestBtn.addEventListener('click', () => {
            chatSortOrder = 'newest';
            currentChatPage = 0;
            updateSortButtons();
            renderChatLogsPage();
        });

        oldestBtn.addEventListener('click', () => {
            chatSortOrder = 'oldest';
            currentChatPage = 0;
            updateSortButtons();
            renderChatLogsPage();
        });
    }
}

function updateSortButtons() {
    const newestBtn = document.getElementById('sortNewestFirst');
    const oldestBtn = document.getElementById('sortOldestFirst');

    if (!newestBtn || !oldestBtn) return;

    if (chatSortOrder === 'newest') {
        newestBtn.className = 'px-5 py-2.5 bg-apple-blue text-white rounded-apple text-sm font-medium hover:opacity-90 active:opacity-80 transition';
        oldestBtn.className = 'px-5 py-2.5 bg-apple-gray-100 text-apple-gray-700 rounded-apple text-sm font-medium hover:bg-apple-gray-200 transition';
    } else {
        newestBtn.className = 'px-5 py-2.5 bg-apple-gray-100 text-apple-gray-700 rounded-apple text-sm font-medium hover:bg-apple-gray-200 transition';
        oldestBtn.className = 'px-5 py-2.5 bg-apple-blue text-white rounded-apple text-sm font-medium hover:opacity-90 active:opacity-80 transition';
    }
}

// Filters functionality
let searchDebounceTimer;

function initFilters() {
    const applyButton = document.getElementById('applyFilters');
    const resetButton = document.getElementById('resetFilters');
    const searchInput = document.getElementById('searchInput');

    applyButton.addEventListener('click', () => {
        applyFilters();
    });

    resetButton.addEventListener('click', () => {
        resetFilters();
    });

    // Auto-apply для поиска с debounce
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            applyFilters();
        }, 500); // Применить через 500мс после остановки набора
    });

    // Apply filters on Enter in search input (для более быстрого применения)
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            clearTimeout(searchDebounceTimer);
            applyFilters();
        }
    });
}

function applyFilters() {
    currentFilters = {
        search: document.getElementById('searchInput').value.trim(),
        subscribe: currentSubscriptionFilter, // Используем состояние из tabs
        status: document.getElementById('statusFilter').value,
        dateFrom: document.getElementById('dateFrom').value,
        dateTo: document.getElementById('dateTo').value
    };

    currentPage = 0; // Reset to first page
    loadUsersList();
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';

    // Reset subscription tabs
    currentSubscriptionFilter = '';
    setSubscriptionFilter('');

    currentFilters = {};
    currentPage = 0;
    loadUsersList();
}

// Subscription filter tabs
function setSubscriptionFilter(subscribe) {
    currentSubscriptionFilter = subscribe;

    const activeClass = 'flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition shadow-sm';
    const inactiveClass = 'flex-1 px-3 py-2 bg-apple-gray-100 text-apple-gray-700 rounded-lg text-xs font-medium hover:bg-apple-gray-200 transition';

    document.getElementById('subTabAll').className = subscribe === '' ? activeClass : inactiveClass;
    document.getElementById('subTabFree').className = subscribe === 'free' ? activeClass : inactiveClass;
    document.getElementById('subTabPro').className = subscribe === 'pro' ? activeClass : inactiveClass;

    currentPage = 0;
    loadUsersList();
}

// Load users list
async function loadUsersList(page = 0) {
    currentPage = page;
    const offset = page * usersPerPage;

    // Build query params
    const params = new URLSearchParams({
        limit: usersPerPage,
        offset: offset,
        sortBy: currentSortBy,
        sortOrder: currentSortOrder
    });

    if (currentFilters.search) params.append('search', currentFilters.search);
    if (currentFilters.subscribe) params.append('subscribe', currentFilters.subscribe);
    if (currentFilters.status) params.append('status', currentFilters.status);
    if (currentFilters.dateFrom) params.append('dateFrom', currentFilters.dateFrom);
    if (currentFilters.dateTo) params.append('dateTo', currentFilters.dateTo);

    try {
        const response = await fetch(`${API_BASE}/api/users?${params.toString()}`, {
            headers: {
                'X-Support-Password': authPassword
            }
        });

        if (response.status === 401) {
            logout();
            return;
        }

        const data = await response.json();
        totalUsers = data.total;

        renderUsersList(data.users);
        renderPagination();

        // Обновить счётчик пользователей
        document.getElementById('usersCount').innerHTML = `<h3 class="text-lg font-semibold text-apple-gray-900">Найдено: ${totalUsers} пользователей</h3>`;
    } catch (error) {
        console.error('Error loading users list:', error);
        document.getElementById('usersTableContainer').innerHTML = '<div class="p-8 text-center text-red-500">Ошибка загрузки списка</div>';
    }
}

function setSorting(field) {
    if (currentSortBy === field) {
        currentSortOrder = currentSortOrder === 'DESC' ? 'ASC' : 'DESC';
    } else {
        currentSortBy = field;
        currentSortOrder = 'DESC';
    }
    currentPage = 0;
    updateSortButtonStyles();
    loadUsersList();
}

function updateSortButtonStyles() {
    const buttons = [
        { created: document.getElementById('sortCreatedBtn'), updated: document.getElementById('sortUpdatedBtn') },
        { created: document.getElementById('sortCreatedBtnMobile'), updated: document.getElementById('sortUpdatedBtnMobile') }
    ];

    const activeClass = 'px-3 py-1.5 bg-apple-blue text-white rounded-lg text-xs font-medium hover:opacity-90 transition whitespace-nowrap';
    const inactiveClass = 'px-3 py-1.5 bg-apple-gray-100 text-apple-gray-700 rounded-lg text-xs font-medium hover:bg-apple-gray-200 transition whitespace-nowrap';

    const sortArrow = currentSortOrder === 'DESC' ? ' ↓' : ' ↑';

    buttons.forEach(btnPair => {
        if (!btnPair.created || !btnPair.updated) return;

        if (currentSortBy === 'created_at') {
            btnPair.created.className = activeClass;
            btnPair.created.textContent = 'По регистрации' + sortArrow;
            btnPair.updated.className = inactiveClass;
            btnPair.updated.textContent = 'По активности ↓↑';
        } else if (currentSortBy === 'updated_at') {
            btnPair.created.className = inactiveClass;
            btnPair.created.textContent = 'По регистрации ↓↑';
            btnPair.updated.className = activeClass;
            btnPair.updated.textContent = 'По активности' + sortArrow;
        }
    });
}

function getSortIcon(field) {
    if (currentSortBy !== field) return '';
    return currentSortOrder === 'DESC' ? ' ↓' : ' ↑';
}

async function copyToClipboard(text, button) {
    try {
        await navigator.clipboard.writeText(text);

        const originalHTML = button.innerHTML;
        button.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
        button.classList.add('text-green-500');

        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.classList.remove('text-green-500');
        }, 1500);
    } catch (err) {
        console.error('Ошибка копирования:', err);
    }
}

function renderUsersList(users) {
    if (!users || users.length === 0) {
        document.getElementById('usersTableContainer').innerHTML = '<div class="p-8 text-center text-apple-gray-500 text-sm">Пользователи не найдены</div>';
        return;
    }

    const desktopTable = `
        <table class="w-full hidden md:table">
            <thead class="bg-apple-gray-50 border-b border-apple-gray-200">
                <tr class="h-12">
                    <th class="px-4 text-left text-[10px] font-semibold text-apple-gray-600 uppercase tracking-wider">
                        Telegram User ID
                    </th>
                    <th class="px-4 text-left text-[10px] font-semibold text-apple-gray-600 uppercase tracking-wider">Имя / Username</th>
                    <th class="px-4 text-left text-[10px] font-semibold text-apple-gray-600 uppercase tracking-wider">Статус</th>
                    <th class="px-4 text-left text-[10px] font-semibold text-apple-gray-600 uppercase tracking-wider">Подписка</th>
                    <th onclick="setSorting('created_at')" class="px-4 text-left text-[10px] font-semibold text-apple-gray-600 uppercase tracking-wider cursor-pointer hover:bg-apple-gray-100">
                        Регистрация${getSortIcon('created_at')}
                    </th>
                    <th onclick="setSorting('updated_at')" class="px-4 text-left text-[10px] font-semibold text-apple-gray-600 uppercase tracking-wider cursor-pointer hover:bg-apple-gray-100">
                        Активность${getSortIcon('updated_at')}
                    </th>
                    <th class="px-4 text-left text-[10px] font-semibold text-apple-gray-600 uppercase tracking-wider">Сообщений/день</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-apple-gray-200 bg-white">
                ${users.map(user => {
                    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || '—';
                    const username = user.username ? `@${user.username}` : '';

                    return `
                    <tr onclick="openUser(${user.telegram_user_id})" data-user-id="${user.telegram_user_id}" class="user-list-item h-14 hover:bg-apple-gray-50 cursor-pointer transition-colors">
                        <td class="px-4 text-sm font-medium text-apple-gray-900">
                            <div class="flex items-center gap-2">
                                ${user.telegram_user_id}
                                <button onclick="event.stopPropagation(); copyToClipboard('${user.telegram_user_id}', this)" class="text-apple-gray-400 hover:text-apple-blue transition" title="Копировать">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                </button>
                            </div>
                        </td>
                        <td class="px-4 text-sm text-apple-gray-900">
                            <div>${fullName}</div>
                            ${username ? `<div class="text-xs text-apple-gray-500">${username}</div>` : ''}
                        </td>
                        <td class="px-4 text-sm text-apple-gray-700">${user.status || 'active'}</td>
                        <td class="px-4 text-sm whitespace-nowrap">${getSubscribeLabel(user.subscribe, user.pro_before)}</td>
                        <td class="px-4 text-xs text-apple-gray-600">${user.created_at ? formatDate(user.created_at) : '—'}</td>
                        <td class="px-4 text-xs text-apple-gray-600">${user.updated_at ? formatDate(user.updated_at) : '—'}</td>
                        <td class="px-4 text-xs text-apple-gray-600">
                            ${user.daily_message_count || 0}
                            ${user.daily_message_count_date ? `<br><span class="text-xs text-apple-gray-500">${formatDateShort(user.daily_message_count_date)}</span>` : ''}
                        </td>
                    </tr>
                `;
                }).join('')}
            </tbody>
        </table>
    `;

    const mobileCards = `
        <div class="grid grid-cols-1 gap-4 md:hidden">
            ${users.map(user => `
                <div onclick="openUser(${user.telegram_user_id})" data-user-id="${user.telegram_user_id}" class="user-list-item bg-apple-gray-50 border border-apple-gray-200 rounded-apple p-4 cursor-pointer hover:shadow-md transition">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <div class="text-xs text-apple-gray-600 font-semibold mb-1">ПОЛЬЗОВАТЕЛЬ</div>
                            <div class="text-base font-medium text-apple-gray-900">${user.first_name || '—'} ${user.last_name || ''}</div>
                            ${user.username ? `<div class="text-sm text-apple-gray-600">@${user.username}</div>` : ''}
                        </div>
                        ${getSubscribeLabel(user.subscribe, user.pro_before)}
                    </div>
                    <div class="space-y-2 text-xs border-t border-apple-gray-100 pt-3">
                        <div class="flex justify-between">
                            <span class="text-apple-gray-600">ID:</span>
                            <div class="flex items-center gap-2">
                                <span class="font-medium">${user.telegram_user_id}</span>
                                <button onclick="event.stopPropagation(); copyToClipboard('${user.telegram_user_id}', this)" class="text-apple-gray-400 hover:text-apple-blue">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                </button>
                            </div>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-apple-gray-600">Статус:</span>
                            <span class="font-medium">${user.status || 'active'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-apple-gray-600">Регистрация:</span>
                            <span class="font-medium">${formatDateShort(user.created_at)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-apple-gray-600">Активность:</span>
                            <span class="font-medium">${formatDateShort(user.updated_at)}</span>
                        </div>
                        ${user.daily_message_count ? `
                        <div class="flex justify-between">
                            <span class="text-apple-gray-600">Сообщений/день:</span>
                            <span class="font-medium">${user.daily_message_count} ${user.daily_message_count_date ? `(${formatDateShort(user.daily_message_count_date)})` : ''}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    document.getElementById('usersTableContainer').innerHTML = desktopTable + mobileCards;
}

function getStatusClass(status) {
    const classes = {
        'active': 'bg-green-50 text-green-700',
        'stop': 'bg-apple-gray-100 text-apple-gray-700',
        'ban': 'bg-red-50 text-red-700',
        'mute': 'bg-yellow-50 text-yellow-700'
    };
    return classes[status] || 'bg-apple-gray-100 text-apple-gray-700';
}

function getSubscribeLabel(subscribe, proBefore) {
    const sub = subscribe || 'free';

    if (sub === 'pro') {
        const dateStr = proBefore ? ` до ${formatDateShort(proBefore)}` : '';
        return `<span class="inline-block px-3 py-1 rounded-full text-xs font-medium bg-blue-500 text-white">pro${dateStr}</span>`;
    }

    return `<span class="text-apple-gray-700">${sub}</span>`;
}

function renderPagination() {
    const totalPages = Math.ceil(totalUsers / usersPerPage);
    const hasPrev = currentPage > 0;
    const hasNext = currentPage < totalPages - 1;

    const html = `
        <button
            onclick="loadUsersList(${currentPage - 1})"
            ${!hasPrev ? 'disabled' : ''}
            class="px-5 py-2.5 bg-white border border-apple-gray-300 text-apple-gray-700 rounded-apple hover:bg-apple-gray-50 transition font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed shadow-apple-sm"
        >
            ←
        </button>
        <span class="px-5 py-2.5 text-sm text-apple-gray-600 font-medium">
            ${currentPage + 1} из ${totalPages}
        </span>
        <button
            onclick="loadUsersList(${currentPage + 1})"
            ${!hasNext ? 'disabled' : ''}
            class="px-5 py-2.5 bg-white border border-apple-gray-300 text-apple-gray-700 rounded-apple hover:bg-apple-gray-50 transition font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed shadow-apple-sm"
        >
            →
        </button>
    `;

    document.getElementById('pagination').innerHTML = html;
}

function openUser(telegramUserId) {
    currentSelectedUserId = telegramUserId;

    // Desktop: Show side panel
    if (window.innerWidth >= 768) {
        document.getElementById('userDetailPanel').classList.remove('hidden');
        highlightSelectedUser(telegramUserId);
    } else {
        // Mobile: Fullscreen
        document.getElementById('usersListView').classList.add('mobile-fullscreen', 'hidden');
        document.getElementById('userData').classList.add('active');
    }

    // Load user data
    showLoading();
    switchTab('chat');
    loadUserData(telegramUserId);

    // Update URL
    updateURL(telegramUserId);

    // Scroll to top
    const detailPanel = document.getElementById('userDetailPanel');
    if (detailPanel) detailPanel.scrollTop = 0;

    // Adjust padding after header is visible
    setTimeout(() => {
        adjustContentPadding();
    }, 100);
}

function highlightSelectedUser(telegramUserId) {
    // Remove existing highlights
    document.querySelectorAll('.user-list-item').forEach(item => {
        item.classList.remove('user-list-item-selected');
    });

    // Add highlight to selected
    const selectedRow = document.querySelector(`[data-user-id="${telegramUserId}"]`);
    if (selectedRow) {
        selectedRow.classList.add('user-list-item-selected');
    }
}

function backToList() {
    currentSelectedUserId = null;

    if (window.innerWidth >= 768) {
        // Desktop: Hide panel
        document.getElementById('userDetailPanel').classList.add('hidden');

        // Remove highlight
        document.querySelectorAll('.user-list-item').forEach(item => {
            item.classList.remove('user-list-item-selected');
        });
    } else {
        // Mobile: Restore list view
        document.getElementById('userData').classList.remove('active');
        document.getElementById('usersListView').classList.remove('mobile-fullscreen', 'hidden');
    }

    // Clear URL
    clearURL();

    // Adjust padding after header changes
    setTimeout(() => {
        adjustContentPadding();
    }, 100);

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleResize() {
    if (!currentSelectedUserId) return;

    // Switching from mobile to desktop
    if (window.innerWidth >= 768) {
        document.getElementById('usersListView').classList.remove('mobile-fullscreen', 'hidden');
        document.getElementById('userData').classList.remove('active');
        document.getElementById('userDetailPanel').classList.remove('hidden');
    }
    // Switching from desktop to mobile
    else {
        document.getElementById('usersListView').classList.add('mobile-fullscreen', 'hidden');
        document.getElementById('userData').classList.add('active', 'mobile-fullscreen');
        document.getElementById('headerBackButton').classList.remove('hidden');
    }
}

// Tabs functionality
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');

    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    // Remove active classes
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.className = 'tab-button py-4 text-sm font-medium text-apple-gray-600 border-b-2 border-transparent hover:text-apple-gray-900 whitespace-nowrap';
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Add active classes
    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeButton) {
        activeButton.className = 'tab-button py-4 text-sm font-medium text-apple-blue border-b-2 border-apple-blue whitespace-nowrap';
    }
    document.getElementById(`tab-${tabName}`).classList.add('active');

    // Update URL with tab
    if (currentSelectedUserId) {
        updateURL(currentSelectedUserId, tabName);
    }
}

function showLoading() {
    document.getElementById('userInfo').innerHTML = '<div class="text-gray-500">Загрузка...</div>';
    document.getElementById('therapyProfile').innerHTML = '<div class="text-gray-500">Загрузка...</div>';
    document.getElementById('payments').innerHTML = '<div class="text-gray-500">Загрузка...</div>';
    document.getElementById('chatLogs').innerHTML = '<div class="text-gray-500">Загрузка...</div>';
}

async function loadUserData(userId) {
    try {
        const response = await fetch(`${API_BASE}/api/user/${userId}`, {
            headers: {
                'X-Support-Password': authPassword
            }
        });

        if (response.status === 401) {
            logout();
            return;
        }

        if (response.status === 404) {
            document.getElementById('userInfo').innerHTML = '<div class="text-red-500">Пользователь не найден</div>';
            document.getElementById('therapyProfile').innerHTML = '';
            document.getElementById('payments').innerHTML = '';
            document.getElementById('chatLogs').innerHTML = '';
            return;
        }

        const data = await response.json();

        renderUserBasicInfo(data.userInfo);
        renderUserInfo(data.userInfo);
        renderTherapyProfile(data.therapyProfile);
        renderPayments(data.payments);

        // Initialize chat with new pagination
        allChatMessages = flattenChatLogs(data.chatLogs);
        currentChatPage = 0;
        renderChatLogsPage();
    } catch (error) {
        console.error('Error loading user data:', error);
        document.getElementById('userInfo').innerHTML = '<div class="text-red-500">Ошибка загрузки данных</div>';
    }
}

function renderUserBasicInfo(user) {
    if (!user) {
        document.getElementById('headerUserInfoText').innerHTML = '<div class="text-red-500 text-sm">Пользователь не найден</div>';
        return;
    }

    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || '—';
    const username = user.username ? `@${user.username}` : '';
    const statusLabel = getSubscribeLabel(user.subscribe, user.pro_before);

    // Format user info for sticky header (compact format)
    const userInfoText = `${fullName} ${username ? `(${username})` : ''} • ID: ${user.telegram_user_id} • ${statusLabel}`;

    document.getElementById('headerUserInfoText').innerHTML = userInfoText;

    // Adjust content padding after rendering user info
    setTimeout(() => {
        adjustContentPadding();
    }, 50);
}

function renderUserInfo(user) {
    if (!user) {
        document.getElementById('userInfo').innerHTML = '<div class="text-red-500 text-sm">Пользователь не найден</div>';
        return;
    }

    const subscribeLabel = user.subscribe === 'pro'
        ? `pro${user.pro_before ? ` до ${formatDateShort(user.pro_before)}` : ''}`
        : (user.subscribe || 'free');

    const rows = [
        { label: 'ID', value: user.id },
        { label: 'Telegram ID', value: user.telegram_user_id },
        { label: 'Username', value: user.username ? '@' + user.username : '—' },
        { label: 'Имя', value: user.first_name || '—' },
        { label: 'Фамилия', value: user.last_name || '—' },
        { label: 'Статус', value: user.status || 'active' },
        { label: 'Подписка', value: subscribeLabel },
        { label: 'Stage', value: user.stage || '—' },
        { label: 'Регистрация', value: user.created_at ? formatDate(user.created_at) : '—' },
        { label: 'Обновлено', value: user.updated_at ? formatDate(user.updated_at) : '—' },
        { label: 'Реферал', value: user.ref || '—' },
        { label: 'Рефералов', value: user.ref_count || 0 },
        { label: 'NPS', value: user.nps_score !== null && user.nps_score !== undefined ? user.nps_score : '—' },
        { label: 'NPS дата', value: user.nps_answered_at ? formatDate(user.nps_answered_at) : '—' },
        { label: 'NPS ответ', value: user.nps_answer || '—' },
        { label: 'Warnings', value: user.warnings_count || 0 },
        { label: 'Сообщений/день', value: user.daily_message_count || 0 },
        { label: 'Комментарий', value: user.error_comment || '—' }
    ];

    const html = `
        <div class="bg-white rounded-apple-lg border border-apple-gray-200 overflow-hidden shadow-apple">
            <table class="w-full">
                <tbody class="divide-y divide-apple-gray-200">
                    ${rows.map(row => {
                        const valueSafe = String(row.value || '—');
                        const shouldShowCopy = valueSafe !== '—' && !valueSafe.includes('<');

                        return `
                            <tr class="hover:bg-apple-gray-50 transition-colors">
                                <td class="px-6 py-3 text-xs font-semibold text-apple-gray-600 uppercase tracking-wider w-48">
                                    ${row.label}
                                </td>
                                <td class="px-6 py-3 text-sm text-apple-gray-900">
                                    <div class="flex items-center justify-between gap-4">
                                        <span>${valueSafe}</span>
                                        ${shouldShowCopy ? `
                                            <button onclick="copyToClipboard('${valueSafe.replace(/'/g, "\\'")}', this)" class="text-apple-gray-400 hover:text-apple-blue transition flex-shrink-0" title="Копировать">
                                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            </button>
                                        ` : ''}
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    document.getElementById('userInfo').innerHTML = html;
}

function renderDataItem(label, value, fullWidth = false) {
    const valueSafe = value || '—';
    const shouldShowCopy = value && value !== '—' && !fullWidth && typeof value === 'string' && !value.includes('<');

    return `
        <div class="${fullWidth ? 'col-span-full' : ''} bg-white p-5 rounded-apple border border-apple-gray-200 shadow-apple-sm">
            <dt class="text-xs font-semibold text-apple-gray-600 uppercase tracking-wider mb-2">${label}</dt>
            <dd class="text-sm text-apple-gray-900 leading-relaxed flex items-center justify-between gap-2">
                <span>${valueSafe}</span>
                ${shouldShowCopy ? `
                    <button onclick="copyToClipboard('${String(valueSafe).replace(/'/g, "\\'")}', this)" class="text-apple-gray-400 hover:text-apple-blue transition flex-shrink-0" title="Копировать">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    </button>
                ` : ''}
            </dd>
        </div>
    `;
}

function renderTherapyProfile(profile) {
    if (!profile) {
        document.getElementById('therapyProfile').innerHTML = '<div class="text-gray-500">Терапевтический профиль не найден</div>';
        return;
    }

    const html = `
        <div class="space-y-4">
            ${renderDataItem('Личные факты', escapeHtml(profile.personal_facts) || 'Не заполнено', true)}
            ${renderDataItem('Семья, друзья, партнеры', escapeHtml(profile.family_friends_partners_facts) || 'Не заполнено', true)}
            ${renderDataItem('Текущий контекст', escapeHtml(profile.current_context) || 'Не заполнено', true)}
            ${renderDataItem('Цели терапии', escapeHtml(profile.therapy_goals) || 'Не заполнено', true)}
            ${renderDataItem('Заметки о прогрессе', escapeHtml(profile.progress_notes) || 'Не заполнено', true)}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${renderDataItem('Нравится', escapeHtml(profile.likes) || 'Не заполнено')}
                ${renderDataItem('Не нравится', escapeHtml(profile.dislikes) || 'Не заполнено')}
            </div>
            ${renderDataItem('Заметки и рекомендации ассистента', escapeHtml(profile.assistant_notes_and_recommendations) || 'Не заполнено', true)}
            ${renderDataItem('Обновлено', profile.updated_at ? formatDate(profile.updated_at) : '—')}
        </div>
    `;

    document.getElementById('therapyProfile').innerHTML = html;
}

function renderPayments(payments) {
    if (!payments || payments.length === 0) {
        document.getElementById('payments').innerHTML = '<div class="text-apple-gray-500 text-sm">Платежи не найдены</div>';
        return;
    }

    const html = `
        <div class="bg-white border border-apple-gray-200 rounded-apple-lg overflow-hidden shadow-apple">
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-apple-gray-50 border-b border-apple-gray-200">
                        <tr>
                            <th class="px-6 py-4 text-left text-xs font-semibold text-apple-gray-600 uppercase tracking-wider">Дата</th>
                            <th class="px-6 py-4 text-left text-xs font-semibold text-apple-gray-600 uppercase tracking-wider">Сумма</th>
                            <th class="px-6 py-4 text-left text-xs font-semibold text-apple-gray-600 uppercase tracking-wider">Чистая</th>
                            <th class="px-6 py-4 text-left text-xs font-semibold text-apple-gray-600 uppercase tracking-wider">Длительность</th>
                            <th class="px-6 py-4 text-left text-xs font-semibold text-apple-gray-600 uppercase tracking-wider">PRO до</th>
                            <th class="px-6 py-4 text-left text-xs font-semibold text-apple-gray-600 uppercase tracking-wider">Лейбл</th>
                            <th class="px-6 py-4 text-left text-xs font-semibold text-apple-gray-600 uppercase tracking-wider">Источник</th>
                            <th class="px-6 py-4 text-left text-xs font-semibold text-apple-gray-600 uppercase tracking-wider">Чек</th>
                            <th class="px-6 py-4 text-left text-xs font-semibold text-apple-gray-600 uppercase tracking-wider">Комментарий</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-apple-gray-200 bg-white">
                        ${payments.map(payment => `
                            <tr class="hover:bg-apple-gray-50 transition-colors">
                                <td class="px-6 py-4 text-sm text-apple-gray-900">${payment.payment_date ? formatDateShort(payment.payment_date) : '—'}</td>
                                <td class="px-6 py-4 text-sm font-semibold text-apple-gray-900">${payment.amount || '—'}</td>
                                <td class="px-6 py-4 text-sm text-apple-gray-700">${payment.amount_net || '—'}</td>
                                <td class="px-6 py-4 text-sm text-apple-gray-700">${payment.duration || '—'}</td>
                                <td class="px-6 py-4 text-sm text-apple-gray-700">${payment.pro_before ? formatDateShort(payment.pro_before) : '—'}</td>
                                <td class="px-6 py-4 text-sm text-apple-gray-700">${payment.pro_label || '—'}</td>
                                <td class="px-6 py-4 text-sm text-apple-gray-700">${payment.source || '—'}</td>
                                <td class="px-6 py-4 text-sm">
                                    ${payment.receipt_url ? `
                                        <a
                                            href="${payment.receipt_url}"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            class="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                                            title="Открыть чек"
                                        >
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            Чек
                                        </a>
                                    ` : '<span class="text-apple-gray-400">—</span>'}
                                </td>
                                <td class="px-6 py-4 text-sm text-apple-gray-700">${payment.comment || '—'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById('payments').innerHTML = html;
}

// Chat functions with pagination
function flattenChatLogs(logs) {
    const messages = [];
    logs.forEach(log => {
        const baseTimestamp = new Date(log.created_at).getTime();

        if (log.user_input) {
            messages.push({
                type: 'user',
                text: log.user_input,
                timestamp: log.created_at,
                inputType: log.user_input_type,
                sortTime: baseTimestamp
            });
        }
        if (log.model_output) {
            messages.push({
                type: 'assistant',
                text: log.model_output,
                timestamp: log.created_at,
                sortTime: baseTimestamp + 1,
                supervisor: log.supervisor_answer ? {
                    answer: log.supervisor_answer,
                    probability: log.supervisor_probability,
                    feedback: log.supervisor_feedback
                } : null
            });
        }
    });
    return messages;
}

function sortChatMessages(a, b) {
    if (chatSortOrder === 'newest') {
        return b.sortTime - a.sortTime;
    } else {
        return a.sortTime - b.sortTime;
    }
}

function renderChatLogsPage() {
    if (!allChatMessages || allChatMessages.length === 0) {
        document.getElementById('chatLogs').innerHTML = '<div class="text-gray-500">Сообщения не найдены</div>';
        document.getElementById('chatMessagesCount').textContent = '';
        document.getElementById('chatPagination').innerHTML = '';
        return;
    }

    const sortedMessages = [...allChatMessages].sort(sortChatMessages);
    const start = currentChatPage * chatMessagesPerPage;
    const end = start + chatMessagesPerPage;
    const pageMessages = sortedMessages.slice(start, end);

    renderChatMessages(pageMessages);
    updateChatMessagesCount(start, end, sortedMessages.length);
    renderChatPagination(sortedMessages.length);
    updateSortButtons();
}

function renderChatMessages(messages) {
    const html = `
        <div class="space-y-6">
            ${messages.map(msg => {
                if (msg.type === 'user') {
                    return `
                        <div class="flex justify-end">
                            <div class="bg-apple-blue text-white rounded-apple-lg rounded-tr-none px-6 py-4 max-w-2xl shadow-apple">
                                <div class="text-xs opacity-90 mb-2.5 font-medium">👤 Пользователь • ${msg.timestamp ? formatDate(msg.timestamp) : '—'}</div>
                                <div class="whitespace-pre-wrap text-sm leading-relaxed">${escapeHtml(msg.text)}</div>
                            </div>
                        </div>
                    `;
                } else {
                    return `
                        <div class="flex justify-start">
                            <div class="bg-white border border-apple-gray-200 text-apple-gray-900 rounded-apple-lg rounded-tl-none px-6 py-4 max-w-2xl shadow-apple">
                                <div class="text-xs text-apple-gray-600 mb-2.5 font-medium">🤖 Ассистент • ${msg.timestamp ? formatDate(msg.timestamp) : '—'}</div>
                                <div class="whitespace-pre-wrap text-sm leading-relaxed text-apple-gray-900">${escapeHtml(msg.text)}</div>
                                ${msg.supervisor ? `
                                    <div class="mt-4 pt-4 border-t border-apple-gray-200 text-xs text-apple-gray-700">
                                        <strong class="font-semibold">🛡️ Супервизор:</strong> ${msg.supervisor.answer}
                                        ${msg.supervisor.probability ? ` <span class="text-apple-gray-600">(${(msg.supervisor.probability * 100).toFixed(1)}%)</span>` : ''}
                                        ${msg.supervisor.feedback ? `<br><strong class="font-semibold">Фидбек:</strong> ${escapeHtml(msg.supervisor.feedback)}` : ''}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }
            }).join('')}
        </div>
    `;

    document.getElementById('chatLogs').innerHTML = html;
}

function updateChatMessagesCount(start, end, total) {
    const actualEnd = Math.min(end, total);
    document.getElementById('chatMessagesCount').textContent = `Показано ${start + 1}–${actualEnd} из ${total}`;
}

function renderChatPagination(totalMessages) {
    const totalPages = Math.ceil(totalMessages / chatMessagesPerPage);

    if (totalPages <= 1) {
        document.getElementById('chatPagination').innerHTML = '';
        return;
    }

    const hasPrev = currentChatPage > 0;
    const hasNext = currentChatPage < totalPages - 1;

    const html = `
        <button
            onclick="changeChatPage(${currentChatPage - 1})"
            ${!hasPrev ? 'disabled' : ''}
            class="px-6 py-3 bg-white border border-apple-gray-300 text-apple-gray-700 rounded-apple hover:bg-apple-gray-50 transition font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed shadow-apple-sm"
        >
            ← Назад
        </button>
        <span class="px-5 py-3 text-sm text-apple-gray-600 font-medium">
            Страница ${currentChatPage + 1} из ${totalPages}
        </span>
        <button
            onclick="changeChatPage(${currentChatPage + 1})"
            ${!hasNext ? 'disabled' : ''}
            class="px-6 py-3 bg-white border border-apple-gray-300 text-apple-gray-700 rounded-apple hover:bg-apple-gray-50 transition font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed shadow-apple-sm"
        >
            Вперед →
        </button>
    `;

    document.getElementById('chatPagination').innerHTML = html;
}

function changeChatPage(page) {
    currentChatPage = page;
    renderChatLogsPage();
    // Scroll to chat section
    document.getElementById('chatLogs').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Helper functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDateShort(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Динамически настроить отступ контента в зависимости от высоты хедера
function adjustContentPadding() {
    const header = document.querySelector('.fixed.top-0');
    const mainContent = document.querySelector('#mainContent');

    if (header && mainContent) {
        const headerHeight = header.offsetHeight;
        mainContent.style.paddingTop = `${headerHeight}px`;
    }
}

// ==================== Section Navigation ====================

let currentSection = 'users'; // 'users' or 'payments'
let currentPaymentsPage = 0;
let paymentsPerPage = 50;
let totalPayments = 0;
let currentPaymentsFilters = {};

function switchSection(section) {
    currentSection = section;

    if (section === 'users') {
        // Show users section, hide payments section
        document.getElementById('usersSection').classList.remove('hidden');
        document.getElementById('paymentsSection').classList.add('hidden');

        // Update navigation tabs
        document.getElementById('navUsersTab').className = 'px-4 py-2 text-sm font-medium text-apple-blue border-b-2 border-apple-blue';
        document.getElementById('navPaymentsTab').className = 'px-4 py-2 text-sm font-medium text-apple-gray-600 border-b-2 border-transparent hover:text-apple-gray-900';
    } else if (section === 'payments') {
        // Show payments section, hide users section
        document.getElementById('usersSection').classList.add('hidden');
        document.getElementById('paymentsSection').classList.remove('hidden');

        // Update navigation tabs
        document.getElementById('navUsersTab').className = 'px-4 py-2 text-sm font-medium text-apple-gray-600 border-b-2 border-transparent hover:text-apple-gray-900';
        document.getElementById('navPaymentsTab').className = 'px-4 py-2 text-sm font-medium text-apple-blue border-b-2 border-apple-blue';

        // Load payments if not loaded
        if (!document.getElementById('paymentsTableContainer').querySelector('table')) {
            loadPaymentsList();
        }
    }
}

// ==================== Payments Registry Functions ====================

async function loadPaymentsList(page = 0) {
    currentPaymentsPage = page;
    const offset = page * paymentsPerPage;

    try {
        const params = new URLSearchParams({
            limit: paymentsPerPage,
            offset: offset,
            ...currentPaymentsFilters
        });

        const response = await fetch(`${API_BASE}/api/payments?${params.toString()}`, {
            headers: {
                'X-Support-Password': authPassword
            }
        });

        if (response.status === 401) {
            logout();
            return;
        }

        const data = await response.json();
        totalPayments = data.total;

        renderPaymentsList(data.payments);
        renderPaymentsPagination();

        document.getElementById('paymentsCount').textContent = totalPayments;
    } catch (error) {
        console.error('Error loading payments:', error);
        document.getElementById('paymentsTableContainer').innerHTML = '<div class="p-8 text-center text-red-500">Ошибка загрузки платежей</div>';
    }
}

function renderPaymentsList(payments) {
    if (!payments || payments.length === 0) {
        document.getElementById('paymentsTableContainer').innerHTML = '<div class="p-8 text-center text-apple-gray-500 text-sm">Платежи не найдены</div>';
        return;
    }

    const table = `
        <table class="w-full">
            <thead class="bg-apple-gray-50 border-b border-apple-gray-200">
                <tr class="h-12">
                    <th class="px-4 text-left text-xs font-semibold text-apple-gray-600 uppercase tracking-wider">User ID</th>
                    <th class="px-4 text-left text-xs font-semibold text-apple-gray-600 uppercase tracking-wider">Дата платежа</th>
                    <th class="px-4 text-left text-xs font-semibold text-apple-gray-600 uppercase tracking-wider">Сумма</th>
                    <th class="px-4 text-left text-xs font-semibold text-apple-gray-600 uppercase tracking-wider">Сумма (Net)</th>
                    <th class="px-4 text-left text-xs font-semibold text-apple-gray-600 uppercase tracking-wider">Длительность</th>
                    <th class="px-4 text-left text-xs font-semibold text-apple-gray-600 uppercase tracking-wider">PRO до</th>
                    <th class="px-4 text-left text-xs font-semibold text-apple-gray-600 uppercase tracking-wider">Источник</th>
                    <th class="px-4 text-left text-xs font-semibold text-apple-gray-600 uppercase tracking-wider">Чек</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-apple-gray-200 bg-white">
                ${payments.map(payment => `
                    <tr class="h-14 hover:bg-apple-gray-50">
                        <td class="px-4 text-sm font-medium text-apple-gray-900">${payment.telegram_user_id}</td>
                        <td class="px-4 text-xs text-apple-gray-600">${formatDate(payment.payment_date)}</td>
                        <td class="px-4 text-sm text-apple-gray-900">${payment.amount || '—'}</td>
                        <td class="px-4 text-sm text-apple-gray-600">${payment.amount_net || '—'}</td>
                        <td class="px-4 text-sm text-apple-gray-600">${payment.duration || '—'}</td>
                        <td class="px-4 text-xs text-apple-gray-600">${payment.pro_before ? formatDate(payment.pro_before) : '—'}</td>
                        <td class="px-4 text-sm text-apple-gray-600">${payment.source || '—'}</td>
                        <td class="px-4 text-sm">
                            ${payment.receipt_url ? `
                                <a href="${payment.receipt_url}" target="_blank" class="text-blue-600 hover:underline">Открыть</a>
                            ` : '<span class="text-apple-gray-400">—</span>'}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    document.getElementById('paymentsTableContainer').innerHTML = table;
}

function renderPaymentsPagination() {
    const totalPages = Math.ceil(totalPayments / paymentsPerPage);
    let html = '';

    if (currentPaymentsPage > 0) {
        html += `<button onclick="loadPaymentsList(${currentPaymentsPage - 1})" class="px-4 py-2 bg-white border border-apple-gray-200 rounded-lg hover:bg-apple-gray-50 text-sm">← Назад</button>`;
    }

    const startPage = Math.max(0, currentPaymentsPage - 2);
    const endPage = Math.min(totalPages, currentPaymentsPage + 3);

    for (let i = startPage; i < endPage; i++) {
        const activeClass = i === currentPaymentsPage ? 'bg-blue-600 text-white' : 'bg-white border border-apple-gray-200 hover:bg-apple-gray-50';
        html += `<button onclick="loadPaymentsList(${i})" class="px-4 py-2 ${activeClass} rounded-lg text-sm">${i + 1}</button>`;
    }

    if (currentPaymentsPage < totalPages - 1) {
        html += `<button onclick="loadPaymentsList(${currentPaymentsPage + 1})" class="px-4 py-2 bg-white border border-apple-gray-200 rounded-lg hover:bg-apple-gray-50 text-sm">Вперёд →</button>`;
    }

    document.getElementById('paymentsPagination').innerHTML = html;
}

function applyPaymentsFilters() {
    currentPaymentsFilters = {
        userId: document.getElementById('paymentsSearchUserId').value.trim(),
        dateFrom: document.getElementById('paymentsDateFrom').value,
        dateTo: document.getElementById('paymentsDateTo').value
    };

    currentPaymentsPage = 0;
    loadPaymentsList();
}

function resetPaymentsFilters() {
    document.getElementById('paymentsSearchUserId').value = '';
    document.getElementById('paymentsDateFrom').value = '';
    document.getElementById('paymentsDateTo').value = '';
    currentPaymentsFilters = {};
    currentPaymentsPage = 0;
    loadPaymentsList();
}

// Init payments filters
function initPaymentsFilters() {
    document.getElementById('applyPaymentsFilters').addEventListener('click', applyPaymentsFilters);
    document.getElementById('resetPaymentsFilters').addEventListener('click', resetPaymentsFilters);
}
