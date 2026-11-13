const db = require('../config/database'); //Pool de conexiones a la BD
const bcrypt = require('bcryptjs'); //Librería para hashear contraseñas
const { crearTokenCuenta } = require('../services/tokenservice'); //Servicio para generar los JWT
const { enviarCorreo } = require('../services/emailservice'); //Servicio para enviar correos

const FRONTEND_URL = process.env.FRONTEND_URL;

async function registrarPaciente(req, res) { //Función para manejar el registro de un nuevo paciente
    let conexion; // Declara la variable para manejar la conexión de la transacción de base de datos

    try {
        const { //Obtiene los datos enviados por el cliente en el cuerpo de la petición
            dni_paciente, 
            nombre_paciente,
            apellido_paciente,
            fec_nac_paciente,
            email,
            password
        } = req.body || {}; // Si viene vacío, asigna un objeto vacío para evitar errores

        if ( //Valida que ningún campo obligatorio esté vacío
            !dni_paciente ||
            !nombre_paciente?.trim() ||
            !apellido_paciente?.trim() ||
            !fec_nac_paciente ||
            !email ||
            !password
        ) {
            return res.status(400).json({ //Si falta algún dato obligatorio, devuelve un 400
                error: 'Todos los datos obligatorios deben completarse'
            });
        } 

        const dni = Number(dni_paciente); //Convierte el DNI recibido a un número
        const correo = email.trim().toLowerCase();

        if (!Number.isSafeInteger(dni) || dni <= 0) { //Valida que el DNI sea un número entero y positivo
            return res.status(400).json({ // Si no es válido, devuelve un 400
                error: 'El DNI no es válido'
            });
        }

        if (correo.length > 50 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { //Valida la longitud máxima (50) y formato de email
            return res.status(400).json({ //Si el correo no es válido, devuelve un 400
                error: 'Ingresá un correo válido de hasta 50 caracteres'
            });
        }

        if (password.length < 8) { //Valida que la contraseña tenga como mínimo 8 caracteres
            return res.status(400).json({
                error: 'La contraseña debe tener al menos 8 caracteres'
            });
        }

        const [usuarios] = await db.execute( //Consulta si ya existe un usuario registrado con ese mismo correo en la tabla usuario
            'SELECT id_usuario FROM usuario WHERE email = ?',
            [correo]
        );

        if (usuarios.length > 0) { //Si encuentra algún registro con ese correo devuelve un 409
            return res.status(409).json({ //
                error: 'Ya existe una cuenta registrada con ese correo'
            });
        }

        const [pacientes] = await db.execute( //Consulta si el DNI del paciente ya existe en la tabla paciente
            `SELECT dni_paciente, email_paciente
             FROM paciente
             WHERE dni_paciente = ?`,
            [dni]
        );

        if ( //Valida si el paciente ya existe pero está intentando registrarse con un correo diferente al que tenía guardado
            pacientes.length > 0 &&
            (pacientes[0].email_paciente || '').toLowerCase() !== correo
        ) {
            return res.status(409).json({
                error: 'El DNI ya está registrado con otro correo. Contactá con la administración.' 
            }); 
        } 

        const hash = await bcrypt.hash(password, 10); //Genera el hash de contraseña
        let idUsuario; //Variable para almacenar el ID del usuario insertado en la BD

        conexion = await db.getConnection(); //Obtiene una conexión exclusiva del pool para iniciar una transacción
        await conexion.beginTransaction(); //Inicia la transacción

        if (pacientes.length === 0) { //Si el paciente todavía no existe en la tabla paciente, inserta los datos en la tabla
            await conexion.execute(
                `INSERT INTO paciente (
                    dni_paciente,
                    nombre_paciente,
                    apellido_paciente,
                    fec_nac_paciente,
                    email_paciente
                ) VALUES (?, ?, ?, ?, ?)`,
                [
                    dni,
                    nombre_paciente.trim(),
                    apellido_paciente.trim(),
                    fec_nac_paciente,
                    correo
                ]
            );
        } 

        const [resultado] = await conexion.execute( //Inserta el nuevo registro de usuario vinculado al paciente
            `INSERT INTO usuario (
                email,
                password_hash,
                id_rol,
                activo,
                dni_paciente,
                email_verificado
            ) VALUES (?, ?, 3, 1, ?, 0)`, // id_rol = 3 (paciente), activo = 1, email_verificado = 0 (pendiente de validación)
            [correo, hash, dni]
        );

        idUsuario = resultado.insertId; //Obtiene el ID autoincremental del usuario que recién se creó

        await conexion.commit(); //Confirma la transacción en la base de datos si todo salió bien

        const token = await crearTokenCuenta( //Crea el token de verificación de cuenta (30 minutos de validez)
            idUsuario,
            'VERIFICACION_EMAIL',
            30
        );

        const enlace = //Enlace que se le manda al usuario por correo
            `${FRONTEND_URL}/verificar-email.html?token=${token}`;

        await enviarCorreo({ //Manda el correo de verificación al paciente
            to: correo, //Destinatario
            subject: 'Verificá tu correo - Gestión de Turnos', //Asunto
            text: //Texto plano del correo
                `Hola ${nombre_paciente.trim()}. ` +
                `Para verificar tu correo, abrí este enlace: ${enlace}. ` +
                'El enlace vence en 30 minutos.',
            html: ` // Versión formateada en HTML del correo
                <h2>Verificación de correo</h2>
                <p>Hola ${nombre_paciente.trim()},</p>
                <p>Para activar la verificación de tu cuenta, hacé clic en el siguiente enlace:</p>
                <p><a href="${enlace}">Verificar mi correo</a></p>
                <p>El enlace vence en 30 minutos.</p>
                <p>Si no solicitaste esta cuenta, ignorá este mensaje.</p>
            `
        });

        return res.status(201).json({ //Devuelve un 201 de creado
            mensaje: 'Registro realizado. Revisá el correo para verificar tu cuenta.'
        });

    } catch (error) { //Si ocurre algún tipo de problema
        if (conexion) { // Si la conexión fue abierta, revierte todos los cambios en la BD
            try {
                await conexion.rollback();
            } catch (errorRollback) {
                console.error('Error al revertir la transacción:', errorRollback);
            }
        }

        console.error('Error en registro de paciente:', error);

        if (error.code === 'ER_DUP_ENTRY') { //Si el error de MySQL es por una entrada duplicada (clave única violada)
            return res.status(409).json({
                error: 'El DNI o el correo ya se encuentran registrados'
            });
        } 

        return res.status(500).json({ //Cualquier otro error manda un 500
            error: 'No se pudo completar el registro. Revisá el servidor.'
        });

    } finally { //Se ejecuta siempre, haya un error o éxito
        if (conexion) conexion.release(); //Libera la conexión de vuelta al pool de MySQL para no saturar recursos
    }
}

async function registrarMedico(req, res) { // Función para registrar un médico
    let conexion; // Declara la variable para manejar la conexión de la transacción de base de datos

    try {
        const { matricula_medico, email, password } = req.body || {}; // Extrae matrícula, email y contraseña del cuerpo de la petición

        if (!matricula_medico || !email || !password) { //Valida que los campos obligatorios vengan con datos, sino tira un 400
            return res.status(400).json({
                error: 'La matrícula, el correo y la contraseña son obligatorios'
            });
        }

        const matricula = Number(matricula_medico); //Convierte la matrícula a número
        const correo = email.trim().toLowerCase();

        if (!Number.isSafeInteger(matricula) || matricula <= 0) { //Valida que la matrícula sea un entero positivo
            return res.status(400).json({
                error: 'La matrícula no es válida'
            });
        }

        if ( //Valida la longitud y formato del correo, si hay un error devuelve un 400
            correo.length > 100 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
        ) {
            return res.status(400).json({
                error: 'Ingresá un correo válido'
            });
        }

        if (password.length < 8) { //Valida la longitud mínima de la contraseña
            return res.status(400).json({
                error: 'La contraseña debe tener al menos 8 caracteres'
            });
        }

        const [medicos] = await db.execute( //Consulta si la matrícula ya existe en la tabla de médicos
            `SELECT matricula_medico
             FROM medico
             WHERE matricula_medico = ?`,
            [matricula]
        );

        if (medicos.length === 0) { //Si la matrícula no está cargada en el sistema de la clínica
            return res.status(404).json({ // Responde con error 404 (Not Found)
                error: 'La matrícula no existe en el registro de médicos'
            });
        }

        const [usuarios] = await db.execute( //Consulta si ya hay un usuario registrado con ese correo o esa matrícula
            `SELECT id_usuario
             FROM usuario
             WHERE email = ? OR matricula_medico = ?`,
            [correo, matricula]
        );

        if (usuarios.length > 0) { //Valida si ya existen credenciales registradas con esos datos
            return res.status(409).json({
                error: 'El correo o la matrícula ya tienen una cuenta registrada'
            });
        }

        const hash = await bcrypt.hash(password, 10); //Genera el hash

        conexion = await db.getConnection(); //Obtiene conexión del pool
        await conexion.beginTransaction(); //Inicia la transacción

        const [resultado] = await conexion.execute( //Inserta el nuevo usuario con rol de médico
            `INSERT INTO usuario (
                email,
                password_hash,
                id_rol,
                activo,
                matricula_medico,
                email_verificado
            ) VALUES (?, ?, 2, 1, ?, 0)`, // id_rol 2 (médico), email_verificado = 0
            [correo, hash, matricula]
        );

        const idUsuario = resultado.insertId; //Obtiene el ID del usuario creado

        await conexion.commit(); //Confirma la transacción

        const token = await crearTokenCuenta( //Crea el token de verificación de cuenta por correo (30 min)
            idUsuario,
            'VERIFICACION_EMAIL',
            30
        );

        const enlace = //Construye el enlace de verificación para el médico
            `${FRONTEND_URL}/verificar-email.html?token=${token}`;

        await enviarCorreo({ //Envía el correo electrónico de verificación al médico
            to: correo,
            subject: 'Verificá tu correo - Gestión de Turnos',
            text:
                `Para verificar tu cuenta de médico, abrí este enlace: ${enlace}. ` +
                'El enlace vence en 30 minutos.',
            html: `
                <h2>Verificación de correo</h2>
                <p>Para verificar tu cuenta de médico, hacé clic en el siguiente enlace:</p>
                <p><a href="${enlace}">Verificar mi correo</a></p>
                <p>El enlace vence en 30 minutos.</p>
            `
        });

        return res.status(201).json({ //Responde un 201 de creado
            mensaje: 'Registro realizado. Revisá el correo para verificar tu cuenta.'
        });

    } catch (error) { //Si ocurre algún error
        if (conexion) {
            try {
                await conexion.rollback();
            } catch (errorRollback) {
                console.error('Error al revertir la transacción:', errorRollback);
            }
        }

        console.error('Error en registro de médico:', error); //Registra el error en la consola

        if (error.code === 'ER_DUP_ENTRY') { //Manejo de duplicados en base de datos
            return res.status(409).json({
                error: 'El correo o la matrícula ya están registrados'
            });
        }

        return res.status(500).json({ //Para cualquier otro fallo tira un 500
            error: 'No se pudo completar el registro. Revisá el servidor.'
        });

    } finally { //Bloque de finally para liberar la conexión de la base de datos
        if (conexion) conexion.release();
    }
}

module.exports = {
    registrarPaciente,
    registrarMedico
};