const express = require('express'); //Importo express
const router = express.Router(); //Creo un enrutador para las rutas de autenticación
const authcontroller = require('../controllers/authcontroller'); //Controlador de autenticación
const registrocontroller = require('../controllers/registrocontroller'); //Ccontrolador de registro
const verificacioncontroller = require('../controllers/verificacioncontroller'); //Ccontrolador de verificación de correo

router.post('/login', authcontroller.login); //POST /api/auth/login (la ruta es pública y devuelve un JWT)
router.post('/registro/paciente', registrocontroller.registrarPaciente); //POST /api/auth/registro/paciente (crea la cuenta del paciente)
router.post('/registro/medico', registrocontroller.registrarMedico); //POST /api/auth/registro/medico (crea la cuenta de un médico)
router.get('/verificar-email', verificacioncontroller.verificarEmail); //GET /api/auth/verificar-email (confirma el correo)

module.exports = router;