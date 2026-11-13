const turnoService = require('../services/turnoservice'); //importo el servicio de turnos (acceso a la BD)

//funcion para obtener todos los turnos
async function obtenerTurnos(req, res) { //  "GET /api/turnos"
    try {
        const turnos = await turnoService.obtenerTodos();

        res.json(turnos);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Error al obtener los turnos'
        });
    }
}

//obtener un turno por su id
async function obtenerTurnoPorId(req, res) { // GET /api/turnos/:id
    try {
        const turno = await turnoService.obtenerPorId(req.params.id);

        if (!turno) { //si el turno no existe
            return res.status(404).json({
                error: 'Turno no encontrado'
            });
        }

        res.json(turno);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Error al obtener el turno'
        });
    }
}

//obtener un turno por el dni del paciente
async function obtenerTurnosPorPaciente(req, res) { //GET /api/turnos/paciente/:dni
    try {
        const { dni } = req.params; //obtiene el dni del objeto 

        if (!/^\d{7,8}$/.test(dni)) { //devuelve true o false si cumple o no con la expresión regular (.test método nativo de JS)
            return res.status(400).json({
                error: 'El DNI debe contener 7 u 8 dígitos numéricos'
            });
        }

        if (!(await turnoService.pacienteExiste(dni))) {
            return res.status(404).json({
                error: `No existe ningún paciente registrado con el DNI ${dni}`
            });
        }

        const turnos = await turnoService.obtenerPorPaciente(dni);

        res.json(turnos); //si no llega a tener turnos simplemente da una lista vacía

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Error al obtener los turnos del paciente'
        });
    }
}

//crear un turno, las validaciones están en turnovalidator.js y es lo primero que se pasa en turnoroutes
async function crearTurno(req, res) { //POST /api/turnos
    try {
        const idTurno = await turnoService.crear(req.body);

        res.status(201).json({
            mensaje: 'Turno creado correctamente',
            id_turno: idTurno
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Error al crear el turno'
        });
    }
}

//cancelar un turno
async function cancelarTurno(req, res) { //PUT /api/turnos/:id/cancelar
    try {
        const turno = await turnoService.obtenerPorId(req.params.id);

        if (!turno) {
            return res.status(404).json({ 
                error: 'Turno no encontrado'
            });
        }

        if (turno.estado_turno === 'Cancelado') { //no se puede cancelar dos veces
            return res.status(409).json({ 
                error: 'El turno ya se encuentra cancelado'
            });
        }

        await turnoService.cancelar(turno.id_turno);

        res.json({ 
            mensaje: 'Turno cancelado correctamente', id_turno: turno.id_turno 
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Error al cancelar el turno'
        });
    }
}

//confirmar turno
async function confirmarTurno(req, res) { //PUT /api/turnos/:id/confirmar
    try {
        const turno = await turnoService.obtenerPorId(req.params.id);

        if (!turno) {
            return res.status(404).json({ 
                error: 'Turno no encontrado' 
            });
        }

        if (turno.estado_turno === 'Cancelado') { //un turno que ya está cancelado no se puede confirmar
            return res.status(409).json({ 
                error: 'No se puede confirmar un turno cancelado' 
            });
        }

        if (turno.estado_turno === 'Confirmado') {
            return res.status(409).json({ 
                error: 'El turno ya se encuentra confirmado' 
            });
        }

        //primero ve si el medico_confirmacion viene dentro del cuerpo de la petición, sino busca alguno anterior y sino lo asigna como null
        const matricula = req.body?.medico_confirmacion ?? turno.medico_confirmacion ?? null;

        if (matricula !== null) { //valida si la matrícula contiene datos
            // primero valida si esa matricula NO tiene letras (solo números) o también si en la BD NO existe ese médico
            if (!/^\d+$/.test(String(matricula)) || !(await turnoService.medicoExiste(matricula))) {
                return res.status(404).json({ error: `No existe ningún médico con matrícula ${matricula}` });
            }

            if (!(await turnoService.medicoRealizaPractica(matricula, turno.id_practica))) {
                return res.status(409).json({ error: 'El médico no está habilitado para realizar esta práctica' });
            }

            if (await turnoService.medicoOcupado(matricula, turno.id_turno)) {
                return res.status(409).json({ error: 'El médico ya tiene otro turno en esa fecha y hora' });
            }
        }

        await turnoService.confirmar(turno.id_turno, matricula);

        res.json({ mensaje: 'Turno confirmado correctamente', id_turno: turno.id_turno });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Error al confirmar el turno'
        });
    }
}

async function obtenerMisTurnos(req, res) { //Lee el token para saber quién sos y trae tus turnos
    try {
        const idRol = Number(req.usuario.id_rol);
        const identificador = idRol === 3 ? req.usuario.dni_paciente : req.usuario.matricula_medico;

        if (!identificador) { 
            return res.status(403).json({
                error: 'Tu sesión no tiene los datos necesarios. Volvé a iniciar sesión'
            });
        }

        const turnos = await turnoService.obtenerMisTurnos(idRol, identificador);

        res.json(turnos);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Error al obtener tus turnos'
        });
    }
}

async function cancelarMiTurno(req, res) { //Verifica que aquél que quiera cancelar un turno, realmente el turno sea de él
    try {
        const turno = await turnoService.obtenerPorId(req.params.id);

        if (!turno) {
            return res.status(404).json({
                error: 'Turno no encontrado'
            });
        }

        if (Number(turno.dni_paciente) !== Number(req.usuario.dni_paciente)) { //Compara el DNI del paciente del turno con el DNI del token
            return res.status(403).json({
                error: 'No podés cancelar un turno que no es tuyo'
            });
        }

        return cancelarTurno(req, res);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Error al cancelar el turno'
        });
    }
}

module.exports = {
    obtenerTurnos,
    obtenerMisTurnos,
    cancelarMiTurno,
    obtenerTurnoPorId,
    obtenerTurnosPorPaciente,
    crearTurno,
    cancelarTurno,
    confirmarTurno
};
