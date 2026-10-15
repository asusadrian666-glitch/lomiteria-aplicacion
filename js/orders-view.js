// js/orders-view.js - Gestión de Pedidos Activos
import { getAllOrders, updateOrderStatus } from './db.js';
import { formatGs } from './ticket.js';
import { openOrderTicketModal } from './order.js';
import { showToast, triggerVibration, updateDailyStatsUI } from './app.js';

let activeFilter = 'todos';

export async function initOrdersView() {
  setupFilterTabs();
  await renderActiveOrders();
}

function setupFilterTabs() {
  const container = document.getElementById('orders-filter-scroll');
  if (!container) return;

  container.querySelectorAll('.status-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.status-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.status;
      renderActiveOrders();
      triggerVibration(15);
    });
  });
}

export async function renderActiveOrders() {
  const container = document.getElementById('active-orders-container');
  if (!container) return;

  const allOrders = await getAllOrders();
  
  // Filtrar activos (los entregados y cancelados van al historial)
  let activeOrders = allOrders.filter(o => o.status !== 'entregado' && o.status !== 'cancelado');

  // Ordenar: Los pedidos pendientes primero, luego en preparación, luego listos, luego en camino
  const statusPriority = {
    'pendiente': 1,
    'preparacion': 2,
    'listo': 3,
    'camino': 4
  };

  activeOrders.sort((a, b) => {
    const prioA = statusPriority[a.status] || 99;
    const prioB = statusPriority[b.status] || 99;
    if (prioA !== prioB) return prioA - prioB;
    return new Date(a.createdAt) - new Date(b.createdAt); // Más antiguos primero dentro del mismo estado
  });

  // Filtro por tab seleccionado
  if (activeFilter !== 'todos') {
    activeOrders = activeOrders.filter(o => o.status === activeFilter);
  }

  // Actualizar contador del badge en header y bottom nav
  const pendingCount = allOrders.filter(o => o.status !== 'entregado' && o.status !== 'cancelado').length;
  const badgeEl = document.getElementById('active-orders-badge');
  const navDot = document.getElementById('orders-nav-dot');
  if (badgeEl) badgeEl.textContent = pendingCount;
  if (navDot) navDot.style.display = pendingCount > 0 ? 'block' : 'none';

  if (activeOrders.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 45px 15px; color: var(--text-muted);">
        <p style="font-size: 2.5rem; margin-bottom: 8px;">📋</p>
        <p style="font-size: 1.1rem; font-weight: 800; color: #FFFFFF;">No hay pedidos activos</p>
        <p style="font-size: 0.85rem; margin-top: 4px;">Los nuevos pedidos aparecerán aquí automáticamente</p>
      </div>
    `;
    return;
  }

  let html = '';
  activeOrders.forEach(order => {
    const statusInfo = getStatusMetadata(order.status);
    const nextStatus = getNextLogicalStatus(order.status, order.orderType);

    // Resumen de items
    let itemsText = order.items.map(i => {
      let mod = '';
      if (i.removedIngredients && i.removedIngredients.length > 0) {
        mod += ` (Sin ${i.removedIngredients.join(', ')})`;
      }
      if (i.extras && i.extras.length > 0) {
        mod += ` (+${i.extras.map(e => e.count + ' ' + e.name).join(', ')})`;
      }
      return `<div><strong>${i.quantity}x</strong> ${i.name}${mod}</div>`;
    }).join('');

    const timeAgo = formatTimeAgo(order.createdAt);

    html += `
      <div class="order-card" data-order-id="${order.id}">
        <div class="order-card-header">
          <div class="order-number-tag">PEDIDO #${order.orderNumber}</div>
          <span class="order-type-badge type-${order.orderType}">
            ${getOrderTypeIcon(order.orderType)} ${order.orderType.toUpperCase()}
          </span>
        </div>

        <div class="order-client-row">
          <div>
            <div class="order-client-name">${order.customerName}</div>
            ${order.customerPhone ? `
              <a href="tel:${order.customerPhone}" style="color:var(--text-secondary); font-size:0.8rem; text-decoration:none;">
                📞 ${order.customerPhone}
              </a>
            ` : ''}
          </div>
          <div class="order-time-ago">${timeAgo}</div>
        </div>

        ${order.orderType === 'delivery' && order.deliveryAddress ? `
          <div style="font-size: 0.82rem; color: #38BDF8; display: flex; align-items: center; gap: 4px;">
            <span>📍 ${order.deliveryAddress}</span>
          </div>
        ` : ''}

        <div class="order-items-snippet">
          ${itemsText}
          ${order.notes ? `<div style="color: #FBBF24; font-style: italic; margin-top: 4px;">📝 Obs: ${order.notes}</div>` : ''}
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div class="order-status-badge badge-${order.status}">
            <span class="live-dot" style="background:${statusInfo.color}"></span>
            ${statusInfo.label}
          </div>
          <div style="font-size: 1.15rem; font-weight: 900; color: var(--accent-gold);">
            ${formatGs(order.total)}
          </div>
        </div>

        <div class="order-card-actions">
          ${nextStatus ? `
            <button class="btn-order-advance" data-order-id="${order.id}" data-next-status="${nextStatus.status}">
              ${nextStatus.icon} Pasar a ${nextStatus.label}
            </button>
          ` : ''}
          
          <button class="btn-order-ticket" data-order-id="${order.id}">
            🧾 Ticket
          </button>

          <button class="btn-change-status-modal" data-order-id="${order.id}" style="background:var(--bg-input); border:1px solid var(--border-subtle); color:var(--text-secondary); border-radius:var(--radius-sm); padding:10px 12px; cursor:pointer;" title="Más opciones">
            ⚙️
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Listeners de avance rápido de estado
  container.querySelectorAll('.btn-order-advance').forEach(btn => {
    btn.addEventListener('click', async () => {
      const orderId = btn.dataset.orderId;
      const nextStat = btn.dataset.nextStatus;
      await updateOrderStatus(orderId, nextStat);
      triggerVibration(40);
      showToast(`Estado actualizado a: ${getStatusMetadata(nextStat).label}`, 'success');
      await renderActiveOrders();
      updateDailyStatsUI();
    });
  });

  // Listener para ver ticket
  container.querySelectorAll('.btn-order-ticket').forEach(btn => {
    btn.addEventListener('click', () => {
      const orderId = btn.dataset.orderId;
      const order = allOrders.find(o => o.id === orderId);
      if (order) {
        openOrderTicketModal(order);
      }
    });
  });

  // Listener para menú desplegable de estados (cambiar a cualquier estado o cancelar)
  container.querySelectorAll('.btn-change-status-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      const orderId = btn.dataset.orderId;
      openStatusPickerSheet(orderId);
    });
  });
}

function getOrderTypeIcon(type) {
  switch (type) {
    case 'delivery': return '🛵';
    case 'retiro': return '🥡';
    case 'local': return '🍽️';
    default: return '📦';
  }
}

export function getStatusMetadata(status) {
  switch (status) {
    case 'pendiente':
      return { label: 'Pendiente', color: '#F59E0B' };
    case 'preparacion':
      return { label: 'En Preparación', color: '#3B82F6' };
    case 'listo':
      return { label: 'Listo', color: '#8B5CF6' };
    case 'camino':
      return { label: 'En Camino', color: '#06B6D4' };
    case 'entregado':
      return { label: 'Entregado', color: '#10B981' };
    case 'cancelado':
      return { label: 'Cancelado', color: '#EF4444' };
    default:
      return { label: status, color: '#94A3B8' };
  }
}

function getNextLogicalStatus(currentStatus, orderType) {
  switch (currentStatus) {
    case 'pendiente':
      return { status: 'preparacion', label: 'Preparación', icon: '🍳' };
    case 'preparacion':
      return { status: 'listo', label: 'Listo', icon: '✅' };
    case 'listo':
      if (orderType === 'delivery') {
        return { status: 'camino', label: 'En Camino', icon: '🛵' };
      }
      return { status: 'entregado', label: 'Entregado', icon: '🎉' };
    case 'camino':
      return { status: 'entregado', label: 'Entregado', icon: '🎉' };
    default:
      return null;
  }
}

function formatTimeAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Hace instantes';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  return `Hace ${hours} h ${mins % 60} m`;
}

// Modal Selector Completo de Estados
function openStatusPickerSheet(orderId) {
  const modal = document.getElementById('status-picker-modal');
  const optionsContainer = document.getElementById('status-picker-options');
  if (!modal || !optionsContainer) return;

  const statuses = [
    { key: 'pendiente', label: '🟡 Pendiente', desc: 'Recién ingresado a la cocina' },
    { key: 'preparacion', label: '🔵 En Preparación', desc: 'Cocinando en la plancha' },
    { key: 'listo', label: '🟣 Listo para entrega/retiro', desc: 'Empaquetado y listo' },
    { key: 'camino', label: '🚙 En Camino (Delivery)', desc: 'Repartidor en trayecto' },
    { key: 'entregado', label: '🟢 Entregado (Finalizar pedido)', desc: 'Pasa automáticamente al Historial' },
    { key: 'cancelado', label: '🔴 Cancelar Pedido', desc: 'Anular este pedido' }
  ];

  let html = '';
  statuses.forEach(s => {
    html += `
      <button class="status-option-btn" data-status="${s.key}" style="
        width: 100%;
        text-align: left;
        background: var(--bg-input);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-sm);
        padding: 12px 14px;
        margin-bottom: 8px;
        color: #FFFFFF;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 2px;
      ">
        <span style="font-weight: 800; font-size: 0.95rem;">${s.label}</span>
        <span style="font-size: 0.74rem; color: var(--text-secondary);">${s.desc}</span>
      </button>
    `;
  });

  optionsContainer.innerHTML = html;
  modal.classList.add('active');

  optionsContainer.querySelectorAll('.status-option-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const selectedStatus = btn.dataset.status;

      if (selectedStatus === 'cancelado') {
        if (!confirm('¿Estás seguro de que deseas cancelar este pedido?')) {
          return;
        }
      }

      await updateOrderStatus(orderId, selectedStatus);
      modal.classList.remove('active');
      triggerVibration(40);
      showToast(`Pedido actualizado: ${getStatusMetadata(selectedStatus).label}`, 'success');
      await renderActiveOrders();
      updateDailyStatsUI();
    });
  });

  const closeBtn = document.getElementById('close-status-picker');
  if (closeBtn) closeBtn.onclick = () => modal.classList.remove('active');
}
