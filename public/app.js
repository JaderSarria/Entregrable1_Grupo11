'use strict';

const icons = {
  paw: '<ellipse cx="8" cy="6" rx="2" ry="3"/><ellipse cx="16" cy="6" rx="2" ry="3"/><ellipse cx="3.7" cy="11" rx="1.7" ry="2.5" transform="rotate(-25 3.7 11)"/><ellipse cx="20.3" cy="11" rx="1.7" ry="2.5" transform="rotate(25 20.3 11)"/><path d="M6 18c0-3 3-7 6-7s6 4 6 7c0 4-4 2-6 2s-6 2-6-2Z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  sparkles: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Zm8-2v5m-2.5-2.5h5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-2l2 3M4 16l2 3a7 7 0 0 0 12-2"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  edit: '<path d="m16 3 5 5M4 20l5-1L21 7a2.8 2.8 0 0 0-4-4L5 15l-1 5Z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>'
};
const $ = selector => document.querySelector(selector);
function icon(name) {
  const span = document.createElement('span');
  span.setAttribute('aria-hidden', 'true');
  // Only trusted, fixed SVG markup is inserted. Record values use textContent.
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${icons[name] || icons.paw}</svg>`;
  return span;
}
document.querySelectorAll('[data-icon]').forEach(element => element.replaceChildren(icon(element.dataset.icon)));

const state = { resource: 'pets', users: [], pets: [], loading: true, loadError: false, editing: null, deleting: null, detail: null, busy: false };
const form = $('#record-form');
const dialog = $('#record-dialog');
const deleteDialog = $('#delete-dialog');
const detailDialog = $('#detail-dialog');
let previewUrls = [];
let toastTimer;
const singular = resource => resource === 'users' ? 'usuario' : 'mascota';
const recordName = (record, resource) => resource === 'users' ? `${record.firstname} ${record.lastname}` : record.especie;
const normalized = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function node(tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (value !== undefined) element.textContent = value;
  return element;
}

async function api(url, options) {
  const activity = apiActivity.start(url, options);
  let response;
  try { response = await fetch(url, options); }
  catch {
    const message = 'No se pudo conectar con el servidor. Comprueba que siga en ejecución e inténtalo de nuevo.';
    apiActivity.finish(activity, { error: message });
    throw new Error(message);
  }
  const data = await response.json().catch(() => null);
  apiActivity.finish(activity, { status: response.status, ok: response.ok, data });
  if (!response.ok) throw new Error(data?.error || `La solicitud no se pudo completar (${response.status}).`);
  if (data === null) throw new Error('El servidor devolvió una respuesta inesperada.');
  return data;
}

function showError(selector, message) {
  const element = $(selector);
  element.textContent = message;
  element.hidden = !message;
}

function notify(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4500);
}

async function load() {
  state.loading = true;
  state.loadError = false;
  showError('#load-error', '');
  $('#refresh').disabled = true;
  render();
  try {
    const [users, pets] = await Promise.all([api('/api/users'), api('/api/pets')]);
    if (!Array.isArray(users) || !Array.isArray(pets)) throw new Error('No se pudo leer el directorio.');
    state.users = users;
    state.pets = pets;
  } catch (error) {
    state.loadError = true;
    showError('#load-error', `${error.message} Pulsa Actualizar para volver a intentar.`);
  } finally {
    state.loading = false;
    $('#refresh').disabled = false;
    render();
  }
}

function imageElement(url, alt) {
  if (typeof url !== 'string' || !/^\/img\/(users|pets)\/[a-zA-Z0-9.-]+$/.test(url)) return null;
  const image = node('img');
  image.src = url;
  image.alt = alt;
  image.loading = 'lazy';
  image.addEventListener('error', () => { image.replaceWith(node('span', 'field-hint', 'Imagen no disponible')); });
  return image;
}

function actionButton(label, iconName, className, callback) {
  const button = node('button', className);
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.append(icon(iconName));
  button.addEventListener('click', callback);
  return button;
}

function card(record) {
  const resource = state.resource;
  const isUser = resource === 'users';
  const name = recordName(record, resource);
  const article = node('article', `record-card ${isUser ? 'user-card' : ''}`);
  const media = node('div', 'card-media');
  const image = imageElement(isUser ? record.avatar : record.img?.[0], isUser ? `Avatar de ${name}` : `Fotografía de ${name}`);
  if (image) media.append(image);
  else if (isUser) media.append(node('span', 'initials', `${record.firstname.slice(0, 1)}${record.lastname.slice(0, 1)}`.toUpperCase()));
  else {
    const placeholder = node('div', 'photo-placeholder');
    placeholder.append(node('span', 'photo-number', String(record.id).padStart(3, '0')), node('span', '', 'Sin fotografía'));
    media.append(placeholder);
  }
  media.append(node('span', 'record-id', `ID ${String(record.id).padStart(2, '0')}`));
  if (!isUser && record.img?.length) media.append(node('span', 'image-count', `${record.img.length} ${record.img.length === 1 ? 'foto' : 'fotos'}`));
  const body = node('div', 'card-body');
  body.append(node('h3', 'card-title', name));
  const info = node('dl', 'card-info');
  const fields = isUser ? [['Usuario', `@${record.username}`]] : [['Edad', `${record.edad} ${record.edad === 1 ? 'año' : 'años'}`], ['Sexo', record.sexo], ['Color', record.color]];
  for (const [label, value] of fields) {
    const field = node('div', label === 'Color' ? 'card-field wide' : 'card-field');
    field.append(node('dt', '', label), node('dd', '', value));
    info.append(field);
  }
  const actions = node('div', 'card-actions');
  const view = node('button', 'button view-button', 'Ver ficha');
  view.type = 'button';
  view.setAttribute('aria-label', `Ver detalles de ${name}`);
  view.append(icon('arrow'));
  view.addEventListener('click', () => openDetail(record));
  const edit = actionButton(`Editar ${name}`, 'edit', 'icon-button text-action', () => openForm(record));
  edit.append(node('span', '', 'Editar'));
  actions.append(view, edit, actionButton(`Eliminar ${name}`, 'trash', 'icon-button delete-button', () => openDelete(record)));
  body.append(info, actions);
  article.append(media, body);
  return article;
}

function usersTable(records) {
  const table = node('table', 'users-table');
  const caption = node('caption', 'sr-only', 'Usuarios registrados');
  const head = node('thead');
  const header = node('tr');
  for (const label of ['N.º', 'Nombre y apellido', 'Usuario', 'Acciones']) {
    const cell = node('th', '', label);
    cell.scope = 'col';
    header.append(cell);
  }
  head.append(header);
  const body = node('tbody');
  for (const record of records) {
    const row = node('tr');
    const name = recordName(record, 'users');
    row.append(node('td', 'user-id', String(record.id).padStart(3, '0')));
    const identityCell = node('th');
    identityCell.scope = 'row';
    const identity = node('div', 'user-identity');
    const avatar = node('span', 'user-avatar');
    avatar.append(imageElement(record.avatar, `Avatar de ${name}`) || node('span', '', `${record.firstname.slice(0, 1)}${record.lastname.slice(0, 1)}`.toUpperCase()));
    const view = node('button', 'name-button', name);
    view.type = 'button';
    view.setAttribute('aria-label', `Ver detalles de ${name}`);
    view.addEventListener('click', () => openDetail(record));
    identity.append(avatar, view);
    identityCell.append(identity);
    const actionsCell = node('td');
    const actions = node('div', 'table-actions');
    const edit = actionButton(`Editar ${name}`, 'edit', 'icon-button text-action', () => openForm(record));
    edit.append(node('span', '', 'Editar'));
    actions.append(edit, actionButton(`Eliminar ${name}`, 'trash', 'icon-button delete-button', () => openDelete(record)));
    actionsCell.append(actions);
    row.append(identityCell, node('td', 'username-cell', `@${record.username}`), actionsCell);
    body.append(row);
  }
  table.append(caption, head, body);
  return table;
}

function render() {
  const resource = state.resource;
  const isUser = resource === 'users';
  const term = normalized($('#search').value.trim());
  const records = state[resource].filter(record => normalized(isUser ? `${record.id} ${record.firstname} ${record.lastname} ${record.username}` : `${record.id} ${record.especie} ${record.color} ${record.edad} ${record.sexo}`).includes(term));
  for (const kind of ['users', 'pets']) {
    const count = state.loading ? '—' : state[kind].length;
    $(`#${kind}-count`).textContent = count;
  }
  $('#collection-title').textContent = isUser ? 'Usuarios' : 'Mascotas';
  $('#collection-description').textContent = isUser ? 'Datos de acceso y perfiles registrados.' : 'Especie, edad, sexo y fotografías.';
  $('#add-label').textContent = `Registrar ${singular(resource)}`;
  $('#search').placeholder = isUser ? 'Buscar por nombre, usuario o ID…' : 'Buscar por especie, color o ID…';
  $('#search').setAttribute('aria-label', isUser ? 'Buscar usuarios' : 'Buscar mascotas');
  document.querySelectorAll('[data-resource]').forEach(button => {
    const active = button.dataset.resource === resource;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  $('#records').setAttribute('aria-busy', String(state.loading));
  $('#records').classList.toggle('users-records', isUser);
  $('#records').replaceChildren(...(state.loading || !records.length ? [] : isUser ? [usersTable(records)] : records.map(card)));
  $('#empty-state').hidden = state.loading || state.loadError || records.length > 0;
  $('#empty-title').textContent = term ? 'Sin coincidencias.' : isUser ? 'No hay usuarios registrados.' : 'No hay mascotas registradas.';
  $('#empty-description').textContent = term ? 'Prueba otra búsqueda o borra el texto para ver todos los registros.' : isUser ? 'Registra un usuario con su nombre, contraseña y avatar.' : 'Registra una mascota. Sus datos y fotos aparecerán aquí.';
  $('#empty-add').hidden = Boolean(term);
  $('#empty-add').replaceChildren(document.createTextNode(`Registrar ${isUser ? 'el primer usuario' : 'la primera mascota'}`), icon('arrow'));
  $('#results-label').textContent = state.loading ? 'Cargando registros…' : state.loadError ? 'No se pudo actualizar el directorio.' : `${records.length} ${isUser ? (records.length === 1 ? 'usuario' : 'usuarios') : (records.length === 1 ? 'mascota' : 'mascotas')}${term ? ' en esta búsqueda' : ' en tu directorio'}`;
}

function revokePreviews() {
  previewUrls.forEach(url => URL.revokeObjectURL(url));
  previewUrls = [];
}

function renderPreview() {
  revokePreviews();
  const isUser = state.resource === 'users';
  const input = form.elements.namedItem(isUser ? 'avatar' : 'img');
  const files = [...input.files];
  const images = [];
  if (files.length) {
    for (const file of files.slice(0, isUser ? 1 : 5)) {
      const url = URL.createObjectURL(file);
      previewUrls.push(url);
      const image = node('img');
      image.src = url;
      image.alt = `Vista previa de ${file.name}`;
      images.push(image);
    }
  } else if (state.editing) {
    const urls = isUser ? [state.editing.avatar] : state.editing.img;
    for (const url of urls || []) {
      const image = imageElement(url, 'Imagen actual');
      if (image) images.push(image);
    }
  }
  $('#image-preview').replaceChildren(...images);
  $('#preview-caption').hidden = !images.length;
  $('#preview-caption').textContent = files.length ? 'Vista previa de los archivos seleccionados.' : 'Imágenes guardadas actualmente.';
}

function openForm(record = null) {
  const isUser = state.resource === 'users';
  state.editing = record;
  form.reset();
  showError('#form-error', '');
  $('#user-fields').hidden = !isUser;
  $('#pet-fields').hidden = isUser;
  for (const [selector, enabled] of [['#user-fields', isUser], ['#pet-fields', !isUser]]) {
    $(selector).querySelectorAll('input, select').forEach(input => {
      input.disabled = !enabled;
      input.required = enabled && input.type !== 'file' && input.name !== 'imageMode' && (input.name !== 'password' || !record);
    });
  }
  $('#image-mode-field').hidden = !record;
  form.elements.namedItem('imageMode').disabled = isUser || !record;
  if (record) {
    for (const key of isUser ? ['firstname', 'lastname', 'username'] : ['especie', 'color', 'edad', 'sexo']) form.elements.namedItem(key).value = record[key];
  }
  $('#form-eyebrow').textContent = record ? `EDITAR REGISTRO · ID ${record.id}` : 'NUEVO REGISTRO';
  $('#form-title').textContent = `${record ? 'Editar' : 'Registrar'} ${singular(state.resource)}`;
  $('#save-record').textContent = `Guardar ${singular(state.resource)}`;
  $('#password-label').textContent = record ? 'Nueva contraseña' : 'Contraseña *';
  $('#password-hint').textContent = record ? 'Déjala vacía para conservar la contraseña actual.' : 'Se guardará de forma segura.';
  renderPreview();
  dialog.showModal();
  form.querySelector(isUser ? '[name=firstname]' : '[name=especie]').focus();
}

function setFormBusy(busy) {
  state.busy = busy;
  // Disable only active controls, preserving the inactive form section.
  if (busy) {
    dialog.querySelectorAll('input:not(:disabled),select:not(:disabled),button:not(:disabled)').forEach(element => { element.dataset.busyDisabled = 'true'; element.disabled = true; });
  } else {
    dialog.querySelectorAll('[data-busy-disabled]').forEach(element => { element.disabled = false; delete element.dataset.busyDisabled; });
  }
  $('#save-record').textContent = busy ? 'Guardando…' : `Guardar ${singular(state.resource)}`;
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (state.busy || !form.reportValidity()) return;
  showError('#form-error', '');
  const resource = state.resource;
  const isUser = resource === 'users';
  const fileField = isUser ? 'avatar' : 'img';
  const files = [...form.elements.namedItem(fileField).files];
  if (files.length > (isUser ? 1 : 5)) return showError('#form-error', 'Puedes seleccionar hasta 5 fotografías por carga.');
  if (files.some(file => !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type))) return showError('#form-error', 'Selecciona imágenes JPEG, PNG, WebP o GIF.');
  if (files.some(file => file.size > 5 * 1024 * 1024)) return showError('#form-error', 'Cada imagen debe pesar como máximo 5 MB.');
  const body = new FormData(form);
  if (!files.length) body.delete(fileField);
  if (isUser && state.editing && !body.get('password')) body.delete('password');
  const editingId = state.editing?.id;
  setFormBusy(true);
  try {
    const saved = await api(`/api/${resource}${editingId ? `/${editingId}` : ''}`, { method: editingId ? 'PUT' : 'POST', body });
    if (editingId) state[resource] = state[resource].map(record => record.id === editingId ? saved : record);
    else state[resource].push(saved);
    $('#search').value = '';
    setFormBusy(false);
    dialog.close();
    render();
    notify(`${isUser ? 'Usuario' : 'Mascota'} ${editingId ? (isUser ? 'actualizado' : 'actualizada') : (isUser ? 'creado' : 'creada')} correctamente.`);
  } catch (error) { showError('#form-error', error.message); }
  finally { setFormBusy(false); }
});

function openDelete(record) {
  state.deleting = record;
  showError('#delete-error', '');
  $('#delete-description').textContent = `Se eliminará «${recordName(record, state.resource)}» (ID ${record.id}), junto con sus imágenes. Esta acción no se puede deshacer.`;
  deleteDialog.showModal();
  $('#cancel-delete').focus();
}

$('#confirm-delete').addEventListener('click', async () => {
  if (state.busy || !state.deleting) return;
  state.busy = true;
  const resource = state.resource;
  const id = state.deleting.id;
  $('#confirm-delete').disabled = true;
  $('#cancel-delete').disabled = true;
  $('#confirm-delete').textContent = 'Eliminando…';
  showError('#delete-error', '');
  try {
    await api(`/api/${resource}/${id}`, { method: 'DELETE' });
    state[resource] = state[resource].filter(record => record.id !== id);
    deleteDialog.close();
    render();
    notify('Registro eliminado correctamente.');
  } catch (error) { showError('#delete-error', error.message); }
  finally {
    state.busy = false;
    $('#confirm-delete').disabled = false;
    $('#cancel-delete').disabled = false;
    $('#confirm-delete').textContent = 'Sí, eliminar';
  }
});

function openDetail(record) {
  state.detail = record;
  const isUser = state.resource === 'users';
  const name = recordName(record, state.resource);
  $('#detail-title').textContent = name;
  $('#detail-eyebrow').textContent = `${isUser ? 'USUARIO' : 'MASCOTA'} · ID ${record.id}`;
  const gallery = $('#detail-gallery');
  gallery.replaceChildren();
  for (const url of (isUser ? [record.avatar] : record.img) || []) {
    const image = imageElement(url, `Fotografía de ${name}`);
    if (!image) continue;
    const link = node('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.title = 'Abrir imagen completa';
    link.append(image);
    gallery.append(link);
  }
  const fields = isUser ? [['Nombre', record.firstname], ['Apellido', record.lastname], ['Usuario', `@${record.username}`]] : [['Especie', record.especie], ['Color', record.color], ['Edad', `${record.edad} ${record.edad === 1 ? 'año' : 'años'}`], ['Sexo', record.sexo], ['Fotografías', record.img.length]];
  $('#detail-fields').replaceChildren(...fields.map(([label, value]) => {
    const row = node('div');
    row.append(node('dt', '', label), node('dd', '', value));
    return row;
  }));
  detailDialog.showModal();
}

document.querySelectorAll('[data-resource]').forEach(button => button.addEventListener('click', () => {
  state.resource = button.dataset.resource;
  $('#search').value = '';
  render();
}));
$('#search').addEventListener('input', render);
$('#refresh').addEventListener('click', load);
$('#add-record').addEventListener('click', () => openForm());
$('#empty-add').addEventListener('click', () => openForm());
document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => { if (!state.busy) dialog.close(); }));
dialog.addEventListener('close', () => { revokePreviews(); state.editing = null; form.reset(); });
form.elements.namedItem('avatar').addEventListener('change', renderPreview);
form.elements.namedItem('img').addEventListener('change', renderPreview);
$('#cancel-delete').addEventListener('click', () => deleteDialog.close());
deleteDialog.addEventListener('close', () => { state.deleting = null; });
for (const modal of [dialog, deleteDialog]) modal.addEventListener('cancel', event => { if (state.busy) event.preventDefault(); });
$('#close-detail').addEventListener('click', () => detailDialog.close());
$('#edit-from-detail').addEventListener('click', () => {
  const record = state.detail;
  detailDialog.close();
  openForm(record);
});
detailDialog.addEventListener('close', () => { state.detail = null; });
load();
