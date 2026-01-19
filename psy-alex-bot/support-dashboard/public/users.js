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
    // Store userId in sessionStorage and redirect to view page
    sessionStorage.setItem('viewUserId', telegramUserId);
    window.location.href = `/user.html?id=${telegramUserId}`;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    auth.requireAuth();

    document.getElementById('applyFilters')?.addEventListener('click', applyFilters);
    document.getElementById('resetFilters')?.addEventListener('click', resetFilters);

    updateSubscriptionButtonStyles();
    loadUsersList();
});
