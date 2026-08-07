import { NotificationOutbox, type NotificationTemplateKey } from '@yrak/notifications';
import type { AppEnv } from '../env.js';

export async function enqueueNotification(env:AppEnv,input:{organizationId:string;entityType:string;entityId:string;recipient:string|null|undefined;templateKey:NotificationTemplateKey;payload:Record<string,unknown>;channel?:'EMAIL'|'WHATSAPP'|'IN_APP'}):Promise<string|null>{
  if(!input.recipient)return null;
  const id=await new NotificationOutbox(env.DB).enqueue({organizationId:input.organizationId,entityType:input.entityType,entityId:input.entityId,channel:input.channel??'EMAIL',recipient:input.recipient,templateKey:input.templateKey,payload:input.payload});
  await env.NOTIFICATIONS_QUEUE?.send({notificationId:id});
  return id;
}
