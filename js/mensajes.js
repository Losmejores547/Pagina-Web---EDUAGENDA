/**
 * EduAgenda – Módulo de Mensajes
 */

const ModuloMensajes = {
  _mensajes: [],
  _msgActivo: null,

  async cargar() {
    const listEl = document.getElementById('msg-list');
    listEl.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i></div>';

    const user = Auth.getUser();
    const resp = await API.get('mensajes', { limit: 200 });
    let msgs   = resp.data || [];

    // Filtrar mensajes del usuario (enviados o recibidos)
    msgs = msgs.filter(m =>
      m.id_destinatario === user.id ||
      m.id_remitente === user.id
    );

    // Ordenar por fecha desc
    msgs.sort((a,b) => new Date(b.fecha_enviado) - new Date(a.fecha_enviado));
    this._mensajes = msgs;
    this._renderLista(msgs);
    this._actualizarBadge(msgs);
    this._initBusqueda(msgs);
  },

  _actualizarBadge(msgs) {
    const user   = Auth.getUser();
    const noLeidos = msgs.filter(m => m.id_destinatario === user.id && !m.leido).length;
    const badge  = document.getElementById('msg-badge');
    const notifCount = document.getElementById('notif-count');
    if (noLeidos > 0) {
      badge.textContent = noLeidos;
      badge.classList.remove('hidden');
      notifCount.textContent = noLeidos;
      notifCount.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
      notifCount.classList.add('hidden');
    }
  },

  _initBusqueda(msgs) {
    const input = document.getElementById('search-msg');
    input.addEventListener('input', debounce(() => {
      const q = input.value.toLowerCase();
      const filtrados = msgs.filter(m =>
        (m.nombre_remitente || '').toLowerCase().includes(q) ||
        (m.nombre_destinatario || '').toLowerCase().includes(q) ||
        (m.contenido || '').toLowerCase().includes(q)
      );
      this._renderLista(filtrados);
    }, 300));
  },

  _renderLista(msgs) {
    const user   = Auth.getUser();
    const listEl = document.getElementById('msg-list');
    if (!msgs.length) {
      listEl.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No hay mensajes</p></div>';
      return;
    }
    listEl.innerHTML = msgs.map(m => {
      const esRecibido  = m.id_destinatario === user.id;
      const contraparte = esRecibido ? m.nombre_remitente : m.nombre_destinatario;
      const noLeido     = esRecibido && !m.leido;
      const preview     = (m.contenido || '').replace(/<[^>]+>/g, '').substring(0, 60);
      return `
      <div class="msg-item ${noLeido ? 'unread' : ''} ${this._msgActivo === m.id ? 'active' : ''}"
           data-id="${m.id}" onclick="ModuloMensajes.verMensaje('${m.id}')">
        <div class="msg-avatar-sm">${iniciales(contraparte || '?')}</div>
        <div class="msg-item-body">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="msg-sender">${sanitize(contraparte || '—')}</span>
            <span class="msg-time">${this._formatHora(m.fecha_enviado)}</span>
          </div>
          <p class="msg-text-main">${sanitize(preview)}...</p>
        </div>
        ${noLeido ? '<div style="width:8px;height:8px;border-radius:50%;background:var(--primary);flex-shrink:0;margin-top:.3rem;"></div>' : ''}
      </div>`;
    }).join('');
  },

  _formatHora(fecha) {
    if (!fecha) return '';
    const d = new Date(fecha);
    const ahora = new Date();
    const diff  = (ahora - d) / 86400000;
    if (diff < 1) return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    if (diff < 7) return d.toLocaleDateString('es-CO', { weekday: 'short' });
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  },

  async verMensaje(id) {
    this._msgActivo = id;
    const msg = this._mensajes.find(m => m.id === id);
    if (!msg) return;

    // Marcar como leído
    const user = Auth.getUser();
    if (msg.id_destinatario === user.id && !msg.leido) {
      await API.patch('mensajes', id, { leido: true });
      msg.leido = true;
      this._actualizarBadge(this._mensajes);
    }

    // Re-render lista para quitar indicador
    this._renderLista(this._mensajes);

    const detailPanel = document.getElementById('msg-detail');
    const contraparte = msg.id_destinatario === user.id ? msg.nombre_remitente : msg.nombre_destinatario;
    detailPanel.innerHTML = `
      <div class="msg-detail-header">
        <div style="display:flex;align-items:center;gap:.75rem;">
          <div class="msg-avatar-sm">${iniciales(contraparte || '?')}</div>
          <div>
            <h3>${sanitize(contraparte || '—')}</h3>
            <p>
              ${msg.id_destinatario === user.id ? '📨 Recibido' : '📤 Enviado'} ·
              ${formatearFecha(msg.fecha_enviado)}
            </p>
          </div>
        </div>
        <button class="btn-danger" onclick="ModuloMensajes.eliminar('${msg.id}')">
          <i class="fas fa-trash"></i> Eliminar
        </button>
      </div>
      <div class="msg-detail-body">
        ${msg.contenido || '<em>Mensaje vacío</em>'}
      </div>`;
  },

  abrirFormulario() {
    const html = `
      <div class="form-group">
        <label><i class="fas fa-user"></i> Destinatario (nombre o correo)</label>
        <input type="text" id="msg-dest-nombre" placeholder="Nombre del destinatario" />
        <input type="hidden" id="msg-dest-id" />
        <small class="help-text">El destinatario debe estar registrado en EduAgenda.</small>
      </div>
      <div class="form-group">
        <label><i class="fas fa-align-left"></i> Mensaje</label>
        <textarea id="msg-contenido" rows="5" placeholder="Escribe tu mensaje aquí..." style="width:100%;padding:.65rem;border:2px solid var(--border);border-radius:var(--radius-sm);background:var(--surface);color:var(--text-main);resize:vertical;"></textarea>
      </div>
      <p style="font-size:.8rem;color:var(--text-muted);">
        <i class="fas fa-info-circle"></i> Puedes usar HTML básico en el mensaje (negrita, etc.)
      </p>
    `;
    abrirModal({
      titulo: 'Nuevo Mensaje',
      cuerpo: html,
      textoConfirmar: 'Enviar Mensaje',
      onConfirm: async () => {
        const destNombre = val('msg-dest-nombre');
        const contenido  = document.getElementById('msg-contenido').value.trim();
        if (!destNombre || !contenido) {
          showToast('Completa todos los campos.', 'error');
          return;
        }

        // Buscar destinatario en la tabla de usuarios
        const resp = await API.get('usuarios', { limit: 200 });
        const usuarios = resp.data || [];
        const dest = usuarios.find(u =>
          u.nombre?.toLowerCase().includes(destNombre.toLowerCase()) ||
          u.correo?.toLowerCase() === destNombre.toLowerCase()
        );

        if (!dest) {
          showToast('Usuario destinatario no encontrado.', 'error');
          return;
        }

        const user = Auth.getUser();
        const nuevo = {
          id:                crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
          id_remitente:      user.id,
          nombre_remitente:  user.nombre,
          rol_remitente:     user.rol,
          id_destinatario:   dest.id,
          nombre_destinatario: dest.nombre,
          contenido,
          fecha_enviado:     new Date().toISOString(),
          leido:             false
        };

        await API.create('mensajes', nuevo);
        cerrarModal();
        showToast('Mensaje enviado exitosamente. ✉️', 'success');
        await this.cargar();
      }
    });
  },

  eliminar(id) {
    abrirModal({
      titulo: 'Eliminar Mensaje',
      cuerpo: '<p>¿Eliminar este mensaje permanentemente?</p>',
      textoConfirmar: 'Eliminar',
      onConfirm: async () => {
        await API.delete('mensajes', id);
        cerrarModal();
        document.getElementById('msg-detail').innerHTML = `
          <div class="msg-empty-state">
            <i class="fas fa-comments"></i>
            <p>Selecciona un mensaje para leerlo</p>
          </div>`;
        showToast('Mensaje eliminado.', 'success');
        await this.cargar();
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-nuevo-msg');
  if (btn) btn.addEventListener('click', () => ModuloMensajes.abrirFormulario());
});

console.log('✅ mensajes.js cargado');
