/**
 * EduAgenda – Módulo de Tareas
 */

const ModuloTareas = {
  _tareas: [],
  _filtroEstado: 'all',

  async cargar() {
    const container = document.getElementById('tareas-container');
    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando tareas...</div>';

    const user = Auth.getUser();
    const resp = await API.get('tareas', { limit: 200 });
    let tareas = resp.data || [];

    if (user.rol === 'acudiente') {
      const estId = Acudiente.getEstudianteActivoId();
      tareas = tareas.filter(t => t.usuario_id === estId);
    } else {
      tareas = tareas.filter(t => t.usuario_id === user.id);
    }

    // Acudiente no puede crear tareas: ocultar botón
    const btnNueva = document.getElementById('btn-nueva-tarea');
    if (btnNueva) btnNueva.style.display = user.rol === 'acudiente' ? 'none' : '';

    // Ordenar por fecha de entrega
    tareas.sort((a, b) => {
      if (!a.fecha_entrega) return 1;
      if (!b.fecha_entrega) return -1;
      return new Date(a.fecha_entrega) - new Date(b.fecha_entrega);
    });

    this._tareas = tareas;
    this._render(tareas);
    this._initFiltros();
  },

  _initFiltros() {
    const filterBtns  = document.querySelectorAll('#page-tareas .filter-btn');
    const filterSel   = document.getElementById('filter-materia-tarea');

    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._filtroEstado = btn.dataset.filter;
        this._aplicarFiltros();
      });
    });

    filterSel.addEventListener('change', () => this._aplicarFiltros());
  },

  _aplicarFiltros() {
    let lista = [...this._tareas];
    if (this._filtroEstado !== 'all') {
      lista = lista.filter(t => t.estado === this._filtroEstado);
    }
    const materia = document.getElementById('filter-materia-tarea').value;
    if (materia) lista = lista.filter(t => t.id_materia === materia);
    this._render(lista);
  },

  _render(tareas) {
    const container = document.getElementById('tareas-container');
    if (!tareas.length) {
      container.innerHTML = `<div class="empty-state">
        <i class="fas fa-clipboard-check"></i>
        <p>No hay tareas que mostrar.</p>
      </div>`;
      return;
    }

    container.innerHTML = tareas.map(t => {
      const dias = diasRestantes(t.fecha_entrega);
      const rel  = fechaRelativa(t.fecha_entrega);
      const checked = t.estado === 'completada' ? 'checked' : '';
      return `
      <div class="tarea-card prioridad-${t.prioridad} estado-${t.estado}" data-id="${t.id}">
        <div class="tarea-check ${checked}" onclick="ModuloTareas.toggleCompletada('${t.id}', '${t.estado}')"></div>
        <div class="tarea-body">
          <div class="tarea-titulo">${sanitize(t.titulo)}</div>
          ${t.descripcion ? `<p style="font-size:.82rem;color:var(--text-muted);margin-top:.2rem;">${sanitize(t.descripcion).substring(0,120)}${t.descripcion.length > 120 ? '...' : ''}</p>` : ''}
          <div class="tarea-meta">
            ${t.nombre_materia ? `<span><i class="fas fa-book"></i>${sanitize(t.nombre_materia)}</span>` : ''}
            ${t.fecha_entrega ? `<span><i class="fas fa-calendar"></i>${formatearFecha(t.fecha_entrega)}</span>` : ''}
            ${rel ? `<span>${rel}</span>` : ''}
            <span class="tag tag-${t.prioridad}">${t.prioridad?.toUpperCase()}</span>
            <span class="tag tag-${t.estado}">${t.estado?.replace('_', ' ')}</span>
          </div>
        </div>
        <div class="tarea-actions">
          <button class="btn-icon" title="Editar" onclick="ModuloTareas.editar('${t.id}')">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-icon" title="Eliminar" onclick="ModuloTareas.eliminar('${t.id}')">
            <i class="fas fa-trash" style="color:var(--danger)"></i>
          </button>
        </div>
      </div>`;
    }).join('');
  },

  async toggleCompletada(id, estadoActual) {
    const nuevoEstado = estadoActual === 'completada' ? 'pendiente' : 'completada';
    await API.patch('tareas', id, { estado: nuevoEstado });
    const tarea = this._tareas.find(t => t.id === id);
    if (tarea) tarea.estado = nuevoEstado;
    this._aplicarFiltros();
    showToast(nuevoEstado === 'completada' ? '✅ Tarea completada!' : 'Tarea marcada como pendiente', 'success', 2000);
  },

  abrirFormulario(tarea = null) {
    const materias = ModuloMaterias.getMaterias();
    const es_edicion = !!tarea;
    const html = `
      <div class="form-group">
        <label><i class="fas fa-heading"></i> Título</label>
        <input type="text" id="t-titulo" value="${tarea ? sanitize(tarea.titulo) : ''}" placeholder="Título de la tarea" />
      </div>
      <div class="form-group">
        <label><i class="fas fa-align-left"></i> Descripción</label>
        <textarea id="t-desc" rows="3" placeholder="Descripción opcional...">${tarea ? sanitize(tarea.descripcion || '') : ''}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label><i class="fas fa-calendar"></i> Fecha de entrega</label>
          <input type="date" id="t-fecha" value="${tarea ? tarea.fecha_entrega || '' : ''}" min="${hoy()}" />
        </div>
        <div class="form-group">
          <label><i class="fas fa-flag"></i> Prioridad</label>
          <select id="t-prioridad">
            <option value="alta" ${tarea?.prioridad === 'alta' ? 'selected' : ''}>🔴 Alta</option>
            <option value="media" ${!tarea || tarea?.prioridad === 'media' ? 'selected' : ''}>🟡 Media</option>
            <option value="baja" ${tarea?.prioridad === 'baja' ? 'selected' : ''}>🟢 Baja</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label><i class="fas fa-book"></i> Materia</label>
          <select id="t-materia">
            <option value="">Sin materia específica</option>
            ${materias.map(m => `<option value="${m.id}" ${tarea?.id_materia === m.id ? 'selected' : ''}>${sanitize(m.nombre)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label><i class="fas fa-tasks"></i> Estado</label>
          <select id="t-estado">
            <option value="pendiente" ${!tarea || tarea?.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
            <option value="en_progreso" ${tarea?.estado === 'en_progreso' ? 'selected' : ''}>En Progreso</option>
            <option value="completada" ${tarea?.estado === 'completada' ? 'selected' : ''}>Completada</option>
          </select>
        </div>
      </div>
    `;
    abrirModal({
      titulo: es_edicion ? 'Editar Tarea' : 'Nueva Tarea',
      cuerpo: html,
      textoConfirmar: es_edicion ? 'Actualizar' : 'Crear Tarea',
      onConfirm: async () => {
        const titulo = val('t-titulo');
        if (!titulo) { showToast('El título es obligatorio.', 'error'); return; }
        const matId  = val('t-materia');
        const matObj = materias.find(m => m.id === matId);
        const user   = Auth.getUser();
        const datos  = {
          titulo,
          descripcion:    val('t-desc'),
          fecha_entrega:  val('t-fecha'),
          prioridad:      val('t-prioridad'),
          estado:         val('t-estado'),
          id_materia:     matId,
          nombre_materia: matObj ? matObj.nombre : '',
          usuario_id:     user.id
        };
        if (es_edicion) {
          await API.update('tareas', tarea.id, { ...tarea, ...datos });
          showToast('Tarea actualizada.', 'success');
        } else {
          datos.id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
          await API.create('tareas', datos);
          showToast('Tarea creada exitosamente.', 'success');
        }
        cerrarModal();
        await this.cargar();
      }
    });
  },

  editar(id) {
    const tarea = this._tareas.find(t => t.id === id);
    if (tarea) this.abrirFormulario(tarea);
  },

  eliminar(id) {
    abrirModal({
      titulo: 'Eliminar Tarea',
      cuerpo: '<p>¿Eliminar esta tarea permanentemente?</p>',
      textoConfirmar: 'Eliminar',
      onConfirm: async () => {
        await API.delete('tareas', id);
        cerrarModal();
        showToast('Tarea eliminada.', 'success');
        await this.cargar();
      }
    });
  },

  getTareas() { return this._tareas; }
};

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-nueva-tarea');
  if (btn) btn.addEventListener('click', () => ModuloTareas.abrirFormulario());
});

console.log('✅ tareas.js cargado');
