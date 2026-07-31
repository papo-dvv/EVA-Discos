-- CreateTable
CREATE TABLE "system_param_audit" (
    "id" UUID NOT NULL,
    "clave" VARCHAR(100) NOT NULL,
    "valor_anterior" VARCHAR(300),
    "valor_nuevo" VARCHAR(300) NOT NULL,
    "usuario_id" UUID NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_param_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_system_param_audit_clave" ON "system_param_audit"("clave");

-- AddForeignKey
ALTER TABLE "system_param_audit" ADD CONSTRAINT "system_param_audit_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
