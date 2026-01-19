// Users page logic

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
let chatSortOrder = 'newest';

async function loadUsersList() {
    try {
        const params = new URLSearchParams({
            limit: usersPerPage,
            offset: currentPage * usersPerPage,
            sortBy: currentSortBy,
            sortOrder: currentSortOrder,
            ...currentFilters,
            ...(currentSubscriptionFilter && { subscribe: currentSubscriptionFilter })
        });

        const response = await apiCall(`/api/users?${params.toString()}`);
        if (!response) return;

        const data = await response.json();
        totalUsers = data.total;

        renderUsersList(data.users);
        renderPagination();
        updateUserCount();
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function renderUsersList(users) {
    if (!users || users.length === 0) {
        document.getElementById('usersTableContainer').innerHTML = '<div class="p-8 text-center text-apple-gray-500 text-sm">Пользователи не найдены</div>';
        return;
    }

    const html = `
        <table class="w-full">
            <thead class="bg-apple-gray-50 border-b border-apple-gray-200">
                <tr class="h-12">
                    <th class="px-4 text-left text-xs font-semibold text-apple-gray-600 uppercase">ID</th>
                    <th class="px-4 text-left text-xs font-semibold text-apple-gray-600 uppercase">Имя / Username</th>
                    <th class="px-4 text-left text-xs font-semibold text-apple-gray-600 uppercase">Статус</th>
                    <th class="px-4 text-left text-xs font-semibold text-apple-gray-600 uppercase">Подписка</th>
                    <th class="px-4 text-left text-xs font-semibold text-apple-gray-600 uppercase">Регистрация</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-apple-gray-200">
                ${users.map(user => {
                    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || '—';
                    const username = user.username ? `@${user.username}` : '';
                    const createdDate = user.created_at ? new Date(user.created_at).toLocaleDateString('ru-RU') : '—';
                    const subscribeBadge = user.subscribe === 'pro'
                        ? '<span class="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-apple font-medium">PRO</span>'
                        : '<span class="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-apple font-medium">Free</span>';

                    return `
                        <tr class="h-14 hover:bg-apple-gray-50 cursor-pointer transition" onclick="viewUser(${user.telegram_user_id})">
                            <td class="px-4 text-sm font-medium">${user.telegram_user_id}</td>
                            <td class="px-4 text-sm">${fullName} ${username}</td>
                            <td class="px-4 text-sm"><span class="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-apple">${user.status}</span></td>
                            <td class="px-4 text-sm">${subscribeBadge}</td>
                            <td class="px-4 text-sm text-apple-gray-600">${createdDate}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;

    document.getElementById('usersTableContainer').innerHTML = html;
}

function renderPagination() {
    const totalPages = Math.ceil(totalUsers / usersPerPage);
    let html = '';

    if (currentPage > 0) {
        html += `<button onclick="loadPage(${currentPage - 1})" class="px-4 py-2 bg-white border border-apple-gray-200 rounded-lg hover:bg-apple-gray-50 text-sm">← Назад</button>`;
    }

    const startPage = Math.max(0, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 3);

    for (let i = startPage; i < endPage; i++) {
        const activeClass = i === currentPage ? 'bg-blue-600 text-white' : 'bg-white border border-apple-gray-200 hover:bg-apple-gray-50';
        html += `<button onclick="loadPage(${i})" class="px-4 py-2 ${activeClass} rounded-lg text-sm">${i + 1}</button>`;
    }

    if (currentPage < totalPages - 1) {
        html += `<button onclick="loadPage(${currentPage + 1})" class="px-4 py-2 bg-white border border-apple-gray-200 rounded-lg hover:bg-apple-gray-50 text-sm">Вперёд →</button>`;
    }

    document.getElementById('pagination').innerHTML = html;
}

function updateUserCount() {
    document.getElementById('usersCount').textContent = `Найдено: ${totalUsers} пользователей`;
}

function loadPage(page) {
    currentPage = page;
    loadUsersList();
    document.getElementById('usersTableContainer').scrollIntoView({ behavior: 'smooth' });
}

function setSubscriptionFilter(filter) {
    currentSubscriptionFilter = filter;
    currentPage = 0;
    updateSubscriptionButtonStyles();
    loadUsersList();
}

function updateSubscriptionButtonStyles() {
    ['all', 'free', 'pro'].forEach(type => {
        const btn = document.getElementById(`subTab${type.charAt(0).toUpperCase() + type.slice(1)}`);
        if (!btn) return;

        if ((type === 'all' && !currentSubscriptionFilter) ||
            (type === 'free' && currentSubscriptionFilter === 'free') ||
            (type === 'pro' && currentSubscriptionFilter === 'pro')) {
            btn.className = 'flex-1 px-2 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium';
        } else {
            btn.className = 'flex-1 px-2 py-1.5 bg-apple-gray-100 text-apple-gray-700 rounded-lg text-xs font-medium hover:bg-apple-gray-200';
        }
    });
}

function applyFilters() {
    const search = document.getElementById('searchInput').value;
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const status = document.getElementById('statusFilter').value;

    currentFilters = {
        ...(search && { search }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
        ...(status && { status })
    };

    currentPage = 0;
    loadUsersList();
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    document.getElementById('statusFilter').value = '';
    currentSubscriptionFilter = '';
    currentFilters = {};
    currentPage = 0;
    updateSubscriptionButtonStyles();
    loadUsersList();
}

function viewUser(telegramUserId) {
    // Open side panel with user details
    currentSelectedUserId = telegramUserId;
    document.getElementById('userDetailPanel').classList.remove('hidden');

    // Load user data
    loadUserData(telegramUserId);
    switchTab('chat');
}

function closeUserDetail() {
    // Hide side panel
    document.getElementById('userDetailPanel').classList.add('hidden');
    currentSelectedUserId = null;
}

function switchTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none';
    });

    // Show selected tab
    const selectedTab = document.getElementById(`tab-${tabName}`);
    if (selectedTab) {
        selectedTab.classList.add('active');
        selectedTab.style.display = 'block';
    }

    // Update tab button styles
    document.querySelectorAll('.tab-button').forEach(btn => {
        if (btn.dataset.tab === tabName) {
            btn.className = 'tab-button py-4 text-sm font-medium text-apple-blue border-b-2 border-apple-blue whitespace-nowrap transition';
        } else {
            btn.className = 'tab-button py-4 text-sm font-medium text-apple-gray-600 border-b-2 border-transparent whitespace-nowrap hover:text-apple-gray-900 transition';
        }
    });
}

async function loadUserData(telegramUserId) {
    try {
        const response = await apiCall(`/api/user/${telegramUserId}`);
        if (!response) return;

        const data = await response.json();

        // Update user header info
        const fullName = [data.userInfo.first_name, data.userInfo.last_name].filter(Boolean).join(' ') || '—';
        document.getElementById('userNameHeader').textContent = fullName;
        document.getElementById('userIdHeader').textContent = `ID: ${telegramUserId}`;

        // Render all data
        renderChatMessages(data.chatLogs || []);
        renderTherapyProfile(data.therapyProfile || {});
        renderUserPayments(data.payments || []);
        renderUserInfo(data.userInfo);

        // Update messages count
        const totalMessages = data.chatLogs?.length || 0;
        document.getElementById('chatMessagesCount').textContent = totalMessages > 0
            ? `Показано 1-${Math.min(50, totalMessages)} из ${totalMessages}`
            : 'Сообщений не найдено';
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Chat messages are loaded with user data, this is kept for backward compatibility
async function loadChatMessages(telegramUserId, page = 0) {
    // Messages are now loaded with loadUserData
    return;
}

function renderChatMessages(messages) {
    if (!messages || messages.length === 0) {
        document.getElementById('chatLogs').innerHTML = '<div class="text-center text-apple-gray-600">Сообщений не найдено</div>';
        return;
    }

    const html = messages.map(msg => `
        <div class="mb-4 p-4 bg-apple-gray-50 rounded-apple">
            <div class="flex justify-between items-start mb-2">
                <span class="text-xs font-medium text-apple-gray-600">${msg.role || 'User'}</span>
                <span class="text-xs text-apple-gray-500">${new Date(msg.created_at).toLocaleString('ru-RU')}</span>
            </div>
            <p class="text-sm text-apple-gray-900">${msg.content || '—'}</p>
        </div>
    `).join('');

    document.getElementById('chatLogs').innerHTML = html;
}

function renderChatPagination(telegramUserId, currentPage, totalPages) {
    let html = '';

    if (currentPage > 0) {
        html += `<button onclick="viewUser(${telegramUserId}); loadChatMessages(${telegramUserId}, ${currentPage - 1})" class="px-4 py-2 bg-white border border-apple-gray-200 rounded-lg hover:bg-apple-gray-50 text-sm">← Назад</button>`;
    }

    for (let i = Math.max(0, currentPage - 2); i < Math.min(totalPages, currentPage + 3); i++) {
        const activeClass = i === currentPage ? 'bg-blue-600 text-white' : 'bg-white border border-apple-gray-200 hover:bg-apple-gray-50';
        html += `<button onclick="viewUser(${telegramUserId}); loadChatMessages(${telegramUserId}, ${i})" class="px-4 py-2 ${activeClass} rounded-lg text-sm">${i + 1}</button>`;
    }

    if (currentPage < totalPages - 1) {
        html += `<button onclick="viewUser(${telegramUserId}); loadChatMessages(${telegramUserId}, ${currentPage + 1})" class="px-4 py-2 bg-white border border-apple-gray-200 rounded-lg hover:bg-apple-gray-50 text-sm">Вперёд →</button>`;
    }

    document.getElementById('chatPagination').innerHTML = html;
}

// Therapy profile is loaded with user data
async function loadTherapyProfile(telegramUserId) {
    return;
}

function renderTherapyProfile(data) {
    if (!data) {
        document.getElementById('therapyProfile').innerHTML = '<div class="text-center text-apple-gray-600">Данные не найдены</div>';
        return;
    }

    const html = `
        <div class="space-y-4">
            ${Object.entries(data).map(([key, value]) => `
                <div class="p-4 bg-apple-gray-50 rounded-apple">
                    <span class="text-xs font-medium text-apple-gray-600">${key}</span>
                    <p class="text-sm text-apple-gray-900 mt-1">${value || '—'}</p>
                </div>
            `).join('')}
        </div>
    `;

    document.getElementById('therapyProfile').innerHTML = html;
}

// Payments are loaded with user data
async function loadUserPayments(telegramUserId) {
    return;
}

function renderUserPayments(payments) {
    if (!payments || payments.length === 0) {
        document.getElementById('payments').innerHTML = '<div class="text-center text-apple-gray-600">Платежей не найдено</div>';
        return;
    }

    const html = payments.map(payment => `
        <div class="mb-4 p-4 bg-apple-gray-50 rounded-apple">
            <div class="flex justify-between items-start mb-2">
                <span class="text-sm font-medium text-apple-gray-900">${payment.amount || '—'} ₽</span>
                <span class="text-xs text-apple-gray-500">${new Date(payment.payment_date).toLocaleDateString('ru-RU')}</span>
            </div>
            <p class="text-xs text-apple-gray-600">Длительность: ${payment.duration || '—'}</p>
            ${payment.receipt_url ? `<a href="${payment.receipt_url}" target="_blank" class="text-xs text-blue-600 hover:underline mt-2 inline-block">Чек</a>` : ''}
        </div>
    `).join('');

    document.getElementById('payments').innerHTML = html;
}

function renderUserInfo(user) {
    const info = {
        'ID': user.telegram_user_id,
        'Имя': user.first_name || '—',
        'Фамилия': user.last_name || '—',
        'Username': user.username ? `@${user.username}` : '—',
        'Статус': user.status || '—',
        'Подписка': user.subscribe === 'pro' ? 'PRO' : 'Free',
        'Регистрация': user.created_at ? new Date(user.created_at).toLocaleDateString('ru-RU') : '—',
        'Последняя активность': user.updated_at ? new Date(user.updated_at).toLocaleDateString('ru-RU') : '—',
    };

    const html = `
        <div class="space-y-3">
            ${Object.entries(info).map(([key, value]) => `
                <div class="p-3 bg-apple-gray-50 rounded-apple">
                    <span class="text-xs font-medium text-apple-gray-600">${key}</span>
                    <p class="text-sm text-apple-gray-900 mt-1">${value}</p>
                </div>
            `).join('')}
        </div>
    `;

    document.getElementById('userInfo').innerHTML = html;
}

function shareUserLink() {
    if (!currentSelectedUserId) return;
    const link = `${window.location.origin}/users.html?user=${currentSelectedUserId}`;
    navigator.clipboard.writeText(link).then(() => {
        alert('Ссылка скопирована в буфер обмена');
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    auth.requireAuth();

    document.getElementById('applyFilters')?.addEventListener('click', applyFilters);
    document.getElementById('resetFilters')?.addEventListener('click', resetFilters);

    // Tab switching
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Chat sort buttons
    document.getElementById('sortNewestFirst')?.addEventListener('click', () => {
        chatSortOrder = 'newest';
        if (currentSelectedUserId) loadChatMessages(currentSelectedUserId);
    });

    document.getElementById('sortOldestFirst')?.addEventListener('click', () => {
        chatSortOrder = 'oldest';
        if (currentSelectedUserId) loadChatMessages(currentSelectedUserId);
    });

    updateSubscriptionButtonStyles();
    loadUsersList();
});
