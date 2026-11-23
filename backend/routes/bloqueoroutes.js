const express = require('express');

const router = express.Router();

const bloqueocontroller = require('../controllers/bloqueocontroller');

const { verificarToken } = require('../middlewares/authmiddleware');
const { autorizarRol } = require('../middlewares/autorizarrol');

router.use(verificarToken);
router.use(autorizarRol(1));

router.get('/vista-previa', bloqueocontroller.vistaPreviaBloqueo);
router.get('/', bloqueocontroller.listarBloqueos);
router.post('/', bloqueocontroller.crearBloqueo);

module.exports = router;
