const express = require('express');

const router = express.Router();

const practicacontroller = require('../controllers/practicacontroller');

const { verificarToken } = require('../middlewares/authmiddleware');
const { autorizarRol } = require('../middlewares/autorizarrol');

router.use(verificarToken);
router.use(autorizarRol(1));

router.get('/', practicacontroller.obtenerPracticas);

module.exports = router;
