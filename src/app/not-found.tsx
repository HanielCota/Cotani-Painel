import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMascot } from "@/components/ui/empty";

export default function NotFound() {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto flex min-h-screen w-full max-w-3xl items-center p-6 outline-none">
      <Empty>
        <EmptyHeader>
          <EmptyMascot />
          <h1 className="font-heading text-xl font-semibold tracking-tight">Página não encontrada</h1>
          <EmptyDescription>O endereço acessado não existe ou não está mais disponível.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button nativeButton={false} render={<Link href="/dashboard" />}>Voltar ao painel</Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
