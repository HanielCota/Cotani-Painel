"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function AccountSecuritySettings() {
  const [qr,setQr]=useState(""); const [factorId,setFactorId]=useState(""); const [verifiedFactorId,setVerifiedFactorId]=useState(""); const [code,setCode]=useState(""); const [password,setPassword]=useState(""); const [pending,setPending]=useState(false);
  async function refreshFactors(){const {data}=await createClient().auth.mfa.listFactors();setVerifiedFactorId(data?.totp.find(item=>item.status==="verified")?.id??"");}
  useEffect(()=>{queueMicrotask(()=>void refreshFactors())},[]);
  async function others(){setPending(true);const{error}=await createClient().auth.signOut({scope:"others"});setPending(false);if(error)toast.error("Não foi possível encerrar as outras sessões.");else toast.success("Outras sessões encerradas.")}
  async function enroll(){setPending(true);const existing=await createClient().auth.mfa.listFactors();for(const factor of existing.data?.totp.filter(item=>item.status!=="verified")??[])await createClient().auth.mfa.unenroll({factorId:factor.id});const{data,error}=await createClient().auth.mfa.enroll({factorType:"totp",friendlyName:"Cotani"});setPending(false);if(error)return toast.error(error.message);setQr(data.totp.qr_code);setFactorId(data.id)}
  async function verify(){setPending(true);const result=await createClient().auth.mfa.challengeAndVerify({factorId,code});setPending(false);if(result.error)toast.error("Código inválido.");else{toast.success("Autenticação em dois fatores ativada.");setQr("");setFactorId("");setCode("");void refreshFactors();}}
  async function disable(){setPending(true);const{error}=await createClient().auth.mfa.unenroll({factorId:verifiedFactorId});setPending(false);if(error)toast.error("Confirme uma sessão com nível AAL2 antes de desativar.");else{toast.success("Autenticação em dois fatores desativada.");setVerifiedFactorId("");}}
  async function changePassword(){if(password.length<8){toast.error("Use pelo menos 8 caracteres.");return;}setPending(true);const{error}=await createClient().auth.updateUser({password});setPending(false);if(error)toast.error(error.message);else{toast.success("Senha atualizada.");setPassword("");}}
  return <div className="space-y-5"><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={others} disabled={pending}>Encerrar outras sessões</Button>{verifiedFactorId?<Button type="button" variant="destructive" onClick={disable} disabled={pending}>Desativar autenticação em dois fatores</Button>:<Button type="button" variant="outline" onClick={enroll} disabled={pending}>Ativar autenticação em dois fatores</Button>}</div>{qr?<div className="space-y-3 rounded-xl border p-4"><p className="text-sm">Leia o QR Code no seu aplicativo autenticador e informe o código.</p><img src={qr} alt="QR Code para configurar autenticação em dois fatores" className="size-44 rounded bg-white p-2"/><div className="flex gap-2"><Input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" autoComplete="one-time-code" placeholder="Código de 6 dígitos"/><Button type="button" onClick={verify} disabled={pending||code.length!==6}>Confirmar</Button></div></div>:null}<div className="max-w-md space-y-2"><Label htmlFor="new-password">Nova senha</Label><div className="flex gap-2"><Input id="new-password" type="password" value={password} onChange={event=>setPassword(event.target.value)} minLength={8} autoComplete="new-password" placeholder="Ao menos 8 caracteres"/><Button type="button" variant="outline" onClick={changePassword} disabled={pending||password.length<8}>Atualizar senha</Button></div></div></div>;
}
