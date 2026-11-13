const authService = require('../services/authservice'); //Este servicio verifica las credenciales contra la BD
const jwt = require('jsonwebtoken'); //Genera el token

async function login(req, res) {
    try {
        const { email, password } = req.body || {}; //Extrae email y password de la petición (si no llegó cuerpo usa un objeto vacío)

        if (!email || !password) { //Si falta el email o la contraseña
            return res.status(400).json({
                error: 'El email y la contraseña son obligatorios'
            });
        }

        const usuario = await authService.verificarCredenciales( //Valida las credenciales usando el servicio
            email.trim().toLowerCase(), //Normaliza el email del cliente
            password
        ); //Devuelve el usuario (referencia "usuario"), null o un error de email no verificado

        if (!usuario) { //Si las credenciales no son válidas o el usuario está inactivo
            return res.status(401).json({
                error: 'Credenciales incorrectas'
            });
        }

        if (usuario.error === 'EMAIL_NO_VERIFICADO') { //Credenciales están bien pero el email no está verificado
            return res.status(403).json({
                error: 'Debés verificar tu correo antes de iniciar sesión'
            }); 
        }

        if (!process.env.JWT_SECRET) { //Si falta la clave para firmar el token
            throw new Error('Falta configurar JWT_SECRET en .env'); //Lo captura el catch y responde 500
        }

        //Acá se genera el token si las validaciones anteriores están bien
        const token = jwt.sign( //Firma el token que tiene los siguientes datos
            {
                id_usuario: usuario.id_usuario,
                email: usuario.email,
                id_rol: usuario.id_rol,
                dni_paciente: usuario.dni_paciente,
                matricula_medico: usuario.matricula_medico
            },
            process.env.JWT_SECRET, //Clave con la que se firma
            { expiresIn: '1h' }
        );

        return res.status(200).json({
            mensaje: 'Inicio de sesión exitoso',
            usuario, //devuelve los datos del usuario
            token //devuelve el token que el cliente enviará en el header de autorización
        });

    } catch (error) {
        console.error('Error en login:', error); //Registra el error en la consola del servidor

        return res.status(500).json({
            error: 'Error interno del servidor'
        }); 
    }
}

module.exports = {
    login
};
