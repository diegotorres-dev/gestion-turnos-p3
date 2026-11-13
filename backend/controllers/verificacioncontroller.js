const db = require('../config/database'); //Pool de conexiones a la BD
const { buscarTokenValido } = require('../services/tokenservice'); //Importa la función para buscar y validar los tokens

async function verificarEmail(req, res) { //Función para manejar la verificación del correo
    try {
        const { token } = req.query; //Extrae el token enviado por parámetro en la URL

        if (
            typeof token !== 'string' ||
            !/^[a-f0-9]{64}$/i.test(token) //Valida que el token sea un texto y que cumpla con el formato hexadecimal
        ) { 
            return res.status(400).json({ //Si el formato no es válido, responde con un 400
                error: 'El enlace de verificación no es válido'
            });
        }

        const tokenEncontrado = await buscarTokenValido( //Llama al servicio para buscar el token en la BD
            token,
            'VERIFICACION_EMAIL' //El tipo de token que espera
        );

        if (!tokenEncontrado) { //Si el servicio no encontró un token válido (ya expiró, no existe o fue usado) tira un 400
            return res.status(400).json({
                error: 'El enlace venció, ya fue utilizado o no es válido'
            });
        }

        const conexion = await db.getConnection(); //Obtiene una conexión exclusiva del pool para hacer una transacción

        try {
            await conexion.beginTransaction(); //Inicia la transacción

            const [tokens] = await conexion.execute( //Consulta por seguridad el token bloqueando la fila para evitar condiciones de carrera
                `SELECT id_token, id_usuario
                 FROM token_cuenta
                 WHERE id_token = ?
                   AND usado = 0
                   AND tipo = 'VERIFICACION_EMAIL'
                   AND fecha_expiracion > NOW()
                 FOR UPDATE`, //"FOR UPDATE" bloquea la fila hasta que termine la transacción
                [tokenEncontrado.id_token]
            );

            if (tokens.length === 0) { //Si la fila ya no está disponible o fue modificada por otra petición a la vez (condición de carrera)
                await conexion.rollback();

                return res.status(400).json({
                    error: 'El enlace venció o ya fue utilizado'
                });
            }

            await conexion.execute( //Actualiza la tabla usuario marcando el correo como verificado
                `UPDATE usuario
                 SET email_verificado = 1
                 WHERE id_usuario = ?`,
                [tokens[0].id_usuario] //Pasa como parámetro el ID del usuario que hace la verificación
            );

            const [resultado] = await conexion.execute( //Actualiza el estado del token marcándolo como usado (usado = 1)
                `UPDATE token_cuenta
                 SET usado = 1
                 WHERE id_token = ? AND usado = 0`,
                [tokens[0].id_token]
            );

            if (resultado.affectedRows !== 1) { //Verifica que se haya actualizado exactamente una sola fila, sino hace rollback
                await conexion.rollback();

                return res.status(400).json({
                    error: 'El enlace ya fue utilizado'
                });
            }

            await conexion.commit(); //Confirma todos los cambios en la BD

            return res.status(200).json({
                mensaje: 'Correo verificado correctamente. Ya podés iniciar sesión.'
            });

        } catch (error) { 
            await conexion.rollback(); //Si ocurre un error en la BD hace un rollback
            throw error; //Relanza el error para que sea capturado por el catch 
        } finally {
            conexion.release(); //Libera la conexión
        }

    } catch (error) { //Maneja errores generales o de conexión
        console.error('Error al verificar correo:', error);
        return res.status(500).json({
            error: 'No se pudo verificar el correo'
        });
    } 
}

module.exports = {
    verificarEmail
};