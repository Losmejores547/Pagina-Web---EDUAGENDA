/**
 * EduAgenda – Módulo de Materias
 */

const ModuloMaterias = {
  _materias: [],

  async cargar() {
    const container = document.getElementById('materias-grid');
    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando materias...</div>';

    const user = Auth.getUser();
    const resp = await API.get('materias', { limit: 200 });
    let materias = resp.data || [];

    // Filtrar según rol
    if (user.rol === 'docente') {
      materias = materias.filter(m => m.id_profesor === user.id || m.usuario_id === user.id);
    }

    this._materias = materias;
    this._render(materias);
    this._llenarFiltros(materias);

    // Búsqueda en tiempo real
    const searchInput = document.getElementById('search-materias');
    searchInput.addEventListener('input', debounce(() => {
      const q = searchInput.value.toLowerCase();
      const filtradas = materias.filter(m =>
        m.nombre.toLowerCase().includes(q) ||
        (m.descripcion || '').toLowerCase().includes(q) ||
        (m.nombre_profesor || '').toLowerCase().includes(q)
      );
      this._render(filtradas);
    }, 300));
  },

  _llenarFiltros(materias) {
    // Llenar selects de filtro de materia en otros módulos
    const selects = [
      'filter-materia-tarea',
      'filter-materia-eval',
      'filter-materia-notas',
      'filter-materia-faltas',
      'ia-materia-select'
    ];
    selects.forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      // Conservar primera opción
      const primeraOpcion = sel.options[0];
      sel.innerHTML = '';
      sel.appendChild(primeraOpcion);
      materias.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.nombre;
        sel.appendChild(opt);
      });
    });
  },

  _render(materias) {
    const container = document.getElementById('materias-grid');
    if (!materias.length) {
      container.innerHTML = `<div class="empty-state">
        <i class="fas fa-book-open"></i>
        <p>No hay materias registradas.</p>
      </div>`;
      return;
    }
    container.innerHTML = materias.map((m, i) => {
      const color  = m.color || getColorMateria(i);
      const icono  = m.icono || getIconoMateria(i);
      const user   = Auth.getUser();
      const esDoc  = user.rol === 'docente' && (m.id_profesor === user.id || m.usuario_id === user.id);
      return `
      <div class="materia-card" style="border-top-color:${color}" data-id="${m.id}">
        <div class="materia-icon" style="background:${color}22; color:${color}">
          <i class="fas ${icono}"></i>
        </div>
        <h3>${sanitize(m.nombre)}</h3>
        <p>${sanitize(m.descripcion || 'Sin descripción')}</p>
        <div class="materia-footer">
          <span class="materia-profesor">
            <i class="fas fa-chalkboard-teacher"></i>
            ${sanitize(m.nombre_profesor || 'Sin profesor')}
          </span>
          ${esDoc ? `
          <div class="materia-actions">
            <button class="btn-icon" title="Editar" onclick="ModuloMaterias.editar('${m.id}')">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-icon" title="Eliminar" onclick="ModuloMaterias.eliminar('${m.id}')">
              <i class="fas fa-trash" style="color:var(--danger)"></i>
            </button>
          </div>` : ''}
        </div>
      </div>`;
    }).join('');
  },

  abrirFormulario(materia = null) {
    const user = Auth.getUser();
    const es_edicion = !!materia;
    const html = `
      <div class="form-group">
        <label><i class="fas fa-book"></i> Nombre de la materia</label>
        <input type="text" id="m-nombre" value="${materia ? sanitize(materia.nombre) : ''}" placeholder="ej: Matemáticas" required />
      </div>
      <div class="form-group">
        <label><i class="fas fa-align-left"></i> Descripción</label>
        <textarea id="m-desc" rows="3" placeholder="Describe la materia...">${materia ? sanitize(materia.descripcion || '') : ''}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label><i class="fas fa-palette"></i> Color</label>
          <input type="color" id="m-color" value="${materia ? materia.color || '#3B5BDB' : '#3B5BDB'}" />
        </div>
        <div class="form-group">
          <label><i class="fas fa-icons"></i> Icono (clase FA)</label>
          <select id="m-icono">
            ${['fa-calculator','fa-flask','fa-book','fa-globe','fa-palette','fa-music',
               'fa-running','fa-laptop-code','fa-language','fa-brain','fa-atom','fa-leaf']
              .map(ic => `<option value="${ic}" ${materia && materia.icono === ic ? 'selected' : ''}>${ic.replace('fa-','')}</option>`)
              .join('')}
          </select>
        </div>
      </div>
    `;
    abrirModal({
      titulo: es_edicion ? 'Editar Materia' : 'Nueva Materia',
      cuerpo: html,
      textoConfirmar: es_edicion ? 'Actualizar' : 'Crear',
      onConfirm: async () => {
        const nombre = val('m-nombre');
        if (!nombre) { showToast('El nombre es obligatorio.', 'error'); return; }
        const datos = {
          nombre,
          descripcion: val('m-desc'),
          color: document.getElementById('m-color').value,
          icono: val('m-icono'),
          id_profesor: user.id,
          nombre_profesor: user.nombre,
          usuario_id: user.id
        };
        if (es_edicion) {
          await API.update('materias', materia.id, { ...materia, ...datos });
          showToast('Materia actualizada.', 'success');
        } else {
          datos.id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
          await API.create('materias', datos);
          showToast('Materia creada exitosamente.', 'success');
        }
        cerrarModal();
        await this.cargar();
      }
    });
  },

  async editar(id) {
    const materia = this._materias.find(m => m.id === id);
    if (materia) this.abrirFormulario(materia);
  },

  async eliminar(id) {
    abrirModal({
      titulo: 'Eliminar Materia',
      cuerpo: '<p>¿Estás seguro que deseas eliminar esta materia? Esta acción no se puede deshacer.</p>',
      textoConfirmar: 'Sí, eliminar',
      textoCancelar: 'Cancelar',
      onConfirm: async () => {
        await API.delete('materias', id);
        cerrarModal();
        showToast('Materia eliminada.', 'success');
        await this.cargar();
      }
    });
  },

  getMaterias() { return this._materias; }
};

// Botón nueva materia
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-nueva-materia');
  if (btn) btn.addEventListener('click', () => ModuloMaterias.abrirFormulario());
});

console.log('✅ materias.js cargado');
