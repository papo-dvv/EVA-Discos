-- Prisma no soporta CHECK constraints en el schema (ver schema.prisma, modelo Train)
-- Traducción fiel de chk_train_numero de schema_eva.sql.
ALTER TABLE "trains" ADD CONSTRAINT "chk_train_numero" CHECK (numero BETWEEN 1 AND 44);
