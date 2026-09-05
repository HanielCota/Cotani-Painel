"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function MfaChallengeForm({ destination }: { destination:string }) {
  const router = useRouter();
  const [factorId,setFactorId]=useState(""); const [code,setCode]=useState(""); const [pending,setPending]=useState(false);
  useEffect(()=>{void createClient().auth.mfa.listFactors().then(({data,error})=>{const factor=data?.totp.find(item=>item.status==="verified");if(error||!factor){toast.error("Não foi possível localizar o autenticador.");return;}setFactorId(factor.id);});},[]);
  async function verify(){if(!factorId)return;setPending(true);const result=await createClient().auth.mfa.challengeAndVerify({factorId,code});setPending(false);if(result.error){toast.error("Código inválido ou expirado.");return;}router.replace(destination);router.refresh();}
  return <main className="flex min-h-svh items-center justify-center bg-background p-4"><div className="w-full max-w-md space-y-5 rounded-2xl border bg-card p-6 shadow-xl"><div><h1 className="text-xl font-semibold">Verificação em duas etapas</h1><p className="text-sm text-muted-foreground">Digite o código de 6 dígitos do seu aplicativo autenticador.</p></div><Input value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" autoComplete="one-time-code" aria-label="Código de autenticação" autoFocus/><Button type="button" className="w-full" disabled={pending||!factorId||code.length!==6} onClick={verify}>{pending?"Verificando...":"Confirmar e continuar"}</Button><Button type="button" variant="ghost" className="w-full" onClick={()=>void createClient().auth.signOut().then(()=>window.location.assign("/sign-in"))}>Sair</Button></div></main>;
}
