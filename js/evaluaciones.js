/**
 * EduAgenda – Módulo de Evaluaciones
 */

const ModuloEvaluaciones = {
  _evaluaciones: [],

  async cargar() {
    const container = document.getElementById('eval-container');
    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando evaluaciones...</div>';

    const user = Auth.getUser();
    const resp = await API.get('evaluaciones', { limit: 200 });
    let evals = resp.data || [];

    if (user.rol === 'docente') {
      evals = evals.filter(e => e.usuario_id === user.id);
    } else if (user.rol === 'acudiente') {
      // Acudiente ve las evaluaciones de las materias del estudiante activo
      // (todas las evaluaciones públicas, filtradas por el id del estudiante activo)
      const estId = Acudiente.getEstudianteActivoId();
      // Para acudiente se muestran todas las evaluaciones registradas (lectura general)
      // ya que las evaluaciones pertenecen al docente, no al estudiante
      // Se pueden mostrar todas para que el padre esté al tanto
    }

    // Ordenar por fecha
    evals.sort((a, b) => new Date(a.fecha_evaluacion) - new Date(b.fecha_evaluacion));
    this._evaluaciones = evals;
    this._render(evals);
    this._initFiltros();
  },

  _initFiltros() {
    document.getElementById('filter-materia-eval').addEventListener('change', () => this._aplicarFiltros());
    document.getElementById('filter-tipo-eval').addEventListener('change', () => this._aplicarFiltros());
  },

  _aplicarFiltros() {
    let lista = [...this._evaluaciones];
    const materia = document.getElementById('filter-materia-eval').value;
    const tipo    = document.getElementById('filter-tipo-eval').value;
    if (materia) lista = lista.filter(e => e.id_materia === materia);
    if (tipo)    lista = lista.filter(e => e.tipo === tipo);
    this._render(lista);
  },

  _render(evals) {
    const container = document.getElementById('eval-container');
    if (!evals.length) {
      container.innerHTML = `<div class="empty-state">
        <i class="fas fa-file-alt"></i>
        <p>No hay evaluaciones registradas.</p>
      </div>`;
      return;
    }

    const coloresTipo = {
      examen: '#FA5252', quiz: '#FD7E14', trabajo: '#3B5BDB',
      proyecto: '#845EF7', oral: '#40C057'
    };

    container.innerHTML = evals.map(ev => {
      const user   = Auth.getUser();
      const esDoc  = user.rol === 'docente' && ev.usuario_id === user.id;
      const porc   = parseFloat(ev.porcentaje) || 0;
      const color  = coloresTipo[ev.tipo] || '#3B5BDB';
      const rel    = fechaRelativa(ev.fecha_evaluacion);
      return `
      <div class="eval-card" data-id="${ev.id}">
        <div class="eval-card-top">
          <span class="eval-tipo" style="background:${color}22;color:${color}">
            <i class="fas ${iconoTipoEval(ev.tipo)}"></i> ${(ev.tipo || 'evaluación').toUpperCase()}
          </span>
          ${esDoc ? `
          <div style="display:flex;gap:.25rem;">
            <button class="btn-icon" title="Editar" onclick="ModuloEvaluaciones.editar('${ev.id}')">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-icon" title="Eliminar" onclick="ModuloEvaluaciones.eliminar('${ev.id}')">
              <i class="fas fa-trash" style="color:var(--danger)"></i>
            </button>
          </div>` : ''}
        </div>
        <h3>${sanitize(ev.titulo)}</h3>
        <p class="eval-materia"><i class="fas fa-book"></i> ${sanitize(ev.nombre_materia || '—')}</p>
        ${ev.descripcion ? `<p style="font-size:.8rem;color:var(--text-muted);margin-bottom:.6rem;">${sanitize(ev.descripcion)}</p>` : ''}
        <div class="eval-porcentaje">
          <span style="font-size:.82rem;color:var(--text-muted);">Peso:</span>
          <div class="eval-prog-bar">
            <div class="eval-prog-fill" style="width:${Math.min(porc,100)}%"></div>
          </div>
          <span style="font-size:.85rem;font-weight:700;color:${color}">${porc}%</span>
        </div>
        <p class="eval-fecha">
          <i class="fas fa-calendar"></i> ${formatearFecha(ev.fecha_evaluacion)}
          ${rel ? `&nbsp;·&nbsp;${rel}` : ''}
        </p>
      </div>`;
    }).join('');
  },

  abrirFormulario(ev = null) {
    const materias = ModuloMaterias.getMaterias();
    const es_edicion = !!ev;
    const html = `
      <div class="form-group">
        <label><i class="fas fa-heading"></i> Título</label>
        <input type="text" id="ev-titulo" value="${ev ? sanitize(ev.titulo) : ''}" placeholder="ej: Parcial 1 – Álgebra" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label><i class="fas fa-tag"></i> Tipo</label>
          <select id="ev-tipo">
            ${['examen','quiz','trabajo','proyecto','oral'].map(t =>
              `<option value="${t}" ${ev?.tipo === t ? 'selected' : ''}>${t.charAt(0).toUpperCase()+t.slice(1)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label><i class="fas fa-percent"></i> Porcentaje (%)</label>
          <input type="number" id="ev-porcentaje" value="${ev ? ev.porcentaje || '' : ''}" placeholder="ej: 30" min="0" max="100" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label><i class="fas fa-calendar"></i> Fecha de evaluación</label>
          <input type="date" id="ev-fecha" value="${ev ? ev.fecha_evaluacion || '' : ''}" />
        </div>
        <div class="form-group">
          <label><i class="fas fa-book"></i> Materia</label>
          <select id="ev-materia">
            <option value="">Seleccionar materia...</option>
            ${materias.map(m => `<option value="${m.id}" ${ev?.id_materia === m.id ? 'selected' : ''}>${sanitize(m.nombre)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label><i class="fas fa-align-left"></i> Descripción / Temas</label>
        <textarea id="ev-desc" rows="3" placeholder="Temas a evaluar...">${ev ? sanitize(ev.descripcion || '') : ''}</textarea>
      </div>
    `;
    abrirModal({
      titulo: es_edicion ? 'Editar Evaluación' : 'Nueva Evaluación',
      cuerpo: html,
      textoConfirmar: es_edicion ? 'Actualizar' : 'Crear Evaluación',
      onConfirm: async () => {
        const titulo = val('ev-titulo');
        if (!titulo) { showToast('El título es obligatorio.', 'error'); return; }
        const matId  = val('ev-materia');
        const matObj = materias.find(m => m.id === matId);
        const user   = Auth.getUser();
        const datos  = {
          titulo,
          tipo:             val('ev-tipo'),
          porcentaje:       parseFloat(val('ev-porcentaje')) || 0,
          fecha_evaluacion: val('ev-fecha'),
          id_materia:       matId,
          nombre_materia:   matObj ? matObj.nombre : '',
          descripcion:      val('ev-desc'),
          usuario_id:       user.id
        };
        if (es_edicion) {
          await API.update('evaluaciones', ev.id, { ...ev, ...datos });
          showToast('Evaluación actualizada.', 'success');
        } else {
          datos.id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
          await API.create('evaluaciones', datos);
          showToast('Evaluación creada.', 'success');
        }
        cerrarModal();
        await this.cargar();
      }
    });
  },

  editar(id) {
    const ev = this._evaluaciones.find(e => e.id === id);
    if (ev) this.abrirFormulario(ev);
  },

  eliminar(id) {
    abrirModal({
      titulo: 'Eliminar Evaluación',
      cuerpo: '<p>¿Eliminar esta evaluación permanentemente?</p>',
      textoConfirmar: 'Eliminar',
      onConfirm: async () => {
        await API.delete('evaluaciones', id);
        cerrarModal();
        showToast('Evaluación eliminada.', 'success');
        await this.cargar();
      }
    });
  },

  getEvaluaciones() { return this._evaluaciones; }
};

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-nueva-eval');
  if (btn) btn.addEventListener('click', () => ModuloEvaluaciones.abrirFormulario());
});

console.log('✅ evaluaciones.js cargado');
