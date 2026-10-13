/**
 * EduAgenda – API Layer
 * Manejo centralizado de llamadas a la API REST de tablas
 */

const API = {
  /**
   * Obtiene registros de una tabla con filtros opcionales
   */
  async get(tabla, params = {}) {
    try {
      const query = new URLSearchParams({
        page: params.page || 1,
        limit: params.limit || 100,
        ...params
      }).toString();
      const res = await fetch(`tables/${tabla}?${query}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error(`API.get(${tabla}):`, e);
      return { data: [], total: 0 };
    }
  },

  /**
   * Obtiene un solo registro por ID
   */
  async getById(tabla, id) {
    try {
      const res = await fetch(`tables/${tabla}/${id}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error(`API.getById(${tabla}/${id}):`, e);
      return null;
    }
  },

  /**
   * Crea un nuevo registro
   */
  async create(tabla, data) {
    try {
      const res = await fetch(`tables/${tabla}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error(`API.create(${tabla}):`, e);
      return null;
    }
  },

  /**
   * Actualiza completamente un registro
   */
  async update(tabla, id, data) {
    try {
      const res = await fetch(`tables/${tabla}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error(`API.update(${tabla}/${id}):`, e);
      return null;
    }
  },

  /**
   * Actualiza parcialmente un registro
   */
  async patch(tabla, id, data) {
    try {
      const res = await fetch(`tables/${tabla}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error(`API.patch(${tabla}/${id}):`, e);
      return null;
    }
  },

  /**
   * Elimina un registro
   */
  async delete(tabla, id) {
    try {
      const res = await fetch(`tables/${tabla}/${id}`, { method: 'DELETE' });
      return res.status === 204 || res.ok;
    } catch (e) {
      console.error(`API.delete(${tabla}/${id}):`, e);
      return false;
    }
  },

  /**
   * Filtra registros localmente por campo=valor
   */
  filtrar(lista, campo, valor) {
    if (!valor) return lista;
    return lista.filter(item => item[campo] === valor);
  },

  /**
   * Filtra registros localmente por usuario actual
   */
  filtrarPorUsuario(lista) {
    const user = Auth.getUser();
    if (!user) return [];
    // Acudientes ven todos los datos de sus estudiantes, docentes ven todo lo suyo
    return lista.filter(item =>
      item.usuario_id === user.id ||
      item.id_estudiante === user.id ||
      item.id_profesor === user.id
    );
  }
};

console.log('✅ api.js cargado');
