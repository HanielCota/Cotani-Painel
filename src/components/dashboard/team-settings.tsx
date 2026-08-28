"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { inviteClinicMember, removeClinicMember, revokeClinicInvitation, updateClinicMemberRole } from "@/server/actions/clinics";

interface TeamMember { id: string; name: string; email: string | null; role: "ADMIN" | "RECEPTIONIST" | "PROVIDER"; isCurrent: boolean; professionalId: string | null }
interface PendingInvitation { id: string; email: string; role: "ADMIN" | "RECEPTIONIST" | "PROVIDER"; expiresAt: string; professionalId: string | null }
interface ProfessionalOption { id: string; name: string; available: boolean }
const roleLabels = { ADMIN: "Administrador", RECEPTIONIST: "Recepcionista", PROVIDER: "Profissional" };

export function TeamSettings({ members, invitations, professionals }: { members: TeamMember[]; invitations: PendingInvitation[]; professionals: ProfessionalOption[] }) {
  const [result, inviteAction, pending] = useActionState(inviteClinicMember, { status: "success" as const, message: "" });
  return <div className="space-y-6">
    <form action={inviteAction} className="grid gap-4 rounded-xl border bg-muted/20 p-4 lg:grid-cols-[1fr_180px_220px_auto] lg:items-end">
      <div className="space-y-1.5"><Label htmlFor="invite-email">E-mail</Label><Input id="invite-email" name="email" type="email" required placeholder="pessoa@exemplo.com" /></div>
      <div className="space-y-1.5"><Label htmlFor="invite-role">Papel</Label><NativeSelect id="invite-role" name="role" defaultValue="PROVIDER"><NativeSelectOption value="PROVIDER">Profissional</NativeSelectOption><NativeSelectOption value="RECEPTIONIST">Recepcionista</NativeSelectOption><NativeSelectOption value="ADMIN">Administrador</NativeSelectOption></NativeSelect></div>
      <div className="space-y-1.5"><Label htmlFor="invite-professional">Profissional vinculado</Label><NativeSelect id="invite-professional" name="professionalId" defaultValue=""><NativeSelectOption value="">Selecione para acesso profissional</NativeSelectOption>{professionals.filter((professional) => professional.available).map((professional) => <NativeSelectOption key={professional.id} value={professional.id}>{professional.name}</NativeSelectOption>)}</NativeSelect></div>
      <Button type="submit" disabled={pending}>{pending ? "Enviando..." : "Convidar"}</Button>
      {result.message ? <Alert variant={result.status === "error" ? "destructive" : "default"} className="lg:col-span-4"><AlertDescription>{result.message}</AlertDescription></Alert> : null}
    </form>
    <div className="divide-y rounded-xl border">
      {members.map((member) => <div key={member.id} className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center"><div className="min-w-0 flex-1"><p className="truncate font-medium">{member.name}{member.isCurrent ? " (você)" : ""}</p><p className="truncate text-sm text-muted-foreground">{member.email ?? "Sem e-mail"}</p></div><form action={updateClinicMemberRole} className="flex flex-col gap-2 sm:flex-row"><input type="hidden" name="membershipId" value={member.id} /><NativeSelect name="role" defaultValue={member.role} aria-label={`Papel de ${member.name}`}><NativeSelectOption value="ADMIN">Administrador</NativeSelectOption><NativeSelectOption value="RECEPTIONIST">Recepcionista</NativeSelectOption><NativeSelectOption value="PROVIDER">Profissional</NativeSelectOption></NativeSelect><NativeSelect name="professionalId" defaultValue={member.professionalId ?? ""} aria-label={`Profissional vinculado a ${member.name}`}><NativeSelectOption value="">Sem profissional vinculado</NativeSelectOption>{professionals.filter((professional) => professional.available || professional.id === member.professionalId).map((professional) => <NativeSelectOption key={professional.id} value={professional.id}>{professional.name}</NativeSelectOption>)}</NativeSelect><Button type="submit" variant="outline" size="sm">Salvar</Button></form>{!member.isCurrent ? <form action={removeClinicMember}><input type="hidden" name="membershipId" value={member.id} /><Button type="submit" variant="ghost" size="sm">Remover</Button></form> : null}</div>)}
    </div>
    {invitations.length ? <div><h3 className="mb-2 font-medium">Convites pendentes</h3><div className="divide-y rounded-xl border">{invitations.map((invite) => <div key={invite.id} className="flex items-center gap-3 p-4"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{invite.email}</p><p className="text-xs text-muted-foreground">{roleLabels[invite.role]} · expira em {new Intl.DateTimeFormat("pt-BR").format(new Date(invite.expiresAt))}</p></div><form action={revokeClinicInvitation}><input type="hidden" name="invitationId" value={invite.id} /><Button type="submit" variant="ghost" size="sm">Revogar</Button></form></div>)}</div></div> : null}
  </div>;
}
