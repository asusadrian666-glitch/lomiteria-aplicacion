// js/history-view.js - Historial de Pedidos, Control de Ventas y Exportación
import { getAllOrders, getSettings } from './db.js';
import { formatGs } from './ticket.js';
import { openOrderTicketModal } from './order.js';
import { getStatusMetadata } from './orders-view.js';
import { showToast, triggerVibration } from './app.js';

let historyFilterPeriod = 'today'; // 'today' | 'yesterday' | '7days' | 'month' | 'all' | 'custom'
let historySearchQuery = '';
let customDateValue = '';

export async function initHistoryView() {
  setupHistoryFilters();
  setupHistorySearch();
  await renderHistory();
}

function setupHistoryFilters() {
  const container = document.getElementById('history-period-chips');
  const datePicker = document.getElementById('history-custom-date');

  if (container) {
    container.querySelectorAll('.cat-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.cat-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        historyFilterPeriod = btn.dataset.period;

        if (datePicker) {
          datePicker.style.display = historyFilterPeriod === 'custom' ? 'block' : 'none';
        }

        renderHistory();
        triggerVibration(15);
      });
    });
  }

  if (datePicker) {
    datePicker.value = new Date().toISOString().split('T')[0];
    datePicker.addEventListener('change', (e) => {
      customDateValue = e.target.value;
      renderHistory();
    });
  }

  // Botones de Exportar
  const btnExportExcel = document.getElementById('btn-export-excel');
  const btnExportPDF = document.getElementById('btn-export-pdf');

  if (btnExportExcel) {
    btnExportExcel.onclick = () => exportSalesToExcel();
  }
  if (btnExportPDF) {
    btnExportPDF.onclick = () => exportSalesToPDF();
  }
}

function setupHistorySearch() {
  const input = document.getElementById('history-search-input');
  if (input) {
    input.addEventListener('input', (e) => {
      historySearchQuery = e.target.value.toLowerCase().trim();
      renderHistory();
    });
  }
}

export async function renderHistory() {
  const allOrders = await getAllOrders();
  const filteredOrders = filterOrdersByPeriodAndSearch(allOrders);

  // Calcular métricas
  renderHistoryMetrics(filteredOrders);

  // Renderizar Ranking de Productos Más Vendidos
  renderTopProducts(filteredOrders);

  // Renderizar Lista de Pedidos
  renderHistoryOrdersList(filteredOrders);
}

function filterOrdersByPeriodAndSearch(orders) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const thisMonthStr = todayStr.substring(0, 7); // 'YYYY-MM'

  return orders.filter(order => {
    // 1. Filtro de fecha
    const orderDate = order.date; // 'YYYY-MM-DD'
    let matchesPeriod = true;

    switch (historyFilterPeriod) {
      case 'today':
        matchesPeriod = (orderDate === todayStr);
        break;
      case 'yesterday':
        matchesPeriod = (orderDate === yesterdayStr);
        break;
      case '7days':
        matchesPeriod = (new Date(order.createdAt) >= sevenDaysAgo);
        break;
      case 'month':
        matchesPeriod = orderDate && orderDate.startsWith(thisMonthStr);
        break;
      case 'custom':
        matchesPeriod = (orderDate === customDateValue);
        break;
      case 'all':
      default:
        matchesPeriod = true;
        break;
    }

    if (!matchesPeriod) return false;

    // 2. Filtro de búsqueda (nombre de cliente o número de pedido)
    if (historySearchQuery) {
      const matchName = (order.customerName || '').toLowerCase().includes(historySearchQuery);
      const matchNumber = (order.orderNumber || '').toLowerCase().includes(historySearchQuery) ||
                          (`#${order.orderNumber}`).toLowerCase().includes(historySearchQuery);
      return matchName || matchNumber;
    }

    return true;
  });
}

function renderHistoryMetrics(orders) {
  // CRÍTICO: Los pedidos cancelados no deben sumarse al total vendido
  const deliveredOrders = orders.filter(o => o.status === 'entregado');
  const cancelledOrders = orders.filter(o => o.status === 'cancelado');
  
  // Total vendido en guaraníes
  const totalSales = deliveredOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  // Cantidad de productos vendidos
  let totalProductsCount = 0;
  deliveredOrders.forEach(o => {
    (o.items || []).forEach(item => {
      totalProductsCount += (item.quantity || 1);
    });
  });

  const totalSalesEl = document.getElementById('hist-total-sales');
  const totalOrdersEl = document.getElementById('hist-total-orders');
  const totalProductsEl = document.getElementById('hist-total-products');
  const cancelledOrdersEl = document.getElementById('hist-cancelled-orders');

  if (totalSalesEl) totalSalesEl.textContent = formatGs(totalSales);
  if (totalOrdersEl) totalOrdersEl.textContent = deliveredOrders.length;
  if (totalProductsEl) totalProductsEl.textContent = totalProductsCount;
  if (cancelledOrdersEl) cancelledOrdersEl.textContent = cancelledOrders.length;
}

function renderTopProducts(orders) {
  const container = document.getElementById('top-products-container');
  if (!container) return;

  const delivered = orders.filter(o => o.status === 'entregado');
  const productCountMap = {};

  delivered.forEach(order => {
    (order.items || []).forEach(item => {
      const name = item.name;
      productCountMap[name] = (productCountMap[name] || 0) + item.quantity;
    });
  });

  const sorted = Object.entries(productCountMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (sorted.length === 0) {
    container.innerHTML = `<p style="font-size:0.8rem; color:var(--text-muted); text-align:center; padding: 12px 0;">No hay ventas registradas en este período</p>`;
    return;
  }

  const maxCount = sorted[0][1] || 1;

  let html = '';
  sorted.forEach(([name, count], index) => {
    const percent = Math.round((count / maxCount) * 100);
    html += `
      <div style="margin-bottom: 8px;">
        <div style="display:flex; justify-content:space-between; font-size:0.82rem; font-weight:700; margin-bottom: 2px;">
          <span>${index + 1}. ${name}</span>
          <span style="color:var(--accent-gold);">${count} unid.</span>
        </div>
        <div style="background:var(--bg-elevated); height:6px; border-radius:3px; overflow:hidden;">
          <div style="background:linear-gradient(90deg, var(--accent-gold), var(--primary-red)); width:${percent}%; height:100%; border-radius:3px;"></div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function renderHistoryOrdersList(orders) {
  const container = document.getElementById('history-orders-list');
  if (!container) return;

  if (orders.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 10px; color: var(--text-muted);">
        <p style="font-size: 2rem; margin-bottom: 4px;">🔍</p>
        <p style="font-size: 0.95rem; font-weight: 700;">No se encontraron pedidos</p>
        <p style="font-size: 0.78rem;">Intenta cambiando los filtros o el término de búsqueda</p>
      </div>
    `;
    return;
  }

  let html = '';
  orders.forEach(order => {
    const statusMeta = getStatusMetadata(order.status);
    const dateFormatted = order.date ? order.date.split('-').reverse().join('/') : '';
    
    // Lista rápida de productos
    const itemsPreview = (order.items || []).map(i => `${i.quantity}x ${i.name}`).join(', ');

    html += `
      <div class="card" style="margin-bottom: 10px;" data-order-id="${order.id}">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
          <div>
            <span style="font-size: 1rem; font-weight: 900; color: #FFFFFF;">PEDIDO #${order.orderNumber}</span>
            <span style="font-size: 0.72rem; color: var(--text-secondary); margin-left: 6px;">${dateFormatted} ${order.time || ''}</span>
          </div>
          <span class="order-status-badge badge-${order.status}" style="font-size: 0.7rem; padding: 2px 8px;">
            ${statusMeta.label}
          </span>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
          <span style="font-size: 0.92rem; font-weight: 700;">${order.customerName}</span>
          <span style="font-size: 1rem; font-weight: 900; color: ${order.status === 'cancelado' ? '#EF4444' : 'var(--status-entregado)'};">
            ${order.status === 'cancelado' ? 'Anulado' : formatGs(order.total)}
          </span>
        </div>

        <div style="font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 8px;">
          ${itemsPreview}
        </div>

        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button class="btn-hist-ticket" data-order-id="${order.id}" style="
            background: var(--bg-input);
            border: 1px solid var(--border-subtle);
            color: var(--text-primary);
            border-radius: var(--radius-sm);
            padding: 6px 12px;
            font-size: 0.78rem;
            font-weight: 700;
            cursor: pointer;
          ">
            🧾 Ver Ticket
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll('.btn-hist-ticket').forEach(btn => {
    btn.addEventListener('click', () => {
      const orderId = btn.dataset.orderId;
      const order = orders.find(o => o.id === orderId);
      if (order) {
        openOrderTicketModal(order);
      }
    });
  });
}

// ----------------- EXPORTACIÓN A EXCEL (CSV COMPATIBLE CON EXCEL) -----------------
export async function exportSalesToExcel() {
  const allOrders = await getAllOrders();
  const orders = filterOrdersByPeriodAndSearch(allOrders);

  if (orders.length === 0) {
    showToast('No hay datos para exportar con los filtros actuales', 'error');
    return;
  }

  // Encabezados en español con formato compatible con Excel (separador coma/punto y coma)
  const headers = [
    'Numero_Pedido',
    'Fecha',
    'Hora',
    'Cliente',
    'Telefono',
    'Tipo_Pedido',
    'Direccion_Delivery',
    'Productos_Detalle',
    'Subtotal_Productos_Gs',
    'Delivery_Gs',
    'Descuento_Gs',
    'Total_General_Gs',
    'Estado'
  ];

  const rows = orders.map(o => {
    const itemsSummary = (o.items || []).map(i => {
      let desc = `${i.quantity}x ${i.name}`;
      if (i.removedIngredients && i.removedIngredients.length > 0) desc += ` (Sin: ${i.removedIngredients.join(', ')})`;
      if (i.extras && i.extras.length > 0) desc += ` (+${i.extras.map(e => e.count + ' ' + e.name).join(', ')})`;
      return desc;
    }).join(' | ');

    return [
      `#${o.orderNumber}`,
      o.date || '',
      o.time || '',
      `"${(o.customerName || '').replace(/"/g, '""')}"`,
      `"${(o.customerPhone || '').replace(/"/g, '""')}"`,
      o.orderType || '',
      `"${(o.deliveryAddress || '').replace(/"/g, '""')}"`,
      `"${itemsSummary.replace(/"/g, '""')}"`,
      o.subtotal || 0,
      o.deliveryFee || 0,
      o.discount || 0,
      o.total || 0,
      o.status || ''
    ];
  });

  // Agregar UTF-8 BOM (\uFEFF) para que Excel reconozca tildes y caracteres en español correctamente
  const csvContent = '\uFEFF' + [
    headers.join(';'),
    ...rows.map(r => r.join(';'))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Ventas_Lomiteria_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast('📊 Reporte Excel descargado con éxito', 'success');
}

// ----------------- EXPORTACIÓN DE INFORME PDF -----------------
export async function exportSalesToPDF() {
  const allOrders = await getAllOrders();
  const orders = filterOrdersByPeriodAndSearch(allOrders);
  const settings = await getSettings();

  if (orders.length === 0) {
    showToast('No hay datos para exportar con los filtros actuales', 'error');
    return;
  }

  const delivered = orders.filter(o => o.status === 'entregado');
  const cancelled = orders.filter(o => o.status === 'cancelado');
  const totalSales = delivered.reduce((sum, o) => sum + (o.total || 0), 0);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  let tableRows = '';
  orders.forEach(o => {
    tableRows += `
      <tr>
        <td style="padding:6px; border:1px solid #ddd;">#${o.orderNumber}</td>
        <td style="padding:6px; border:1px solid #ddd;">${o.date} ${o.time}</td>
        <td style="padding:6px; border:1px solid #ddd;">${o.customerName}</td>
        <td style="padding:6px; border:1px solid #ddd;">${o.orderType.toUpperCase()}</td>
        <td style="padding:6px; border:1px solid #ddd;">${getStatusMetadata(o.status).label}</td>
        <td style="padding:6px; border:1px solid #ddd; text-align:right;">${formatGs(o.total)}</td>
      </tr>
    `;
  });

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Informe_Ventas_${settings.storeName}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
        h1 { margin-bottom: 4px; color: #111; }
        .summary-box { display: flex; gap: 20px; margin: 15px 0; background: #f4f4f4; padding: 12px; border-radius: 6px; }
        .summary-item { font-size: 14px; }
        .summary-item strong { display: block; font-size: 18px; color: #000; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
        th { background: #333; color: #fff; padding: 8px; text-align: left; }
      </style>
    </head>
    <body>
      <h1>${settings.storeName} - Reporte de Ventas</h1>
      <p>Generado el: ${new Date().toLocaleString('es-PY')}</p>
      
      <div class="summary-box">
        <div class="summary-item">Total Vendido: <strong>${formatGs(totalSales)}</strong></div>
        <div class="summary-item">Pedidos Entregados: <strong>${delivered.length}</strong></div>
        <div class="summary-item">Pedidos Cancelados: <strong>${cancelled.length}</strong></div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Nº</th>
            <th>Fecha/Hora</th>
            <th>Cliente</th>
            <th>Tipo</th>
            <th>Estado</th>
            <th style="text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}
