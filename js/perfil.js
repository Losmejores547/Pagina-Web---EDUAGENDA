/**
 * EduAgenda – Módulo de Perfil de Usuario
 */

const ModuloPerfil = {
  async cargar() {
    const user = Auth.getUser();

    // Llenar formulario con datos actuales
    setVal('edit-nombre',   user.nombre);
    setVal('edit-correo',   user.correo);
    setVal('edit-telefono', user.telefono || '');

    // Actualizar vista de perfil
    document.getElementById('perfil-nombre').textContent  = user.nombre;
    document.getElementById('perfil-correo').innerHTML    = `<i class="fas fa-envelope"></i> ${user.correo}`;
    document.getElementById('perfil-avatar').textContent  = iniciales(user.nombre);
    const badge = document.getElementById('perfil-rol-badge');
    badge.textContent  = user.rol?.charAt(0).toUpperCase() + user.rol?.slice(1);
    badge.className    = `role-badge ${user.rol}`;

    // Cargar gráfico de estadísticas
    await this._cargarEstadisticas(user);
  },

  async _cargarEstadisticas(user) {
    const [respNot, respTar, respFal, respMat, respEval] = await Promise.all([
      API.get('notas',        { limit: 200 }),
      API.get('tareas',       { limit: 200 }),
      API.get('faltas',       { limit: 200 }),
      API.get('materias',     { limit: 200 }),
      API.get('evaluaciones', { limit: 200 })
    ]);

    let notas  = (respNot.data  || []).filter(n => n.id_estudiante === user.id || n.usuario_id === user.id);
    let tareas = (respTar.data  || []).filter(t => t.usuario_id === user.id);
    let faltas = (respFal.data  || []).filter(f => f.id_estudiante === user.id || f.usuario_id === user.id);

    const vals  = notas.map(n => parseFloat(n.calificacion)).filter(v => !isNaN(v));
    const prom  = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2) : 0;
    const tareasComp = tareas.filter(t => t.estado === 'completada').length;

    // Gráfico de donut – estado de tareas
    const ctx = document.getElementById('chart-perfil');
    if (ctx) {
      if (this._chart) this._chart.destroy();

      const completadas = tareasComp;
      const enProg      = tareas.filter(t => t.estado === 'en_progreso').length;
      const pendientes  = tareas.filter(t => t.estado === 'pendiente').length;

      this._chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Completadas', 'En progreso', 'Pendientes'],
          datasets: [{
            data: [completadas, enProg, pendientes],
            backgroundColor: ['#40C057', '#3B5BDB', '#FD7E14'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { padding: 15, font: { size: 12 } } }
          },
          cutout: '65%'
        }
      });
    }

    // Lista de estadísticas
    const listEl = document.getElementById('perfil-stats-list');
    listEl.innerHTML = `
      <div class="perfil-stat-item">
        <span><i class="fas fa-star" style="color:var(--warning)"></i> Promedio general</span>
        <span>${prom}</span>
      </div>
      <div class="perfil-stat-item">
        <span><i class="fas fa-tasks" style="color:var(--primary)"></i> Tareas totales</span>
        <span>${tareas.length}</span>
      </div>
      <div class="perfil-stat-item">
        <span><i class="fas fa-check-circle" style="color:var(--secondary)"></i> Tareas completadas</span>
        <span>${tareasComp}</span>
      </div>
      <div class="perfil-stat-item">
        <span><i class="fas fa-calendar-times" style="color:var(--danger)"></i> Faltas registradas</span>
        <span>${faltas.length}</span>
      </div>
      <div class="perfil-stat-item">
        <span><i class="fas fa-clipboard-check" style="color:var(--secondary)"></i> Notas registradas</span>
        <span>${notas.length}</span>
      </div>`;
  },

  async guardar() {
    const user    = Auth.getUser();
    const nombre  = val('edit-nombre');
    const correo  = val('edit-correo');
    const telefono = val('edit-telefono');
    const pass    = val('edit-password');

    if (!nombre || !correo) {
      showToast('Nombre y correo son obligatorios.', 'error');
      return;
    }
    if (!validarEmail(correo)) {
      showToast('El correo no es válido.', 'error');
      return;
    }

    const actualizacion = {
      ...user,
      nombre,
      correo,
      telefono
    };

    if (pass) {
      if (!validarPassword(pass)) {
        showToast('La contraseña debe tener al menos 6 caracteres.', 'error');
        return;
      }
      actualizacion.contrasena = btoa(pass);
    }

    const resultado = await API.update('usuarios', user.id, actualizacion);
    if (resultado) {
      Auth.setUser(actualizacion);
      actualizarUIUsuario(actualizacion);
      showToast('✅ Perfil actualizado correctamente.', 'success');
      setVal('edit-password', '');
    } else {
      showToast('Error al actualizar el perfil.', 'error');
    }
  }
};

console.log('✅ perfil.js cargado');
