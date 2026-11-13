const express = require('express'); //importa express

const router = express.Router(); //crea el enrutador para agrupar las rutas de turnos

const turnocontroller = require('../controllers/turnocontroller'); //importa los controladores de turnos

const { validarCreacionTurno } = require('../middlewares/turnovalidator'); //middleware de validación de datos
const { verificarToken } = require('../middlewares/authmiddleware'); //middleware para validar el jwt
const { autorizarRol } = require('../middlewares/autorizarrol'); //middleware que restringe por rol

router.use(verificarToken); //se ejecuta antes de cualquier ruta, valida el token jwt

router.get('/mis-turnos', autorizarRol(2, 3), turnocontroller.obtenerMisTurnos);
router.put('/mis-turnos/:id/cancelar', autorizarRol(3), turnocontroller.cancelarMiTurno);

router.use(autorizarRol(1)); //si el rol del token no es 1, tira un 403 y no llega a los controladores

router.get('/', turnocontroller.obtenerTurnos); // "GET /api/turnos" (lista todos los turnos)
router.get('/paciente/:dni', turnocontroller.obtenerTurnosPorPaciente); // "GET /api/turnos/paciente/:dni"  (turnos de un paciente por dni)
router.get('/:id', turnocontroller.obtenerTurnoPorId); // "GET /api/turnos/:id" (devuelve un turno por su id)

router.post('/', validarCreacionTurno, turnocontroller.crearTurno); // "POST /api/turnos", primero valida que esté todo ok, si es así, lo crea

router.put('/:id/cancelar', turnocontroller.cancelarTurno); // "PUT /api/turnos/:id/cancelar" (cancela un turno)
router.put('/:id/confirmar', turnocontroller.confirmarTurno); // "PUT /api/turnos/:id/confirmar" (confirma un turno)

module.exports = router; //exporta el enrutador para el server.js