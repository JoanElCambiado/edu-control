-- AlterTable
ALTER TABLE "herramientas" ADD COLUMN     "categoria" TEXT NOT NULL DEFAULT 'General',
ADD COLUMN     "estado_fisico" TEXT NOT NULL DEFAULT 'bueno';
