/**
 * EduAgenda – Módulo de Horario Semanal
 */

const ModuloHorario = {
  _horarios: [],
  _HORAS: ['07:00','08:00','09:00','10:00','11:00','12:00',
            '13:00','14:00','15:00','16:00','17:00','18:00'],
  _DIAS: ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],

  async cargar() {
    const container = document.getElementById('horario-container');
    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando horario...</div>';

    const user = Auth.getUser();
    const resp = await API.get('horarios', { limit: 200 });
    let hs = resp.data || [];

    if (user.rol === 'docente') {
      hs = hs.filter(h => h.usuario_id === user.id);
    } else if (user.rol === 'acudiente') {
      // Acudiente ve el horario del estudiante activo
      const estId = Acudiente.getEstudianteActivoId();
      hs = hs.filter(h => h.usuario_id === estId);
    }

    this._horarios = hs;
    this._render(hs);
  },

  _render(horarios) {
    const container = document.getElementById('horario-container');

    // Construir mapa: dia -> hora_inicio -> [clases]
    const mapa = {};
    this._DIAS.forEach(d => { mapa[d] = {}; });
    horarios.forEach(h => {
      if (!mapa[h.dia_semana]) mapa[h.dia_semana] = {};
      const key = h.hora_inicio || '07:00';
      if (!mapa[h.dia_semana][key]) mapa[h.dia_semana][key] = [];
      mapa[h.dia_semana][key].push(h);
    });

    const hoy = new Date().toLocaleDateString('es-CO', { weekday: 'long' });
    const hoyCap = hoy.charAt(0).toUpperCase() + hoy.slice(1);

    const html = `
    <table class="horario-table">
      <thead>
        <tr>
          <th>Hora</th>
          ${this._DIAS.map(d => `
            <th style="${d === hoyCap ? 'background:var(--purple)' : ''}">
              ${d} ${d === hoyCap ? '🔵' : ''}
            </th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${this._HORAS.map(hora => `
          <tr>
            <td class="time-cell">${hora}</td>
            ${this._DIAS.map(dia => {
              const clases = mapa[dia]?.[hora] || [];
              return `<td>${clases.map(c => `
                <div class="horario-cell" style="background:${(c.color || '#3B5BDB')}22;color:${c.color || '#3B5BDB'}"
                     onclick="ModuloHorario.verDetalle('${c.id}')">
                  <strong>${sanitize(c.nombre_materia || 'Clase')}</strong>
                  <br><small>${c.hora_inicio}–${c.hora_fin}</small>
                  ${c.salon ? `<br><small><i class="fas fa-door-open"></i> ${sanitize(c.salon)}</small>` : ''}
                </div>`).join('')}</td>`;
            }).join('')}
          </tr>`).join('')}
      </tbody>
    </table>`;

    container.innerHTML = html;
  },

  verDetalle(id) {
    const h = this._horarios.find(x => x.id === id);
    if (!h) return;
    const user = Auth.getUser();
    const esDoc = user.rol === 'docente' && h.usuario_id === user.id;
    abrirModal({
      titulo: h.nombre_materia || 'Detalle de clase',
      cuerpo: `
        <div style="display:flex;flex-direction:column;gap:.75rem;">
          <p><i class="fas fa-book" style="color:var(--primary);margin-right:.5rem;"></i><strong>Materia:</strong> ${sanitize(h.nombre_materia || '—')}</p>
          <p><i class="fas fa-calendar-day" style="color:var(--primary);margin-right:.5rem;"></i><strong>Día:</strong> ${h.dia_semana}</p>
          <p><i class="fas fa-clock" style="color:var(--primary);margin-right:.5rem;"></i><strong>Horario:</strong> ${h.hora_inicio} – ${h.hora_fin}</p>
          ${h.salon ? `<p><i class="fas fa-door-open" style="color:var(--primary);margin-right:.5rem;"></i><strong>Salón:</strong> ${sanitize(h.salon)}</p>` : ''}
        </div>`,
      ocultarFooter: !esDoc,
      textoConfirmar: 'Eliminar Clase',
      textoCancelar: 'Cerrar',
      onConfirm: esDoc ? async () => {
        await API.delete('horarios', id);
        cerrarModal();
        showToast('Clase eliminada del horario.', 'success');
        await this.cargar();
      } : null
    });
  },

  abrirFormulario() {
    const materias = ModuloMaterias.getMaterias();
    const html = `
      <div class="form-group">
        <label><i class="fas fa-book"></i> Materia</label>
        <select id="h-materia">
          <option value="">Seleccionar materia...</option>
          ${materias.map(m => `<option value="${m.id}" data-color="${m.color || '#3B5BDB'}">${sanitize(m.nombre)}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label><i class="fas fa-calendar-day"></i> Día de la semana</label>
          <select id="h-dia">
            ${this._DIAS.map(d => `<option value="${d}">${d}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label><i class="fas fa-door-open"></i> Salón / Aula</label>
          <input type="text" id="h-salon" placeholder="ej: Aula 201" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label><i class="fas fa-clock"></i> Hora inicio</label>
          <select id="h-inicio">
            ${this._HORAS.map(h => `<option value="${h}">${h}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label><i class="fas fa-clock"></i> Hora fin</label>
          <select id="h-fin">
            ${this._HORAS.map((h,i) => `<option value="${h}" ${i===1?'selected':''}>${h}</option>`).join('')}
          </select>
        </div>
      </div>
    `;
    abrirModal({
      titulo: 'Agregar Clase al Horario',
      cuerpo: html,
      textoConfirmar: 'Agregar',
      onConfirm: async () => {
        const matId  = val('h-materia');
        if (!matId) { showToast('Selecciona una materia.', 'error'); return; }
        const matObj = materias.find(m => m.id === matId);
        const user   = Auth.getUser();
        const inicio = val('h-inicio');
        const fin    = val('h-fin');
        if (inicio >= fin) { showToast('La hora de inicio debe ser antes que la de fin.', 'error'); return; }
        const datos  = {
          id:            crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
          id_materia:    matId,
          nombre_materia: matObj ? matObj.nombre : '',
          dia_semana:    val('h-dia'),
          hora_inicio:   inicio,
          hora_fin:      fin,
          salon:         val('h-salon'),
          usuario_id:    user.id,
          color:         matObj ? matObj.color || '#3B5BDB' : '#3B5BDB'
        };
        await API.create('horarios', datos);
        cerrarModal();
        showToast('Clase agregada al horario.', 'success');
        await this.cargar();
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-nuevo-horario');
  if (btn) btn.addEventListener('click', () => ModuloHorario.abrirFormulario());
});

console.log('✅ horario.js cargado');
