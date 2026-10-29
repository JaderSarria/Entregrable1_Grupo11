'use strict';

const apiActivity = (() => {
  const list = document.querySelector('#api-monitor-list');
  const count = document.querySelector('#api-monitor-count');
  const empty = document.querySelector('#api-monitor-empty');
  const clear = document.querySelector('#api-monitor-clear');
  const entries = new Map();
  const limit = 40;
  let sequence = 0;
  const sensitive = key => /password|passwd|contrase|authorization|cookie|token|secret|api[-_]?key/i.test(key);
  function element(tag, className, text) {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (text !== undefined) result.textContent = text;
    return result;
  }
  function serialize(value) {
    try {
      const json = JSON.stringify(value, (key, item) => sensitive(key) ? '[oculto]' : item, 2);
      if (json === undefined) return 'Sin datos.';
      return json.length > 12000 ? json.slice(0, 12000) + '\n… Vista recortada.' : json;
    } catch { return 'No se pudo mostrar este contenido.'; }
  }
  function requestBody(body) {
    if (body == null) return 'Sin cuerpo.';
    if (body instanceof FormData || body instanceof URLSearchParams) {
      const fields = Object.create(null);
      for (const [key, value] of body.entries()) {
        const item = sensitive(key) ? '[oculto]' : value instanceof File ? { archivo: value.name, tipo: value.type, bytes: value.size } : value;
        if (Object.hasOwn(fields, key)) fields[key] = Array.isArray(fields[key]) ? [...fields[key], item] : [fields[key], item];
        else fields[key] = item;
      }
      return serialize(fields);
    }
    if (typeof body === 'string') {
      try { return serialize(JSON.parse(body)); }
      catch { return `Cuerpo de texto (${body.length} caracteres).`; }
    }
    return 'Contenido binario.';
  }
  function requestUrl(url) {
    try {
      const parsed = new URL(url, location.href);
      for (const key of [...parsed.searchParams.keys()]) if (sensitive(key)) parsed.searchParams.set(key, '[oculto]');
      return parsed.pathname + parsed.search;
    } catch { return 'Ruta no disponible'; }
  }
  function updateCount() {
    count.textContent = String(entries.size);
    empty.hidden = entries.size > 0;
    clear.disabled = entries.size === 0;
  }
  clear.addEventListener('click', () => {
    entries.clear();
    list.replaceChildren();
    updateCount();
  });
  function start(url, options = {}) {
    const id = ++sequence;
    const time = new Date().toLocaleTimeString('es-CO', { hour12: false });
    const method = (options.method || 'GET').toUpperCase();
    const row = element('details', 'api-log-entry');
    const summary = element('summary');
    const methodLabel = element('span', 'api-log-method', method);
    methodLabel.dataset.method = method;
    const path = element('span', 'api-log-path', requestUrl(url));
    const status = element('span', 'api-log-status', 'En curso');
    const duration = element('span', 'api-log-duration', '—');
    const clock = element('time', 'api-log-time', time);
    clock.dateTime = new Date().toISOString();
    summary.append(methodLabel, path, status, duration, clock);
    const content = element('div', 'api-log-content');
    const context = element('p', 'api-log-context', `Iniciada a las ${time}.`);
    const response = element('pre', '', 'Esperando respuesta…');
    content.append(context, element('h3', '', 'Datos enviados'), element('pre', '', requestBody(options.body)), element('h3', '', 'Respuesta'), response);
    row.append(summary, content);
    entries.set(id, { row, status, duration, response, context, time, started: performance.now() });
    list.prepend(row);
    if (entries.size > limit) {
      const oldest = entries.keys().next().value;
      entries.get(oldest).row.remove();
      entries.delete(oldest);
    }
    updateCount();
    return id;
  }
  function finish(id, result) {
    const entry = entries.get(id);
    // Clearing the panel also discards requests that were still in flight.
    if (!entry) return;
    const duration = Math.max(0, Math.round(performance.now() - entry.started));
    entry.status.textContent = result.status ? String(result.status) : 'Sin conexión';
    entry.status.classList.add(result.ok ? 'is-success' : 'is-error');
    entry.duration.textContent = `${duration} ms`;
    entry.context.textContent = `Iniciada a las ${entry.time} · Duración: ${duration} ms.`;
    entry.response.textContent = result.error || (result.data === null ? 'El servidor no devolvió una respuesta JSON válida.' : serialize(result.data));
  }
  return { start, finish };
})();
