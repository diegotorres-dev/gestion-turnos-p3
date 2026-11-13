const db = require('../config/database'); //Importa el pool de conexiones a MySQL
const bcrypt = require('bcryptjs'); //Importa bcryptjs para comparar contraseñas contra su hash

async function verificarCredenciales(email, password) { //Devuelve el usuario si las credenciales son correctas o null
    const [usuarios] = await db.execute( //Consulta la base de datos, busca el usuario por su email
        `SELECT id_usuario, email, password_hash, id_rol, activo, email_verificado, dni_paciente, matricula_medico
         FROM usuario
         WHERE email = ?`,
        [email]
    );

    if (usuarios.length === 0 || usuarios[0].activo !== 1) { // Si el usuario no existe o está dado de baja
        return null; //Devuelvo null ya que las credenciales no son válidas
    }

    const usuario = usuarios[0]; //Agarra el primer resultado, o sea el único usuario

    const passwordValida = await bcrypt.compare( //Compara el texto ingresado con el hash, devuelve true o false
        password,
        usuario.password_hash
    );

    if (!passwordValida) {
        return null; //Si la contraseña no coincide, devuelvo null
    }

    if (Number(usuario.email_verificado) !== 1) { //Valido si el email está verificado
        return { error: 'EMAIL_NO_VERIFICADO' }; 
    }

    return { //Devuelve solamente los datos que se necesitan (no la contraseña)
        id_usuario: usuario.id_usuario,
        email: usuario.email,
        id_rol: usuario.id_rol,
        dni_paciente: usuario.dni_paciente,
        matricula_medico: usuario.matricula_medico
    }; 
} 

module.exports = {
    verificarCredenciales 
};
