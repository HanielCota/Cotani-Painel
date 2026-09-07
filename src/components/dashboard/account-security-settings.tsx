"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { KeyRoundIcon, LogOutIcon, MailIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient, createPasswordVerificationClient } from "@/lib/supabase/client";

export function AccountSecuritySettings() {
  const [qr,setQr]=useState(""); const [factorId,setFactorId]=useState(""); const [verifiedFactorId,setVerifiedFactorId]=useState(""); const [code,setCode]=useState(""); const [currentPassword,setCurrentPassword]=useState(""); const [password,setPassword]=useState(""); const [passwordConfirmation,setPasswordConfirmation]=useState(""); const [pending,setPending]=useState(false);
  async function refreshFactors(){const {data}=await createClient().auth.mfa.listFactors();setVerifiedFactorId(data?.totp.find(item=>item.status==="verified")?.id??"");}
  useEffect(()=>{queueMicrotask(()=>void refreshFactors())},[]);
  async function others(){setPending(true);const{error}=await createClient().auth.signOut({scope:"others"});setPending(false);if(error)toast.error("Não foi possível encerrar as outras sessões.");else toast.success("Outras sessões encerradas.")}
  async function enroll(){setPending(true);const existing=await createClient().auth.mfa.listFactors();for(const factor of existing.data?.totp.filter(item=>item.status!=="verified")??[])await createClient().auth.mfa.unenroll({factorId:factor.id});const{data,error}=await createClient().auth.mfa.enroll({factorType:"totp",friendlyName:"Cotani"});setPending(false);if(error)return toast.error(error.message);setQr(data.totp.qr_code);setFactorId(data.id)}
  async function verify(){setPending(true);const result=await createClient().auth.mfa.challengeAndVerify({factorId,code});setPending(false);if(result.error)toast.error("Código inválido.");else{toast.success("Autenticação em dois fatores ativada.");setQr("");setFactorId("");setCode("");void refreshFactors();}}
  async function disable(){setPending(true);const{error}=await createClient().auth.mfa.unenroll({factorId:verifiedFactorId});setPending(false);if(error)toast.error("Confirme uma sessão com nível AAL2 antes de desativar.");else{toast.success("Autenticação em dois fatores desativada.");setVerifiedFactorId("");}}
  async function changePassword(){
    if(!currentPassword){toast.error("Informe sua senha atual.");return;}
    if(password.length<8){toast.error("Use pelo menos 8 caracteres.");return;}
    if(password!==passwordConfirmation){toast.error("A confirmação da nova senha não confere.");return;}
    if(password===currentPassword){toast.error("A nova senha deve ser diferente da senha atual.");return;}

    setPending(true);
    const client=createClient();
    const verificationClient=createPasswordVerificationClient();

    try {
      const {data:{user},error:userError}=await client.auth.getUser();
      if(userError||!user?.email){toast.error("Não foi possível confirmar sua identidade.");return;}

      const {error:verificationError}=await verificationClient.auth.signInWithPassword({email:user.email,password:currentPassword});
      if(verificationError){toast.error("A senha atual está incorreta.");return;}

      const{error}=await client.auth.updateUser({password,current_password:currentPassword});
      if(error){toast.error(error.code==="weak_password"?"Escolha uma senha mais forte.":error.code==="same_password"?"A nova senha deve ser diferente da senha atual.":"Não foi possível atualizar a senha.");return;}

      toast.success("Senha atualizada com segurança.");
      setCurrentPassword("");setPassword("");setPasswordConfirmation("");
    } finally {
      await verificationClient.auth.signOut({scope:"local"});
      setPending(false);
    }
  }
  return (
    <div className="space-y-6">
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" nativeButton={false} variant="outline" className="h-auto min-h-10 w-full justify-start whitespace-normal py-2 text-left leading-5" render={<Link href="/forgot-password" />}>
          <MailIcon />Recuperar por e-mail
        </Button>
        <Button type="button" variant="outline" className="h-auto min-h-10 w-full justify-start whitespace-normal py-2 text-left leading-5" onClick={others} disabled={pending}>
          <LogOutIcon />Encerrar outras sessões
        </Button>
        {verifiedFactorId ? (
          <Button type="button" variant="destructive" className="h-auto min-h-10 w-full justify-start whitespace-normal py-2 text-left leading-5" onClick={disable} disabled={pending}>
            <ShieldCheckIcon />Desativar autenticação em dois fatores
          </Button>
        ) : (
          <Button type="button" variant="outline" className="h-auto min-h-10 w-full justify-start whitespace-normal py-2 text-left leading-5" onClick={enroll} disabled={pending}>
            <ShieldCheckIcon />Ativar autenticação em dois fatores
          </Button>
        )}
      </div>

      {qr ? (
        <div className="grid gap-4 rounded-xl border border-primary/25 bg-primary/5 p-4 sm:grid-cols-[auto_1fr] sm:items-center">
          <Image src={qr} alt="QR Code para configurar autenticação em dois fatores" width={176} height={176} unoptimized className="size-40 rounded-lg bg-white p-2" />
          <div className="space-y-3">
            <p className="text-sm leading-5">Leia o QR Code no aplicativo autenticador e informe o código de seis dígitos.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="Código de 6 dígitos" aria-label="Código de autenticação" />
              <Button type="button" onClick={verify} disabled={pending || code.length !== 6}>Confirmar</Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="border-t border-border/70 pt-5">
        <div className="mb-3 flex items-center gap-2">
          <KeyRoundIcon className="size-4 text-primary" />
          <div>
            <Label htmlFor="new-password">Alterar senha</Label>
            <p className="text-xs text-muted-foreground">Confirme sua senha atual antes de definir uma nova.</p>
          </div>
        </div>
        <div className="grid max-w-xl gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Senha atual</Label>
            <Input id="current-password" type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} autoComplete="current-password" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Nova senha</Label>
            <Input id="new-password" type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={8} autoComplete="new-password" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirmar nova senha</Label>
            <Input id="confirm-password" type="password" value={passwordConfirmation} onChange={event => setPasswordConfirmation(event.target.value)} minLength={8} autoComplete="new-password" />
          </div>
          <div className="flex items-end">
            <Button type="button" variant="outline" onClick={changePassword} disabled={pending} className="w-full">{pending?"Confirmando...":"Atualizar senha"}</Button>
          </div>
        </div>
        <p className="mt-3 max-w-xl text-xs text-muted-foreground">Entrou somente pelo Google e não possui uma senha atual? Use “Recuperar por e-mail” para criar uma senha com confirmação pelo endereço cadastrado.</p>
      </div>
    </div>
  );
}
