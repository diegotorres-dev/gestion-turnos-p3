function autorizarRol(...rolesPermitidos) { //Se pide como parámetro los roles permitidos
    return function (req, res, next) {

        if (!req.usuario) { //req.usuario lo carga verificarToken, entonces si falta el token, no pasó por la autenticación
            return res.status(401).json({ 
                error: 'Se requiere autenticación'
            }); 
        }

        const idRol = Number(req.usuario.id_rol); //Agarra el rol del token y lo convierte a número para comparar

        if (!rolesPermitidos.includes(idRol)) { //Si el rol no figura entre los permitidos lo corta
            return res.status(403).json({
                error: 'No tenés permisos para realizar esta acción'
            });
        }

        next(); //Si el usuario tiene permisos, pasa al siguiente middleware o controlador
    };
}

module.exports = { autorizarRol };