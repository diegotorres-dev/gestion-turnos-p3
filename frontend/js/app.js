const formulario = document.getElementById('formLogin'); //Formulario de inicio de sesión
const mensaje = document.getElementById('mensaje'); //Elemento donde se muestran los mensajes de error o estado
const boton = formulario.querySelector('button'); //Botón de envío dentro del formulario

formulario.addEventListener('submit', async function (evento) { //Escucha el evento 'submit' (envío) del formulario
    evento.preventDefault(); //Evita que recargue la página entera

    const email = document.getElementById('email').value.trim(); //Obtiene el valor del input del email
    const password = document.getElementById('password').value; // Obtiene el valor del input de la contraseña

    mensaje.textContent = ''; //Limpia cualquier mensaje que estuviera en pantalla
    boton.disabled = true; //Deshabilita el botón para hacer muchos clicks mientras procesa
    boton.textContent = 'Ingresando...'; //Cambia el texto del botón a ingresando

    try {
        const datos = await iniciarSesion(email, password); //Llama a la función de iniciar sesión con las credenciales

        const rol = Number(datos.usuario.id_rol);

        if (rol === 2 || rol === 3) {
            sessionStorage.setItem('token', datos.token);
            window.location.href = 'pages/mis-turnos.html';
            return;
        }

        if (Number(datos.usuario.id_rol) !== 1) { //Valida si el rol del usuario es distinto del 1 (administrador)
            throw new Error('Este panel es solo para administradores'); //Tira error si no es admin
        }

        sessionStorage.setItem('token', datos.token); //Guarda el token JWT en la sesión del navegador
        window.location.href = 'pages/dashboard.html'; //Redirige al panel del admin

    } catch (error) {
        mensaje.textContent = error.message; //Si ocurre un error muestra el msj
        if (error.message === 'Failed to fetch') {
            mensaje.textContent = 'No se pudo conectar con el servidor. Revisá que esté encendido e intentá de nuevo.';
        }
        mensaje.style.color = 'red'; //Pinta el msj de color rojo

    } finally {
        boton.disabled = false; //Vuelve a habilitar el botón para que se pueda volver a intentar
        boton.textContent = 'Iniciar sesión'; //Cambia el texto otra vez a iniciar sesion
    }
}); 