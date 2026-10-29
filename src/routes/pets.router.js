const { Router } = require('express');
const upload = require('../middlewares/multer.middleware');
const store = require('../utils/store');

const router = Router();

function fail(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function publicPet(pet) {
  const { password, ...record } = pet;
  return record;
}

function validatePet(body, creating) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw fail('Cuerpo inválido');
  }
  const allowed = ['especie', 'color', 'edad', 'sexo'];
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key) && key !== 'imageMode') throw fail(`Campo no permitido: ${key}`);
  }
  const fields = {};
  for (const key of allowed) {
    if (!(key in body)) {
      if (creating) throw fail(`Falta el campo ${key}`);
      continue;
    }
    const value = body[key];
    if (key === 'edad') {
      if (!['string', 'number'].includes(typeof value) || String(value).trim() === '' ||
          !Number.isInteger(Number(value)) || Number(value) < 0) {
        throw fail('edad debe ser un entero no negativo');
      }
      fields.edad = Number(value);
    } else {
      if (typeof value !== 'string' || !value.trim() || value.length > 256) {
        throw fail(`Campo inválido: ${key}`);
      }
      fields[key] = value.trim();
    }
  }
  if (fields.sexo && !['macho', 'hembra'].includes(fields.sexo)) {
    throw fail('sexo debe ser macho o hembra');
  }
  if (body.imageMode !== undefined && !['append', 'replace'].includes(body.imageMode)) {
    throw fail('imageMode debe ser append o replace');
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

async function getPets(req, res, next) {
  try {
    const pets = await store.read('pets');
    res.status(200).json(pets.map(publicPet));
  } catch (error) {
    next(error);
  }
}

async function getPetById(req, res, next) {
  try {
    const pets = await store.read('pets');
    const pet = pets.find(item => item.id === req.recordId);
    if (!pet) throw fail('Recurso no encontrado', 404);
    res.status(200).json(publicPet(pet));
  } catch (error) {
    next(error);
  }
}

async function createPet(req, res, next) {
  const images = (req.files || []).map(file => `/img/pets/${file.filename}`);
  let committed = false;
  try {
    const fields = validatePet(req.body, true);
    const pet = await store.mutate('pets', async pets => {
      const id = Math.max(0, ...pets.map(item => item.id)) + 1;
      const record = { ...fields, id, img: images };
      pets.push(record);
      return record;
    });
    committed = true;
    res.status(201).json(publicPet(pet));
  } catch (error) {
    if (!committed) {
      try {
        await store.removeImages(images);
      } catch (cleanupError) {
        return next(cleanupError);
      }
    }
    next(error);
  }
}

async function updatePet(req, res, next) {
  const images = (req.files || []).map(file => `/img/pets/${file.filename}`);
  let committed = false;
  let previousImages = [];
  try {
    const fields = validatePet(req.body, false);
    if (!Object.keys(fields).length && !images.length) throw fail('No hay campos para actualizar');
    const pet = await store.mutate('pets', async pets => {
      const index = pets.findIndex(item => item.id === req.recordId);
      if (index < 0) throw fail('Recurso no encontrado', 404);
      const old = pets[index];
      const replace = req.body.imageMode === 'replace';
      const record = {
        ...old,
        ...fields,
        id: old.id,
        img: replace ? images : [...(old.img || []), ...images]
      };
      if (replace) previousImages = old.img || [];
      pets[index] = record;
      return record;
    });
    committed = true;
    await store.removeImages(previousImages);
    res.status(200).json(publicPet(pet));
  } catch (error) {
    if (!committed) {
      try {
        await store.removeImages(images);
      } catch (cleanupError) {
        return next(cleanupError);
      }
    }
    next(error);
  }
}

async function deletePet(req, res, next) {
  try {
    const pet = await store.mutate('pets', async pets => {
      const index = pets.findIndex(item => item.id === req.recordId);
      if (index < 0) throw fail('Recurso no encontrado', 404);
      return pets.splice(index, 1)[0];
    });
    await store.removeImages(pet.img);
    res.status(200).json({ message: 'Recurso eliminado', id: pet.id });
  } catch (error) {
    next(error);
  }
}

router.param('id', validateId);
router.get('/', getPets);
router.get('/:id', getPetById);
router.post('/', upload.array('img', 5), createPet);
router.put('/:id', upload.array('img', 5), updatePet);
router.delete('/:id', deletePet);

module.exports = router;
