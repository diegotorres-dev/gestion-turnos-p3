const crypto = require('crypto'); //Librería para generar bytes aleatorios y hashes
const db = require('../config/database'); //Importa el pool de conexiones a la base de datos MySQL

async function crearTokenCuenta(idUsuario, tipo, minutosValidez = 30) { // Función asíncrona para crear y registrar un token de cuenta
    const tiposPermitidos = [ //Array con los tipos de tokens permitidos
        'VERIFICACION_EMAIL',
        'RECUPERACION_PASSWORD'
    ];

    if (!tiposPermitidos.includes(tipo)) { //Valida si el tipo de token recibido no está en la lista permitida
        throw new Error('Tipo de token no válido');
    }

    const token = crypto.randomBytes(32).toString('hex'); //Genera un token aleatorio en formato hexadecimal

    const tokenHash = crypto //Método para hashear el token
        .createHash('sha256') //Utiliza un algoritmo de encriptación 
        .update(token) //Procesa el token original
        .digest('hex'); //Obtiene el token final hasheado en hexadecimal

    const expiracion = new Date( //Guarda la fecha y la hora en la que va a expirar el token
        Date.now() + minutosValidez * 60 * 1000 //Toma la fecha de ahora + 30 min (conversión), se usa milisegundos para sumarlo
    );

    await db.execute( //Consulta para limpiar los tokens anteriores activos
        `UPDATE token_cuenta
         SET usado = 1
         WHERE id_usuario = ?
           AND tipo = ?
           AND usado = 0`, //Marca como usados (1) todos los tokens previos vigentes (0)
        [idUsuario, tipo]
    );

    await db.execute( //Guarda el token en la BD con toda la info
        `INSERT INTO token_cuenta
            (id_usuario, token_hash, tipo, fecha_expiracion, usado)
         VALUES (?, ?, ?, ?, 0)`, 
        [idUsuario, tokenHash, tipo, expiracion]
    );

    return token;
}

async function buscarTokenValido(token, tipo) { //Busca y valida el token
    const tokenHash = crypto //Inicia el hasheo del token recibido para buscarlo en la BD
        .createHash('sha256') //Usa el mismo algoritmo
        .update(token) //Procesa el token original
        .digest('hex'); //Obtiene el token final hasheado en hexadecimal

    const [filas] = await db.execute( //Buscar el token en la tabla
        `SELECT id_token, id_usuario
         FROM token_cuenta
         WHERE token_hash = ?
           AND tipo = ?
           AND usado = 0
           AND fecha_expiracion > NOW()
         LIMIT 1`, // Busca la coincidencia exacta (mismo hash, tipo, estado = no usado y que no haya expirado)
        [tokenHash, tipo] 
    );

    return filas.length > 0 ? filas[0] : null; //Retorna la fila encontrada o null si no existe o expiró
}

async function marcarTokenUsado(idToken) { //Marca un token como utilizado
    const [resultado] = await db.execute(
        `UPDATE token_cuenta
         SET usado = 1
         WHERE id_token = ?
           AND usado = 0`, //Cambia el estado a usado (1) si todavía estaba activo (0)
        [idToken]
    );

    return resultado.affectedRows === 1; //Devuelve true si se actualizó exactamente una fila o false si no se actualizó
}

module.exports = {
    crearTokenCuenta,
    buscarTokenValido,
    marcarTokenUsado
};