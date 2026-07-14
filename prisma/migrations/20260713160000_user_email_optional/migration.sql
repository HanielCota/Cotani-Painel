-- AlterTable
-- O Clerk não garante endereço de e-mail para todo usuário (cadastro por telefone,
-- identifier sem formato de e-mail), então a coluna passa a ser opcional.
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
