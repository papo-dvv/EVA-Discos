// UUID fijo del usuario "sistema" (esUsuarioSistema=true), sembrado en
// prisma/seed.ts con el mismo valor que schema_eva.sql §7. Se usa para atribuir
// en scan_edit_log las correcciones automáticas que no hizo una persona
// (ej. corrección de tren según la hoja de origen durante la migración).
export const SISTEMA_USER_ID = '00000000-0000-0000-0000-000000000001';
