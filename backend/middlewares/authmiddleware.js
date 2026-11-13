const jwt = require('jsonwebtoken'); //Importa jsonwebtoken para verificar la firma y la vigencia

function verificarToken(req, res, next) {
    console.log('Middleware ejecutado:', req.method, req.originalUrl); //Registra en consola el método y la URL que pasan por el middleware

    const authorization = req.headers.authorization; //lee el header authorization de la petición

    if (!authorization || !authorization.startsWith('Bearer ')) { // Si no hay header o no tiene el formato "Bearer <token>"
        return res.status(401).json({ 
            error: 'Se requiere un token de autenticación'
        });
    }

    const token = authorization.split(' ')[1]; //Separa el header del token y se queda solo con la parte del token

    try {
        const datosToken = jwt.verify( //Verifica la firma y la expiración del token, le pasa el token y la firma
            token,
            process.env.JWT_SECRET
        );

        req.usuario = datosToken; //Guarda los datos del usuario del token para que los usen los siguientes controladores
        next(); //Si el token es válido continúa hacia el siguiente middleware o controlador

    } catch (error) { //Se ejecuta si el token fue modificado o si venció
        return res.status(401).json({
            error: 'Token inválido o vencido'
        });
    }
}

module.exports = { verificarToken };