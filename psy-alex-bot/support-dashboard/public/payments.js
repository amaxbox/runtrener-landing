// Payments registry logic

let currentPaymentsPage = 0;
let paymentsPerPage = 50;
let totalPayments = 0;
let currentPaymentsFilters = {};

async function loadPaymentsList(page = 0) {
    currentPaymentsPage = page;
    const offset = page * paymentsPerPage;

    try {
        const params = new URLSearchParams({
            limit: paymentsPerPage,
            offset: offset,
            ...currentPaymentsFilters
        });

        const response = await apiCall(`/api/payments?${params.toString()}`);
        if (!response) return;

        const data = await response.json();
        totalPayments = data.total;

        renderPaymentsList(data.payments);
        renderPaymentsPagination();
        updatePaymentsCount();
    } catch (error) {
        console.error('Error loading payments:', error);
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
                    <th class="px-4 text-left text-xs font-semibold text-apple-gray-600 uppercase">User ID</th>
                    <th class="px-4 text-left text-xs font-semibold text-apple-gray-600 uppercase">Дата</th>
                    <th class="px-4 text-left text-xs font-semibold text-apple-gray-600 uppercase">Сумма</th>
                    <th class="px-4 text-left text-xs font-semibold text-apple-gray-600 uppercase">Net</th>
                    <th class="px-4 text-left text-xs font-semibold text-apple-gray-600 uppercase">Duration</th>
                    <th class="px-4 text-left text-xs font-semibold text-apple-gray-600 uppercase">PRO до</th>
                    <th class="px-4 text-left text-xs font-semibold text-apple-gray-600 uppercase">Источник</th>
                    <th class="px-4 text-left text-xs font-semibold text-apple-gray-600 uppercase">Чек</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-apple-gray-200 bg-white">
                ${payments.map(payment => {
                    const paymentDate = new Date(payment.payment_date).toLocaleString('ru-RU');
                    const proBefore = payment.pro_before ? new Date(payment.pro_before).toLocaleDateString('ru-RU') : '—';

                    return `
                        <tr class="h-14 hover:bg-apple-gray-50">
                            <td class="px-4 text-sm font-medium">${payment.telegram_user_id}</td>
                            <td class="px-4 text-xs text-apple-gray-600">${paymentDate}</td>
                            <td class="px-4 text-sm">${payment.amount || '—'}</td>
                            <td class="px-4 text-sm text-apple-gray-600">${payment.amount_net || '—'}</td>
                            <td class="px-4 text-sm">${payment.duration || '—'}</td>
                            <td class="px-4 text-xs">${proBefore}</td>
                            <td class="px-4 text-sm text-apple-gray-600">${payment.source || '—'}</td>
                            <td class="px-4 text-sm">
                                ${payment.receipt_url ? `<a href="${payment.receipt_url}" target="_blank" class="text-blue-600 hover:underline">Открыть</a>` : '<span class="text-apple-gray-400">—</span>'}
                            </td>
                        </tr>
                    `;
                }).join('')}
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

function updatePaymentsCount() {
    document.getElementById('paymentsCount').textContent = `Показано: ${totalPayments} платежей`;
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    auth.requireAuth();

    document.getElementById('applyPaymentsFilters')?.addEventListener('click', applyPaymentsFilters);
    document.getElementById('resetPaymentsFilters')?.addEventListener('click', resetPaymentsFilters);

    loadPaymentsList();
});
