function iniciarBloqueos() {
    document.getElementById('datosUsuario').textContent = `Administrador: ${payload.email}`;

    document.getElementById('cerrarSesion').addEventListener('click', cerrarSesion);

    const avisoBloqueo = document.getElementById('avisoBloqueo');
    const formBloqueo = document.getElementById('formBloqueo');
    const bloqueoMatricula = document.getElementById('bloqueoMatricula');
    const bloqueoDesde = document.getElementById('bloqueoDesde');
    const bloqueoHasta = document.getElementById('bloqueoHasta');
    const bloqueoMotivo = document.getElementById('bloqueoMotivo');
    const errorBloqueo = document.getElementById('errorBloqueo');
    const verAfectados = document.getElementById('verAfectados');
    const vistaPreviaBloqueo = document.getElementById('vistaPreviaBloqueo');
    const tituloVistaPrevia = document.getElementById('tituloVistaPrevia');
    const tablaVistaPrevia = document.getElementById('tablaVistaPrevia');
    const cuerpoVistaPrevia = document.getElementById('cuerpoVistaPrevia');
    const botonesVistaPrevia = document.getElementById('botonesVistaPrevia');
    const volverVistaPrevia = document.getElementById('volverVistaPrevia');
    const confirmarBloqueo = document.getElementById('confirmarBloqueo');
    const cuerpoBloqueos = document.getElementById('cuerpoBloqueos');
    const estadoBloqueos = document.getElementById('estadoBloqueos');

    let consultaBloqueo = null;
    let temporizadorBloqueo = null;

    function formatearFechaHora(valor) {
        const [fecha, hora] = valor.split(/[T ]/);
        return `${formatearFecha(fecha)} ${hora.slice(0, 5)}`;
    }

    function mostrarAvisoBloqueo(texto, tipo) {
        avisoBloqueo.textContent = texto;
        avisoBloqueo.className = `aviso aviso-${tipo}`;
        avisoBloqueo.hidden = false;
        clearTimeout(temporizadorBloqueo);
        if (tipo === 'exito') {
            temporizadorBloqueo = setTimeout(() => { avisoBloqueo.hidden = true; }, 8000);
        }
    }

    function ocultarVistaPrevia() {
        consultaBloqueo = null;
        vistaPreviaBloqueo.hidden = true;
        cuerpoVistaPrevia.replaceChildren();
    }

    function pintarTurnosBloqueo(lista) {
        cuerpoVistaPrevia.replaceChildren();
        const fragmento = document.createDocumentFragment();
        lista.forEach((t) => {
            const fila = document.createElement('tr');
            fila.append(
                celda(t.id_turno),
                celda(formatearFecha(t.fecha_turno)),
                celda(t.hora_turno.slice(0, 5)),
                celda(t.nombre_paciente),
                celda(t.dni_paciente),
                celda(t.nombre_practica),
                celdaEstado(t.estado_turno)
            );
            fragmento.appendChild(fila);
        });
        cuerpoVistaPrevia.appendChild(fragmento);
        tablaVistaPrevia.hidden = lista.length === 0;
    }

    function nombreMedicoElegido() {
        const opcion = bloqueoMatricula.selectedOptions[0];
        return opcion ? opcion.textContent : '';
    }

    function mostrarVistaPrevia(consulta, lista) {
        const medico = nombreMedicoElegido();
        const periodo = `${formatearFechaHora(consulta.desde)} y ${formatearFechaHora(consulta.hasta)}`;
        tituloVistaPrevia.textContent = lista.length === 0
            ? `No hay turnos para cancelar del médico ${medico} entre ${periodo}. Igual se bloquea la agenda en ese período.`
            : `Se van a cancelar ${lista.length} turno(s) del médico ${medico} entre ${periodo}`;
        pintarTurnosBloqueo(lista);
        confirmarBloqueo.textContent = lista.length === 0
            ? 'Confirmar bloqueo'
            : `Confirmar bloqueo y cancelar ${lista.length} turno(s)`;
        botonesVistaPrevia.hidden = false;
        vistaPreviaBloqueo.hidden = false;
    }

    function mostrarResultadoBloqueo(resultado) {
        tituloVistaPrevia.textContent = resultado.total === 0
            ? `Bloqueo N.º ${resultado.id_bloqueo} registrado. No había turnos para cancelar.`
            : `Turnos cancelados por el bloqueo N.º ${resultado.id_bloqueo}`;
        pintarTurnosBloqueo(resultado.turnos_cancelados.map((t) => ({ ...t, estado_turno: 'Cancelado' })));
        botonesVistaPrevia.hidden = true;
        vistaPreviaBloqueo.hidden = false;
    }

    formBloqueo.addEventListener('input', ocultarVistaPrevia);

    formBloqueo.addEventListener('submit', async function (evento) {
        evento.preventDefault();
        avisoBloqueo.hidden = true;
        errorBloqueo.hidden = true;
        ocultarVistaPrevia();

        const consulta = {
            matricula_medico: bloqueoMatricula.value.trim(),
            desde: bloqueoDesde.value,
            hasta: bloqueoHasta.value,
            motivo: bloqueoMotivo.value.trim()
        };

        verAfectados.disabled = true;
        verAfectados.textContent = 'Consultando...';

        try {
            const resultado = await obtenerVistaPreviaBloqueo(token, consulta);
            consultaBloqueo = consulta;
            mostrarVistaPrevia(consulta, resultado.turnos);
        } catch (error) {
            if (error.estado === 401 || error.estado === 403) {
                cerrarSesion();
                return;
            }
            errorBloqueo.textContent = textoError(error);
            errorBloqueo.hidden = false;
        } finally {
            verAfectados.disabled = false;
            verAfectados.textContent = 'Ver turnos afectados';
        }
    });

    volverVistaPrevia.addEventListener('click', ocultarVistaPrevia);

    confirmarBloqueo.addEventListener('click', async function () {
        if (!consultaBloqueo) {
            return;
        }

        const textoOriginal = confirmarBloqueo.textContent;
        confirmarBloqueo.disabled = true;
        volverVistaPrevia.disabled = true;
        confirmarBloqueo.textContent = 'Bloqueando...';
        errorBloqueo.hidden = true;

        try {
            const resultado = await crearBloqueo(token, consultaBloqueo);
            formBloqueo.reset();
            consultaBloqueo = null;
            mostrarResultadoBloqueo(resultado);
            mostrarAvisoBloqueo(`Bloqueo N.º ${resultado.id_bloqueo} registrado. Se cancelaron ${resultado.total} turno(s).`, 'exito');
            cargarBloqueos();
        } catch (error) {
            if (error.estado === 401 || error.estado === 403) {
                cerrarSesion();
                return;
            }
            ocultarVistaPrevia();
            errorBloqueo.textContent = textoError(error);
            errorBloqueo.hidden = false;
        } finally {
            confirmarBloqueo.disabled = false;
            volverVistaPrevia.disabled = false;
            confirmarBloqueo.textContent = textoOriginal;
        }
    });

    async function cargarBloqueos() {
        try {
            const bloqueos = await obtenerBloqueos(token);
            cuerpoBloqueos.replaceChildren();

            if (bloqueos.length === 0) {
                estadoBloqueos.textContent = 'Todavía no se registraron bloqueos.';
                estadoBloqueos.hidden = false;
                return;
            }

            estadoBloqueos.hidden = true;

            const fragmento = document.createDocumentFragment();
            bloqueos.forEach((b) => {
                const fila = document.createElement('tr');
                fila.append(
                    celda(b.id_bloqueo),
                    celda(`${b.nombre_medico} (${b.matricula_medico})`),
                    celda(formatearFechaHora(b.fecha_hora_desde)),
                    celda(formatearFechaHora(b.fecha_hora_hasta)),
                    celda(b.motivo),
                    celda(b.turnos_cancelados),
                    celda(formatearFechaHora(b.fecha_creacion))
                );
                fragmento.appendChild(fila);
            });
            cuerpoBloqueos.appendChild(fragmento);
        } catch (error) {
            if (error.estado === 401 || error.estado === 403) {
                cerrarSesion();
                return;
            }
            cuerpoBloqueos.replaceChildren();
            estadoBloqueos.textContent = textoError(error);
            estadoBloqueos.hidden = false;
        }
    }

    async function cargarMedicosBloqueo() {
        try {
            const medicos = await obtenerMedicos(token);
            bloqueoMatricula.replaceChildren(new Option('Elegí un médico', ''));
            medicos.forEach((m) => bloqueoMatricula.add(new Option(textoMedico(m), m.matricula_medico)));
        } catch (error) {
            if (error.estado === 401 || error.estado === 403) {
                cerrarSesion();
                return;
            }
            bloqueoMatricula.replaceChildren(new Option('No se pudieron cargar', ''));
            mostrarAvisoBloqueo('No se pudieron cargar los médicos. Actualizá la página para volver a intentar.', 'error');
        }
    }

    cargarMedicosBloqueo();
    cargarBloqueos();
}

if (sesionValida) {
    iniciarBloqueos();
}
