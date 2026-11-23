const express = require('express');

const router = express.Router();

const medicocontroller = require('../controllers/medicocontroller');

const { verificarToken } = require('../middlewares/authmiddleware');
const { autorizarRol } = require('../middlewares/autorizarrol');

router.use(verificarToken);
router.use(autorizarRol(1));

router.get('/', medicocontroller.obtenerMedicos);

module.exports = router;
