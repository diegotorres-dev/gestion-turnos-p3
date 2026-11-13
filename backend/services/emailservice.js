const nodemailer = require('nodemailer'); //Librería para enviar correos

let transporter; //Variable global que almacena un transportador SMTP
let cuentaPrueba; //Variable global que almacena una cuenta de prueba temporal de Ethereal (servicio falso para testear emails)

//Transporter es el objeto que tiene guardadas las instrucciones y credenciales (cómo, dónde, con qué cuenta) enviar los mails
async function obtenerTransporter() { //Obtener o crear el transportador de correos
    if (transporter) { // Si existe un transportador creado previamente, simplemente lo devuelve para no crear otro cada vez
        return transporter; 
    }

    cuentaPrueba = await nodemailer.createTestAccount(); //Crea una cuenta temporal de prueba de Ethereal

    transporter = nodemailer.createTransport({ //Configura la conexión SMTP utilizando los datos de la cuenta de prueba
        host: 'smtp.ethereal.email', //Servidor SMTP
        port: 587,
        secure: false, //Activa la seguridad una vez que viaja en el servidor, no antes porque sino da error (pero SÍ es seguro)
        auth: { //Credenciales de autenticación generadas por Ethereal
            user: cuentaPrueba.user, //Usuario de prueba que se genera automáticamente
            pass: cuentaPrueba.pass //Contraseña de prueba generada automáticamente
        }
    });

    return transporter; //Devuelve el transporter configurado y listo para usarse
}

async function enviarCorreo({ to, subject, text, html }) { //Destinatario, asunto, texto y formato HTML
    const conexion = await obtenerTransporter(); //Obtiene el transporter de la función anterior

    const info = await conexion.sendMail({ //Manda el correo usando el transporter ya configurado
        from: '"Gestión de Turnos Médicos" <pruebas@gestion-turnos.test>', //Remitente (quien envía el correo)
        to, //Destinatario
        subject, //Asunto
        text, //Versión en texto plano del correo
        html //Versión en formato HTML
    });

    const urlVistaPrevia = nodemailer.getTestMessageUrl(info); //Obtiene una URL de Ethereal para ver cómo quedó el correo enviado

    console.log('Correo enviado al servicio de pruebas.');
    console.log('Asunto:', subject); //Muestra el asunto
    console.log('Vista previa:', urlVistaPrevia); //Muestra un enlace para verlo

    return {
        messageId: info.messageId, //ID del mensaje generado por el servidor de correo
        previewUrl: urlVistaPrevia //URL de vista previa para ver el correo en Ethereal
    };
}

module.exports = { enviarCorreo };