"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { signOutCurrentSession } from "@/server/actions/auth";

export function MfaChallengeForm({ destination, recovery = false }: { destination:string; recovery?: boolean }) {
  const router = useRouter();
  const [factorId,setFactorId]=useState(""); const [code,setCode]=useState(""); const [pending,setPending]=useState(false);
  useEffect(()=>{void createClient().auth.mfa.listFactors().then(({data,error})=>{const factor=data?.totp.find(item=>item.status==="verified");if(error||!factor){toast.error("Não foi possível localizar o autenticador.");return;}setFactorId(factor.id);});},[]);
  async function verify(){if(!factorId)return;setPending(true);const result=await createClient().auth.mfa.challengeAndVerify({factorId,code});setPending(false);if(result.error){toast.error("Código inválido ou expirado.");return;}router.replace(destination);router.refresh();}
  return <main className="flex min-h-svh items-center justify-center bg-background p-4"><AuthCard className="space-y-5"><div><h1 className="text-xl font-semibold">{recovery ? "Confirme sua identidade" : "Verificação em duas etapas"}</h1><p className="text-sm text-muted-foreground">{recovery ? "Antes de escolher uma nova senha, digite o código de 6 dígitos do seu aplicativo autenticador." : "Digite o código de 6 dígitos do seu aplicativo autenticador."}</p></div><Input value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" autoComplete="one-time-code" aria-label="Código de autenticação" autoFocus/><Button type="button" className="w-full" disabled={pending||!factorId||code.length!==6} onClick={verify}>{pending?"Verificando...":"Confirmar e continuar"}</Button><form action={signOutCurrentSession}><Button type="submit" variant="ghost" className="w-full">{recovery ? "Voltar ao login" : "Sair"}</Button></form></AuthCard></main>;
}
