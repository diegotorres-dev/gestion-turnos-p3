USE gestion_turnos;

CREATE TABLE historial_estado_turno (
    id_historial INT NOT NULL AUTO_INCREMENT,
    id_turno INT NOT NULL,
    estado_anterior VARCHAR(30) NOT NULL,
    estado_nuevo VARCHAR(30) NOT NULL,
    fecha_cambio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_usuario INT NULL,
    PRIMARY KEY (id_historial),
    CONSTRAINT fk_historial_turno FOREIGN KEY (id_turno) REFERENCES turno (id_turno),
    CONSTRAINT fk_historial_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
);

CREATE TABLE bloqueo_agenda (
    id_bloqueo INT NOT NULL AUTO_INCREMENT,
    matricula_medico INT NOT NULL,
    fecha_hora_desde DATETIME NOT NULL,
    fecha_hora_hasta DATETIME NOT NULL,
    motivo VARCHAR(255) NOT NULL,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_usuario INT NULL,
    PRIMARY KEY (id_bloqueo),
    CONSTRAINT fk_bloqueo_medico FOREIGN KEY (matricula_medico) REFERENCES medico (matricula_medico),
    CONSTRAINT fk_bloqueo_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
);

ALTER TABLE turno
    ADD COLUMN motivo_cancelacion VARCHAR(255) NULL,
    ADD COLUMN id_bloqueo INT NULL,
    ADD CONSTRAINT fk_turno_bloqueo FOREIGN KEY (id_bloqueo) REFERENCES bloqueo_agenda (id_bloqueo);
