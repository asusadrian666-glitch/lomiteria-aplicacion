// js/ticket.js - Generación de Comprobantes Térmicos, WhatsApp y PDF
import { getSettings } from './db.js';

export function formatGs(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '0 Gs.';
  const val = Math.round(Number(amount));
  return val.toLocaleString('es-PY') + ' Gs.';
}

export async function renderTicket(order, containerElement) {
  const settings = await getSettings();

  const formattedDate = order.date ? order.date.split('-').reverse().join('/') : new Date().toLocaleDateString('es-PY');
  const formattedTime = order.time || new Date().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });

  let itemsHtml = '';
  (order.items || []).forEach(item => {
    let detailsHtml = '';

    if (item.removedIngredients && item.removedIngredients.length > 0) {
      detailsHtml += `<div class="ticket-item-removed">❌ Sin: ${item.removedIngredients.join(', ')}</div>`;
    }

    if (item.extras && item.extras.length > 0) {
      const extrasStr = item.extras.map(e => `+ ${e.count}x ${e.name} (${formatGs(e.price * e.count)})`).join(', ');
      detailsHtml += `<div class="ticket-item-extra">✨ ${extrasStr}</div>`;
    }

    if (item.itemNotes && item.itemNotes.trim() !== '') {
      detailsHtml += `<div class="ticket-item-obs">📝 Obs: ${item.itemNotes}</div>`;
    }

    itemsHtml += `
      <div class="ticket-item-row">
        <div class="ticket-item-main">
          <span>${item.quantity}x ${item.name}</span>
          <span>${formatGs(item.subtotal)}</span>
        </div>
        ${detailsHtml ? `<div class="ticket-item-details">${detailsHtml}</div>` : ''}
      </div>
    `;
  });

  const typeLabels = {
    delivery: '🛵 DELIVERY',
    retiro: '🥡 RETIRO EN LOCAL',
    local: '🍽️ CONSUMO EN LOCAL'
  };

  const deliveryRow = order.orderType === 'delivery' && (order.deliveryFee > 0)
    ? `<div class="ticket-total-line">
         <span>Costo Delivery:</span>
         <span>${formatGs(order.deliveryFee)}</span>
       </div>`
    : '';

  const discountRow = order.discount && order.discount > 0
    ? `<div class="ticket-total-line" style="color: #DC2626;">
         <span>Descuento:</span>
         <span>-${formatGs(order.discount)}</span>
       </div>`
    : '';

  const addressRow = order.orderType === 'delivery' && order.deliveryAddress
    ? `<div class="ticket-meta-row" style="margin-top: 4px;">
         <span class="ticket-meta-label">Dirección:</span>
         <span style="font-weight: 700; text-align: right;">${order.deliveryAddress}</span>
       </div>`
    : '';

  const generalNotesBox = order.notes && order.notes.trim() !== ''
    ? `<div class="ticket-notes-box">
         <strong>Observaciones Generales:</strong><br>
         ${order.notes}
       </div>`
    : '';

  const logoImg = settings.logoUrl 
    ? `<img src="${settings.logoUrl}" alt="Logo" class="ticket-logo" onerror="this.style.display='none'">` 
    : '';

  const html = `
    <div class="ticket-wrapper" id="thermal-receipt">
      <div class="ticket-header">
        ${logoImg}
        <div class="ticket-store-name">${settings.storeName || 'FUEGO LOMITERÍA'}</div>
        <div class="ticket-store-info">${settings.storeSlogan || ''}</div>
        <div class="ticket-store-info">${settings.storeAddress ? `📍 ${settings.storeAddress}` : ''}</div>
        <div class="ticket-store-info">${settings.storePhone ? `📞 Tel/WA: ${settings.storePhone}` : ''}</div>
        <div class="ticket-order-badge">PEDIDO #${order.orderNumber}</div>
      </div>

      <div class="ticket-meta-info">
        <div class="ticket-meta-row">
          <span class="ticket-meta-label">Fecha:</span>
          <span>${formattedDate} - ${formattedTime} hs.</span>
        </div>
        <div class="ticket-meta-row">
          <span class="ticket-meta-label">Cliente:</span>
          <span style="font-weight: 800;">${order.customerName || 'Cliente'}</span>
        </div>
        ${order.customerPhone ? `
        <div class="ticket-meta-row">
          <span class="ticket-meta-label">Teléfono:</span>
          <span>${order.customerPhone}</span>
        </div>` : ''}
        <div class="ticket-meta-row" style="margin-top: 6px;">
          <span class="ticket-meta-label">Tipo:</span>
          <span class="ticket-type-highlight">${typeLabels[order.orderType] || order.orderType}</span>
        </div>
        ${addressRow}
      </div>

      <div class="ticket-items-table">
        ${itemsHtml}
      </div>

      <div class="ticket-totals-box">
        <div class="ticket-total-line">
          <span>Subtotal Productos:</span>
          <span>${formatGs(order.subtotal)}</span>
        </div>
        ${deliveryRow}
        ${discountRow}
        <div class="ticket-grand-total">
          <span>TOTAL GENERAL:</span>
          <span>${formatGs(order.total)}</span>
        </div>
      </div>

      ${generalNotesBox}

      <div class="ticket-footer">
        ${(settings.ticketFooter || '¡Muchas gracias por su preferencia!').replace(/\n/g, '<br>')}
      </div>
    </div>
  `;

  if (containerElement) {
    containerElement.innerHTML = html;
  }
  return html;
}

// 1. IMPRIMIR EN TICKET TÉRMICO (58mm / 80mm)
export function printTicket(order) {
  // Asegurar que el ticket esté montado en el contenedor imprimible
  window.print();
}

// 2. COMPARTIR POR WHATSAPP
export async function shareOrderWhatsApp(order) {
  const settings = await getSettings();

  const formattedDate = order.date ? order.date.split('-').reverse().join('/') : new Date().toLocaleDateString('es-PY');
  const formattedTime = order.time || '';

  const typeLabels = {
    delivery: '🛵 Delivery',
    retiro: '🥡 Retiro en el local',
    local: '🍽️ Consumo en el local'
  };

  let msg = `🔥 *${(settings.storeName || 'FUEGO LOMITERÍA').toUpperCase()}* 🔥\n`;
  msg += `📋 *PEDIDO #${order.orderNumber}*\n`;
  msg += `📅 ${formattedDate} ${formattedTime ? `- ${formattedTime} hs.` : ''}\n\n`;

  msg += `👤 *Cliente:* ${order.customerName}\n`;
  if (order.customerPhone) {
    msg += `📞 *Teléfono:* ${order.customerPhone}\n`;
  }
  msg += `📍 *Modalidad:* ${typeLabels[order.orderType] || order.orderType}\n`;

  if (order.orderType === 'delivery' && order.deliveryAddress) {
    msg += `🏠 *Dirección:* ${order.deliveryAddress}\n`;
  }

  msg += `\n🛒 *DETALLE DEL PEDIDO:*\n`;
  (order.items || []).forEach((item) => {
    msg += `• *${item.quantity}x ${item.name}* — ${formatGs(item.subtotal)}\n`;

    if (item.removedIngredients && item.removedIngredients.length > 0) {
      msg += `   ❌ _Sin: ${item.removedIngredients.join(', ')}_\n`;
    }

    if (item.extras && item.extras.length > 0) {
      item.extras.forEach(ext => {
        msg += `   ✨ _+${ext.count}x ${ext.name} (${formatGs(ext.price * ext.count)})_\n`;
      });
    }

    if (item.itemNotes && item.itemNotes.trim() !== '') {
      msg += `   📝 _Obs: ${item.itemNotes}_\n`;
    }
  });

  if (order.notes && order.notes.trim() !== '') {
    msg += `\n📌 *Notas del Pedido:* ${order.notes}\n`;
  }

  msg += `\n-------------------------------\n`;
  msg += `Subtotal: ${formatGs(order.subtotal)}\n`;
  if (order.orderType === 'delivery' && order.deliveryFee > 0) {
    msg += `Delivery: ${formatGs(order.deliveryFee)}\n`;
  }
  if (order.discount && order.discount > 0) {
    msg += `Descuento: -${formatGs(order.discount)}\n`;
  }
  msg += `💰 *TOTAL A PAGAR: ${formatGs(order.total)}*\n`;
  msg += `-------------------------------\n`;
  msg += `¡Muchas gracias por su preferencia! ✨`;

  const encodedMsg = encodeURIComponent(msg);
  let cleanPhone = (order.customerPhone || '').replace(/\D/g, '');
  
  let waUrl = '';
  if (cleanPhone.length >= 8) {
    // Si no incluye código de país paraguayo 595, agregarlo
    if (!cleanPhone.startsWith('595')) {
      if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1);
      cleanPhone = '595' + cleanPhone;
    }
    waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMsg}`;
  } else {
    // Compartir a cualquier contacto
    waUrl = `https://api.whatsapp.com/send?text=${encodedMsg}`;
  }

  window.open(waUrl, '_blank');
}

// 3. DESCARGAR TICKET EN PDF
export async function downloadTicketPDF(order) {
  // Para garantizar 100% de compatibilidad móvil sin requerir internet para librerías pesadas,
  // abrimos una ventana emergente limpia formateada como ticket que ejecuta el diálogo de guardado PDF o window.print()
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    // Si el navegador bloqueó el popup, invocamos window.print directamente
    window.print();
    return;
  }

  const settings = await getSettings();
  const ticketHtml = await renderTicket(order, null);

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Ticket_Pedido_${order.orderNumber}</title>
      <style>
        body {
          font-family: 'Courier New', Courier, monospace;
          background: #FFFFFF;
          color: #000000;
          margin: 0;
          padding: 10px;
          display: flex;
          justify-content: center;
        }
        .ticket-wrapper {
          width: 320px;
          font-size: 13px;
        }
        .ticket-header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
        .ticket-logo { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; margin-bottom: 4px; }
        .ticket-store-name { font-size: 16px; font-weight: bold; }
        .ticket-order-badge { background: #000; color: #fff; font-weight: bold; padding: 2px 8px; margin: 4px 0; display: inline-block; }
        .ticket-meta-info { border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px; font-size: 12px; }
        .ticket-meta-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
        .ticket-items-table { border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
        .ticket-item-row { margin-bottom: 6px; }
        .ticket-item-main { display: flex; justify-content: space-between; font-weight: bold; }
        .ticket-item-details { font-size: 11px; padding-left: 10px; }
        .ticket-item-removed { color: #880000; }
        .ticket-totals-box { border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
        .ticket-total-line { display: flex; justify-content: space-between; }
        .ticket-grand-total { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #000; }
        .ticket-footer { text-align: center; font-size: 11px; margin-top: 8px; }
      </style>
    </head>
    <body>
      ${ticketHtml}
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
