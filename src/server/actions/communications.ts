"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getClinicForRoles } from "@/server/tenant";
import { requireAuthenticatedUser } from "@/server/auth";
import { parseClinicDateTime } from "@/lib/timezone";
import { isSubscriptionActive, SUBSCRIPTION_INACTIVE_MESSAGE } from "@/server/subscription";
import type { ActionResult } from "@/types";

export async function createManualReminder(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAuthenticatedUser(); const clinic = await getClinicForRoles(["ADMIN", "RECEPTIONIST"]); if (!clinic || !isSubscriptionActive(clinic)) return { status:"error", message: clinic ? SUBSCRIPTION_INACTIVE_MESSAGE : "Selecione um negócio." };
  const parsed=z.object({appointmentId:z.uuid(),channel:z.enum(["WHATSAPP","EMAIL"]),content:z.string().trim().min(3).max(1000),scheduledFor:z.string().min(1)}).safeParse({appointmentId:formData.get("appointmentId"),channel:formData.get("channel"),content:formData.get("content"),scheduledFor:formData.get("scheduledFor")}); if(!parsed.success)return{status:"error",message:"Revise os dados do lembrete."};
  if (parsed.data.channel === "WHATSAPP" && process.env.WHATSAPP_SENDER_MODE !== "api") return { status: "error", message: "O WhatsApp automático ainda não está habilitado. Use o envio manual desta tela." };
  const appointment=await prisma.appointment.findFirst({where:{id:parsed.data.appointmentId,clinicId:clinic.id,status:{in:["PENDING","CONFIRMED"]},startTime:{gt:new Date()}},include:{customer:true}});if(!appointment)return{status:"error",message:"Atendimento não encontrado."};
  const recipient=parsed.data.channel==="EMAIL"?appointment.customer.email:appointment.customer.phone;if(!recipient)return{status:"error",message:"O cliente não possui contato para esse canal."};const scheduledFor=parseClinicDateTime(parsed.data.scheduledFor,clinic.timeZone);if(!scheduledFor||scheduledFor<new Date()||scheduledFor>=appointment.startTime)return{status:"error",message:"Agende o envio para antes do atendimento."};
  await prisma.notification.create({data:{kind:"REMINDER_24H",channel:parsed.data.channel,recipient,content:parsed.data.content,idempotencyKey:`manual:${crypto.randomUUID()}`,scheduledFor,nextAttemptAt:scheduledFor,clinicId:clinic.id,appointmentId:appointment.id}});revalidatePath("/dashboard/comunicacoes");return{status:"success",message:"Lembrete programado."};
}

export async function retryNotification(_previousState: ActionResult,formData:FormData):Promise<ActionResult>{await requireAuthenticatedUser();const clinic=await getClinicForRoles(["ADMIN","RECEPTIONIST"]);const id=z.uuid().safeParse(formData.get("id"));if(!clinic||!id.success)return{status:"error",message:"Mensagem inválida."};const result=await prisma.notification.updateMany({where:{id:id.data,clinicId:clinic.id,status:"FAILED",appointment:{startTime:{gt:new Date()},status:{in:["PENDING","CONFIRMED"]}}},data:{status:"PENDING",attempts:0,error:null,lockedAt:null,nextAttemptAt:new Date()}});if(!result.count)return{status:"error",message:"Esta mensagem não pode mais ser reenviada."};revalidatePath("/dashboard/comunicacoes");return{status:"success",message:"Mensagem colocada novamente na fila."}}
