const turnoService = require('../services/turnoservice'); //importo el servicio de turnos (acceso a la BD)
const { validarCreacionTurno } = require('../middlewares/turnovalidator');

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

        return cancelarTurnoSeguro(req, res);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Error al cancelar el turno'
        });
    }
}

const ERRORES_CONFIRMAR = {
    TURNO_NO_EXISTE: () => [404, 'Turno no encontrado'],
    TURNO_CANCELADO: () => [409, 'No se puede confirmar un turno cancelado'],
    TURNO_YA_CONFIRMADO: () => [409, 'El turno ya se encuentra confirmado'],
    MEDICO_NO_EXISTE: (r) => [404, `No existe ningún médico con matrícula ${r.matricula}`],
    MEDICO_NO_HABILITADO: () => [409, 'El médico no está habilitado para realizar esta práctica'],
    MEDICO_OCUPADO: () => [409, 'El médico ya tiene otro turno en esa fecha y hora'],
    MEDICO_BLOQUEADO: (r) => [409, `El médico tiene la agenda bloqueada en ese horario (${r.motivo})`]
};

async function confirmarTurnoSeguro(req, res) {
    try {
        const resultado = await turnoService.confirmarSeguro(
            req.params.id,
            req.body?.medico_confirmacion,
            req.usuario.id_usuario
        );

        if (resultado.error) {
            const [estado, mensaje] = ERRORES_CONFIRMAR[resultado.error](resultado);
            return res.status(estado).json({ error: mensaje });
        }

        res.json({ mensaje: 'Turno confirmado correctamente', id_turno: resultado.id_turno });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Error al confirmar el turno'
        });
    }
}

const ERRORES_CANCELAR = {
    TURNO_NO_EXISTE: () => [404, 'Turno no encontrado'],
    TURNO_YA_CANCELADO: () => [409, 'El turno ya se encuentra cancelado']
};

async function cancelarTurnoSeguro(req, res) {
    try {
        const resultado = await turnoService.cancelarSeguro(
            req.params.id,
            req.usuario.id_usuario
        );

        if (resultado.error) {
            const [estado, mensaje] = ERRORES_CANCELAR[resultado.error]();
            return res.status(estado).json({ error: mensaje });
        }

        res.json({ mensaje: 'Turno cancelado correctamente', id_turno: resultado.id_turno });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Error al cancelar el turno'
        });
    }
}

const MAX_TURNOS_MASIVO = 20;

const CAMPOS_MASIVO = ['fecha_turno', 'hora_turno', 'dni_paciente', 'id_practica', 'medico_confirmacion', 'medio_solicitado'];

function validarFilaMasivo(datos) {
    return new Promise((resolve) => {
        const respuesta = {
            status() {
                return respuesta;
            },
            json(cuerpo) {
                resolve(cuerpo.error);
            }
        };
        validarCreacionTurno({ body: datos }, respuesta, () => resolve(null));
    });
}

async function crearTurnosMasivo(req, res) {
    try {
        const lista = req.body?.turnos;

        if (!Array.isArray(lista) || lista.length === 0) {
            return res.status(400).json({ error: 'Tenés que enviar al menos un turno en la lista "turnos"' });
        }

        if (lista.length > MAX_TURNOS_MASIVO) {
            return res.status(400).json({
                error: `Se pueden cargar hasta ${MAX_TURNOS_MASIVO} turnos por operación y enviaste ${lista.length}`
            });
        }

        const filas = [];
        const erroresPrevios = [];

        for (let i = 0; i < lista.length; i++) {
            const fila = i + 1;
            const origen = lista[i];

            if (typeof origen !== 'object' || origen === null || Array.isArray(origen)) {
                filas.push({ fila, datos: {} });
                erroresPrevios.push({ fila, error: 'La fila no tiene un formato válido' });
                continue;
            }

            const datos = { estado_turno: 'Confirmado' };
            CAMPOS_MASIVO.forEach((campo) => {
                datos[campo] = typeof origen[campo] === 'string' ? origen[campo].trim() : origen[campo];
            });
            filas.push({ fila, datos });

            const sinMedico = datos.medico_confirmacion === undefined || datos.medico_confirmacion === null || String(datos.medico_confirmacion) === '';
            if (sinMedico) {
                erroresPrevios.push({ fila, error: 'Falta la matrícula del médico' });
                continue;
            }

            const motivo = await validarFilaMasivo(datos);
            if (motivo) {
                erroresPrevios.push({ fila, error: motivo });
            }
        }

        const resultado = await turnoService.crearMasivo(filas, erroresPrevios, req.usuario.id_usuario);

        if (resultado.errores) {
            const filasConError = new Set(resultado.errores.map((e) => e.fila)).size;

            return res.status(422).json({
                error: 'No se cargó ningún turno porque hay filas con errores',
                resumen: {
                    total: filas.length,
                    correctas: filas.length - filasConError,
                    con_error: filasConError
                },
                errores: resultado.errores
            });
        }

        res.status(201).json({
            mensaje: `Se cargaron ${resultado.creados.length} turnos correctamente`,
            resumen: {
                total: filas.length,
                correctas: filas.length,
                con_error: 0
            },
            turnos_creados: resultado.creados
        });

    } catch (error) {
        console.error(error);

        if (error.code === 'ER_LOCK_DEADLOCK') {
            return res.status(409).json({
                error: 'Hubo un conflicto con otra operación simultánea. No se cargó ningún turno, probá de nuevo'
            });
        }

        res.status(500).json({
            error: 'Error al cargar los turnos'
        });
    }
}

module.exports = {
    confirmarTurnoSeguro,
    cancelarTurnoSeguro,
    crearTurnosMasivo,
    obtenerTurnos,
    obtenerMisTurnos,
    cancelarMiTurno,
    obtenerTurnoPorId,
    obtenerTurnosPorPaciente,
    crearTurno,
    cancelarTurno,
    confirmarTurno
};
