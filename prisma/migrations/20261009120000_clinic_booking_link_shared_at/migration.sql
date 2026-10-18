-- Passo "Divulgar link" do checklist inicial, salvo por negócio (antes ficava só no navegador).
-- Coluna anulável: não reescreve a tabela nem afeta o código que ainda não a usa.
ALTER TABLE "Clinic" ADD COLUMN "bookingLinkSharedAt" TIMESTAMP(3);
