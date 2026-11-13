const db = require('../config/database'); //importa el pool de conexiones a MySQL para consultar la BD

//lo primero es asignar los estados válidos y horarios válidos

const ESTADOS_VALIDOS = ['Reservado', 'Confirmado', 'Cancelado']; //Estados en la BD que existen en la tabla de turnos
const MEDIOS_VALIDOS = ['Web', 'Teléfono', 'WhatsApp']; //Medios válidos que están en la BD
const MIN_APERTURA = 8 * 60; //Horario de apertura expresada en minutos (08 am)
const MIN_CIERRE_SEMANA = 20 * 60; //Cierre de lunes a viernes expresada en minutos (20:00 hrs)
const MIN_CIERRE_SABADO = 14 * 60; //Horario de cierre de los sábados expresado en minutos (14:00 hrs)


function fechaDeHoy() { //Devuelve la fecha de hoy (hora local) con formato año-mes-dia
    const d = new Date(); //Obtiene la fecha y hora local y lo guarda en la constante "d"
    const mes = String(d.getMonth() + 1).padStart(2, '0'); //obtiene el mes y le suma 1 porque JS cuenta desde 0
    const dia = String(d.getDate()).padStart(2, '0'); //padStart dice que si no tiene 2 números, le agregue un 0 a la izquierda (3 a 03 para marzo)
    return `${d.getFullYear()}-${mes}-${dia}`; //Devuelve la fecha con formato año-mes-dia
}

function esFechaValida(texto) { //Valida si la fecha es una fecha real, por ej para que no pase un 31 de febrero
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false; //primero valida si tiene formato año (4) - mes (2) y dia (2)
    const [a, m, d] = texto.split('-').map(Number); //separa año, mes y día como números (le agrega un "-")
    const f = new Date(Date.UTC(a, m - 1, d)); //construye la fecha en UTC para evitar corrimientos por zona horaria
    return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d; //retorna la fecha
}


function diaDeSemana(texto) { //devuelve el día de la semana (0 es domingo, 6 es sábado)
    const [a, m, d] = texto.split('-').map(Number); //primero separa año, mes y dia y los transforma a números
    return new Date(Date.UTC(a, m - 1, d)).getUTCDay(); //se le resta 1 al mes porque 11 seria diciembre (arranca enero en 0)
} //se usa "UTC" para armar como una fecha universal por tema de si cambia el horario o algo


function horaAMinutos(texto) { //función que convierte horas a minutos
    const m = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(texto); //valida que las horas estén entre 00 y 23 y los minutos entre 00 y 59
    //"m" va a guardar esa fecha y hora, con ".exec(texto)" va a ver si encaja en ese HH:MM (por ej un 25:99 o "asd" queda vacío)
    if (!m) return null; //si no coincide, quiere decir que el formato no es válido como puse arriba
    return Number(m[1]) * 60 + Number(m[2]); //multiplica las horas x 60 + minutos, por ej 02:30 son 150 min (60x2 + 30)
}


async function validarCreacionTurno(req, res, next) { //toda la validación para crear un turno
    const { 
        fecha_turno,
        hora_turno,
        medio_solicitado,
        estado_turno,
        fecha_confirmacion,
        medico_confirmacion,
        dni_paciente,
        id_practica,
        id_equipo,
        id_disponibilidad
    } = req.body || {}; //saca todos los datos del cuerpo de la petición, si viene vacío quedaría como "undefined", entonces hay que tratarlo

    //Función flecha que valida si algo viene undefined, nulo o vacío
    const vacio = (v) => v === undefined || v === null || String(v).trim() === '';
    if (vacio(fecha_turno) || vacio(hora_turno) || vacio(dni_paciente) || vacio(id_practica) ||
        vacio(estado_turno) || vacio(medio_solicitado)) { //Revisa si alguno de los campos obligatorios viene vacío
        return res.status(400).json({
            error: 'Faltan campos obligatorios (fecha_turno, hora_turno, dni_paciente, id_practica, estado_turno, medio_solicitado)'
        });
    }

    //Valida el formato del DNI (7 u 8 dígitos)
    if (!/^\d{7,8}$/.test(String(dni_paciente))) {
        return res.status(400).json({ error: 'El DNI debe contener 7 u 8 dígitos numéricos' });
    }

    //Valida que el estado debe ser uno de los existentes
    if (!ESTADOS_VALIDOS.includes(estado_turno)) { //si el estado del turno NO está dentro de los estados válidos
        return res.status(400).json({
            error: `estado_turno inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}`
        });
    }

    //Valida que el medio esté dentro de los medios válidos
    if (!MEDIOS_VALIDOS.includes(medio_solicitado)) { //si el medio NO está dentro de los medios válidos
        return res.status(400).json({
            error: `medio_solicitado inválido. Valores permitidos: ${MEDIOS_VALIDOS.join(', ')}`
        });
    }

    //Valida el formato de la fecha
    if (typeof fecha_turno !== 'string' || !esFechaValida(fecha_turno)) { //valida que sea un texto con formato año-mes-dia
        return res.status(400).json({ error: 'fecha_turno inválida. Use el formato YYYY-MM-DD' });
    }
    if (fecha_turno < fechaDeHoy()) { //valida si la fecha es anterior a la fecha
        return res.status(400).json({ error: 'La fecha del turno no puede ser anterior al día de hoy' });
    }

    //Valida la franja horaria
    const minutos = typeof hora_turno === 'string' ? horaAMinutos(hora_turno) : null; //Pasa la hora a minutos
    if (minutos === null) { //si la hora no tiene un formato válido tira error
        return res.status(400).json({ error: 'hora_turno inválida. Use el formato HH:MM o HH:MM:SS' });
    }
    const dia = diaDeSemana(fecha_turno); //Valida el día de la semana
    if (dia === 0) { //Si el día es 0, o sea domingo, dice que no se atiende
        return res.status(400).json({ error: 'No se atiende los domingos' });
    }
    const cierre = dia === 6 ? MIN_CIERRE_SABADO : MIN_CIERRE_SEMANA; //Valida cierres de sábado o durante la semana
    if (minutos < MIN_APERTURA || minutos >= cierre) { //El turno debe ser a partir del horario de apertura y antes del cierre
        return res.status(400).json({
            error: dia === 6
                ? 'Los sábados el horario de atención es de 08:00 a 14:00'
                : 'De lunes a viernes el horario de atención es de 08:00 a 20:00'
        });
    }

    //Valida la fecha de confirmación (fecha válida y que no sea una fecha del pasado)
    if (!vacio(fecha_confirmacion)) { //Valida si la fecha NO viene vacía
        const fechaConf = new Date(fecha_confirmacion); //Guarda la fecha en un objeto
        if (isNaN(fechaConf.getTime())) { //getTime devuelve NaN si la fecha es inválida
            return res.status(400).json({ error: 'fecha_confirmacion inválida' });
        }
        if (fechaConf < new Date()) { //Compara si la fecha de confirmación es una fecha pasada
            return res.status(400).json({ error: 'La fecha de confirmación no puede ser anterior a la fecha actual' });
        }
    }

    //Si el turno tiene asignado un médico, lo valida
    const hayMedico = !vacio(medico_confirmacion); //Valida si hay un médico
    if (hayMedico && !/^\d+$/.test(String(medico_confirmacion))) { // Debe ser solo dígitos
        return res.status(400).json({ error: 'medico_confirmacion debe ser una matrícula numérica' });
    }
    const hayEquipo = !vacio(id_equipo); // Indica si se informó equipo (es opcional en la BD)

    try {
        const [pacientes] = await db.query( //Busca el DNI en la tabla de pacientes
            'SELECT dni_paciente FROM paciente WHERE dni_paciente = ?',
            [dni_paciente]
        );
        if (pacientes.length === 0) { //Si no está en la BD, da error
            return res.status(404).json({ error: `No existe ningún paciente registrado con el DNI ${dni_paciente}` });
        }

        const [practicas] = await db.query('SELECT id_practica FROM practica WHERE id_practica = ?', [id_practica]); //Busca la práctica
        if (practicas.length === 0) { //Si no existe, da error
            return res.status(404).json({ error: `No existe la práctica con id ${id_practica}` });
        }

        if (hayEquipo) { //Busca si hay equipo, aunque puede ser opcional, si viene debe existir
            const [equipos] = await db.query('SELECT id_equipo FROM equipo WHERE id_equipo = ?', [id_equipo]); //Busca el equipo
            if (equipos.length === 0) { //Si no existe da error
                return res.status(404).json({ error: `No existe el equipo con id ${id_equipo}` });
            }
        }

        if (!vacio(id_disponibilidad)) { //Busca si hay disponibilidad aunque es opcional, pero si viene debe existir
            const [disp] = await db.query('SELECT id_disponibilidad FROM disponibilidad WHERE id_disponibilidad = ?', [id_disponibilidad]);
            if (disp.length === 0) { //Si no existe da error
                return res.status(404).json({ error: `No existe la disponibilidad con id ${id_disponibilidad}` });
            }
        }

        if (hayMedico) { //Busca si hay médico aunque es opcional, pero si viene tiene que existir
            const [medicos] = await db.query('SELECT matricula_medico FROM medico WHERE matricula_medico = ?', [medico_confirmacion]);
            if (medicos.length === 0) { //Si no existe da error
                return res.status(404).json({ error: `No existe ningún médico con matrícula ${medico_confirmacion}` });
            }

            const [habilitado] = await db.query(
                'SELECT 1 FROM practica_medico WHERE matricula_medico = ? AND id_practica = ?',
                [medico_confirmacion, id_practica]
            );
            if (habilitado.length === 0) {
                return res.status(409).json({ error: 'El médico no está habilitado para realizar esta práctica' });
            }
        }

        const [duplicados] = await db.query(
            `SELECT id_turno FROM turno
             WHERE fecha_turno = ? AND hora_turno = ? AND id_practica = ? AND estado_turno <> 'Cancelado'`,
            [fecha_turno, hora_turno, id_practica] //Busca que el turno NO esté duplicado (misma fecha, hora y práctica)
        ); 
        if (duplicados.length > 0) { //Si ese duplicado es mayor a 0, quiere decir que ya hay un turno reservado
            return res.status(409).json({ error: 'Ya existe un turno reservado para esa fecha, hora y práctica' });
        }

        const [mismoPaciente] = await db.query(
            `SELECT id_turno FROM turno
             WHERE fecha_turno = ? AND hora_turno = ? AND dni_paciente = ? AND estado_turno <> 'Cancelado'`,
            [fecha_turno, hora_turno, dni_paciente] //Busca si es el mismo paciente, ya que no puede tener dos turnos a la misma hora el mismo día
        );
        if (mismoPaciente.length > 0) { //Si es mayor a 0, quiere decir que ese mismo paciente ya tiene un turno    
            return res.status(409).json({ error: 'El paciente ya tiene un turno en esa fecha y hora' });
        }

        if (hayEquipo) {
            const [mismoEquipo] = await db.query(
                `SELECT id_turno FROM turno
                 WHERE fecha_turno = ? AND hora_turno = ? AND id_equipo = ? AND estado_turno <> 'Cancelado'`,
                [fecha_turno, hora_turno, id_equipo]
            ); //El equipo no puede estar asignado a dos turnos en el mismo horario
            if (mismoEquipo.length > 0) {
                return res.status(409).json({ error: 'El equipo ya está asignado a otro turno en esa fecha y hora' });
            }
        }

        if (hayMedico) {
            const [mismoMedico] = await db.query(
                `SELECT id_turno FROM turno
                 WHERE fecha_turno = ? AND hora_turno = ? AND medico_confirmacion = ? AND estado_turno <> 'Cancelado'`,
                [fecha_turno, hora_turno, medico_confirmacion]
            ); //El médico no puede estar asignado a dos turnos en el mismo horario
            if (mismoMedico.length > 0) {
                return res.status(409).json({ error: 'El médico ya está asignado a otro turno en esa fecha y hora' });
            }
        }

        next(); //Si pasan todas las validaciones, recién continúa hacia el controlador

    } catch (error) { //Si ocurre cualquier tipo de falla, lo captura
        console.error('Error en validador de turnos:', error); //El servidor lo detecta como un error, visualmente se ve rojo para detectarlo
        return res.status(500).json({ error: 'Error interno al validar los datos del turno' });
    }
}

module.exports = {
    validarCreacionTurno
};
