const { Router } = require('express');
const upload = require('../middlewares/multer.middleware');
const store = require('../utils/store');
const { hashPassword } = require('../utils/crypto');

const router = Router();

function fail(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function publicUser(user) {
  const { password, ...record } = user;
  return record;
}

function validateUser(body, creating) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw fail('Cuerpo inválido');
  }
  const allowed = ['firstname', 'lastname', 'username', 'password'];
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) throw fail(`Campo no permitido: ${key}`);
  }
  const fields = {};
  for (const key of allowed) {
    if (!(key in body)) {
      if (creating) throw fail(`Falta el campo ${key}`);
      continue;
    }
    const value = body[key];
    if (typeof value !== 'string' || !value.trim() || value.length > 256) {
      throw fail(`Campo inválido: ${key}`);
    }
    fields[key] = key === 'password' ? value : value.trim();
  }
  return fields;
}

function validateId(req, res, next, value) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    return next(fail('ID inválido'));
  }
  req.recordId = Number(value);
  next();
}

async function getUsers(req, res, next) {
  try {
    const users = await store.read('users');
    res.status(200).json(users.map(publicUser));
  } catch (error) {
    next(error);
  }
}

async function getUserById(req, res, next) {
  try {
    const users = await store.read('users');
    const user = users.find(item => item.id === req.recordId);
    if (!user) throw fail('Recurso no encontrado', 404);
    res.status(200).json(publicUser(user));
  } catch (error) {
    next(error);
  }
}

async function createUser(req, res, next) {
  const avatar = req.file ? `/img/users/${req.file.filename}` : null;
  let committed = false;
  try {
    const fields = validateUser(req.body, true);
    fields.password = await hashPassword(fields.password);
    const user = await store.mutate('users', async users => {
      if (users.some(item => item.username.toLowerCase() === fields.username.toLowerCase())) {
        throw fail('username ya existe');
      }
      const id = Math.max(0, ...users.map(item => item.id)) + 1;
      const record = { ...fields, id, avatar };
      users.push(record);
      return record;
    });
    committed = true;
    res.status(201).json(publicUser(user));
  } catch (error) {
    if (!committed) {
      try {
        await store.removeImages([avatar]);
      } catch (cleanupError) {
        return next(cleanupError);
      }
    }
    next(error);
  }
}

async function updateUser(req, res, next) {
  const avatar = req.file ? `/img/users/${req.file.filename}` : null;
  let committed = false;
  let previousAvatar = null;
  try {
    const fields = validateUser(req.body, false);
    if (!Object.keys(fields).length && !avatar) throw fail('No hay campos para actualizar');
    if (fields.password) fields.password = await hashPassword(fields.password);
    const user = await store.mutate('users', async users => {
      const index = users.findIndex(item => item.id === req.recordId);
      if (index < 0) throw fail('Recurso no encontrado', 404);
      if (fields.username && users.some(item =>
        item.id !== req.recordId && item.username.toLowerCase() === fields.username.toLowerCase())) {
        throw fail('username ya existe');
      }
      const old = users[index];
      const record = { ...old, ...fields, id: old.id, avatar: avatar || old.avatar || null };
      if (avatar) previousAvatar = old.avatar;
      users[index] = record;
      return record;
    });
    committed = true;
    await store.removeImages([previousAvatar]);
    res.status(200).json(publicUser(user));
  } catch (error) {
    if (!committed) {
      try {
        await store.removeImages([avatar]);
      } catch (cleanupError) {
        return next(cleanupError);
      }
    }
    next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    const user = await store.mutate('users', async users => {
      const index = users.findIndex(item => item.id === req.recordId);
      if (index < 0) throw fail('Recurso no encontrado', 404);
      return users.splice(index, 1)[0];
    });
    await store.removeImages([user.avatar]);
    res.status(200).json({ message: 'Recurso eliminado', id: user.id });
  } catch (error) {
    next(error);
  }
}

router.param('id', validateId);
router.get('/', getUsers);
router.get('/:id', getUserById);
router.post('/', upload.single('avatar'), createUser);
router.put('/:id', upload.single('avatar'), updateUser);
router.delete('/:id', deleteUser);

module.exports = router;
