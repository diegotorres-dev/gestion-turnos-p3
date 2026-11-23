function iniciarCargaMasiva() {
    document.getElementById('datosUsuario').textContent = `Administrador: ${payload.email}`;

    document.getElementById('cerrarSesion').addEventListener('click', cerrarSesion);

    const MAX_FILAS_CARGA = 20;

    const CAMPOS_CARGA = [
        { nombre: 'fecha_turno', etiqueta: 'Fecha', tipo: 'date' },
        { nombre: 'hora_turno', etiqueta: 'Hora', tipo: 'time' },
        { nombre: 'dni_paciente', etiqueta: 'DNI del paciente', tipo: 'text', patron: '[0-9]{7,8}', maximo: 8, ejemplo: '30100101' },
        { nombre: 'id_practica', etiqueta: 'Práctica', tipo: 'select' },
        { nombre: 'medico_confirmacion', etiqueta: 'Médico', tipo: 'select' }
    ];

    const MEDIOS_CARGA = ['Web', 'Teléfono', 'WhatsApp'];

    const avisoCarga = document.getElementById('avisoCarga');
    const formCarga = document.getElementById('formCarga');
    const cuerpoCarga = document.getElementById('cuerpoCarga');
    const agregarFila = document.getElementById('agregarFila');
    const limpiarCarga = document.getElementById('limpiarCarga');
    const enviarCarga = document.getElementById('enviarCarga');
    const resultadoCarga = document.getElementById('resultadoCarga');
    const tituloResultadoCarga = document.getElementById('tituloResultadoCarga');
    const cuerpoResultadoCarga = document.getElementById('cuerpoResultadoCarga');

    let temporizadorCarga = null;
    const LISTAS_CARGA = {
        id_practica: {
            datos: null,
            error: false,
            inicial: 'Elegí una práctica',
            cargando: 'Cargando prácticas...',
            mensaje: 'No se pudieron cargar las prácticas. Actualizá la página para volver a intentar.',
            pedir: obtenerPracticas,
            texto: (p) => p.nombre_practica,
            valor: (p) => p.id_practica
        },
        medico_confirmacion: {
            datos: null,
            error: false,
            inicial: 'Elegí un médico',
            cargando: 'Cargando médicos...',
            mensaje: 'No se pudieron cargar los médicos. Actualizá la página para volver a intentar.',
            pedir: obtenerMedicos,
            texto: textoMedico,
            valor: (m) => m.matricula_medico
        }
    };

    document.getElementById('maximoFilas').textContent = MAX_FILAS_CARGA;

    function mostrarAvisoCarga(texto, tipo) {
        avisoCarga.textContent = texto;
        avisoCarga.className = `aviso aviso-${tipo}`;
        avisoCarga.hidden = false;
        clearTimeout(temporizadorCarga);
        if (tipo === 'exito') {
            temporizadorCarga = setTimeout(() => { avisoCarga.hidden = true; }, 8000);
        }
    }

    function llenarLista(selector) {
        const lista = LISTAS_CARGA[selector.dataset.campo];
        const valorActual = selector.value;
        selector.replaceChildren();
        let textoInicial = lista.cargando;
        if (lista.datos) {
            textoInicial = lista.inicial;
        } else if (lista.error) {
            textoInicial = 'No se pudieron cargar';
        }
        selector.add(new Option(textoInicial, ''));
        (lista.datos || []).forEach((d) => selector.add(new Option(lista.texto(d), lista.valor(d))));
        selector.value = valorActual;
    }

    async function cargarLista(campo) {
        const lista = LISTAS_CARGA[campo];
        try {
            lista.datos = await lista.pedir(token);
        } catch (error) {
            if (error.estado === 401 || error.estado === 403) {
                cerrarSesion();
                return;
            }
            lista.error = true;
            mostrarAvisoCarga(lista.mensaje, 'error');
        }
        cuerpoCarga.querySelectorAll(`select[data-campo="${campo}"]`).forEach(llenarLista);
    }

    function crearInputCarga(campo) {
        if (campo.tipo === 'select') {
            const selector = document.createElement('select');
            selector.required = true;
            selector.dataset.campo = campo.nombre;
            llenarLista(selector);
            return selector;
        }
        const input = document.createElement('input');
        input.type = campo.tipo;
        input.required = true;
        input.dataset.campo = campo.nombre;
        if (campo.patron) {
            input.pattern = campo.patron;
            input.inputMode = 'numeric';
        }
        if (campo.maximo) {
            input.maxLength = campo.maximo;
        }
        if (campo.ejemplo) {
            input.placeholder = `Ej: ${campo.ejemplo}`;
        }
        if (campo.tipo === 'number') {
            input.min = '1';
        }
        return input;
    }

    function actualizarFilasCarga() {
        const filas = [...cuerpoCarga.rows];
        filas.forEach((fila, indice) => {
            const numero = indice + 1;
            fila.querySelector('.numero-fila').textContent = numero;
            fila.querySelectorAll('[data-campo]').forEach((elemento) => {
                const campo = CAMPOS_CARGA.find((c) => c.nombre === elemento.dataset.campo);
                elemento.setAttribute('aria-label', `${campo ? campo.etiqueta : 'Medio'} de la fila ${numero}`);
            });
            const quitar = fila.querySelector('button');
            quitar.setAttribute('aria-label', `Quitar la fila ${numero}`);
            quitar.disabled = filas.length === 1;
        });
        agregarFila.disabled = filas.length >= MAX_FILAS_CARGA;
    }

    function crearFilaCarga() {
        const fila = document.createElement('tr');

        const numero = document.createElement('td');
        numero.className = 'numero-fila';
        fila.appendChild(numero);

        CAMPOS_CARGA.forEach((campo) => {
            const td = document.createElement('td');
            td.appendChild(crearInputCarga(campo));
            fila.appendChild(td);
        });

        const tdMedio = document.createElement('td');
        const selectMedio = document.createElement('select');
        selectMedio.dataset.campo = 'medio_solicitado';
        MEDIOS_CARGA.forEach((medio) => selectMedio.add(new Option(medio, medio)));
        tdMedio.appendChild(selectMedio);
        fila.appendChild(tdMedio);

        const tdQuitar = document.createElement('td');
        const quitar = document.createElement('button');
        quitar.type = 'button';
        quitar.textContent = 'Quitar';
        quitar.className = 'boton-tabla boton-peligro-suave';
        quitar.addEventListener('click', function () {
            fila.remove();
            actualizarFilasCarga();
        });
        tdQuitar.appendChild(quitar);
        fila.appendChild(tdQuitar);

        cuerpoCarga.appendChild(fila);
        actualizarFilasCarga();
    }

    function reiniciarCarga() {
        cuerpoCarga.replaceChildren();
        crearFilaCarga();
        resultadoCarga.hidden = true;
        cuerpoResultadoCarga.replaceChildren();
    }

    function leerFilasCarga() {
        return [...cuerpoCarga.rows].map((fila) => {
            const datos = {};
            fila.querySelectorAll('[data-campo]').forEach((elemento) => {
                datos[elemento.dataset.campo] = elemento.value.trim();
            });
            return datos;
        });
    }

    function limpiarMarcasCarga() {
        [...cuerpoCarga.rows].forEach((fila) => fila.classList.remove('fila-con-error'));
    }

    function marcarFilasConError(errores) {
        errores.forEach((e) => {
            const fila = cuerpoCarga.rows[e.fila - 1];
            if (fila) {
                fila.classList.add('fila-con-error');
            }
        });
    }

    function pintarResultadoCarga(titulo, resultados) {
        tituloResultadoCarga.textContent = titulo;
        cuerpoResultadoCarga.replaceChildren();
        resultados.forEach((r) => {
            const fila = document.createElement('tr');
            fila.append(celda(r.fila), celda(r.texto));
            cuerpoResultadoCarga.appendChild(fila);
        });
        resultadoCarga.hidden = false;
    }

    agregarFila.addEventListener('click', function () {
        crearFilaCarga();
        const ultima = cuerpoCarga.rows[cuerpoCarga.rows.length - 1];
        ultima.querySelector('input').focus();
    });

    limpiarCarga.addEventListener('click', function () {
        avisoCarga.hidden = true;
        reiniciarCarga();
    });

    cuerpoCarga.addEventListener('input', function (evento) {
        const fila = evento.target.closest('tr');
        if (fila) {
            fila.classList.remove('fila-con-error');
        }
    });

    formCarga.addEventListener('submit', async function (evento) {
        evento.preventDefault();
        avisoCarga.hidden = true;
        limpiarMarcasCarga();
        resultadoCarga.hidden = true;

        enviarCarga.disabled = true;
        enviarCarga.textContent = 'Cargando...';

        try {
            const respuesta = await cargarTurnosMasivo(token, leerFilasCarga());
            reiniciarCarga();
            pintarResultadoCarga(
                `Se cargaron ${respuesta.resumen.total} turno(s) correctamente`,
                respuesta.turnos_creados.map((t) => ({ fila: t.fila, texto: `Turno N.º ${t.id_turno} creado y confirmado` }))
            );
            mostrarAvisoCarga(respuesta.mensaje, 'exito');
        } catch (error) {
            if (error.estado === 401 || error.estado === 403) {
                cerrarSesion();
                return;
            }

            const detalle = error.detalle;
            if (detalle && detalle.errores) {
                marcarFilasConError(detalle.errores);
                pintarResultadoCarga(
                    `No se cargó ningún turno: ${detalle.resumen.con_error} de ${detalle.resumen.total} fila(s) con error y ${detalle.resumen.correctas} correcta(s)`,
                    detalle.errores.map((e) => ({ fila: e.fila, texto: e.error }))
                );
                mostrarAvisoCarga('No se cargó ningún turno. Corregí las filas marcadas en rojo y volvé a intentar.', 'error');
            } else {
                mostrarAvisoCarga(textoError(error), 'error');
            }
        } finally {
            enviarCarga.disabled = false;
            enviarCarga.textContent = 'Cargar turnos';
        }
    });

    reiniciarCarga();
    Object.keys(LISTAS_CARGA).forEach(cargarLista);
}

if (sesionValida) {
    iniciarCargaMasiva();
}
