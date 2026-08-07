import type { z } from 'zod';
export interface AIProvider{transcribe(input:{bytes:ArrayBuffer;mimeType:string;language?:string}):Promise<{text:string;confidence?:number}>;extract<T>(input:{system:string;content:string},schema:z.ZodType<T>):Promise<T>;generate(input:{system:string;prompt:string}):Promise<string>}
export class AIProviderUnavailableError extends Error{constructor(){super('AI provider is not configured')}}
export class AIProviderOperationUnsupportedError extends Error{constructor(operation:string){super(`AI provider does not support ${operation}`)}}
export function parseJsonText(text:string):unknown{const trimmed=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');const first=trimmed.indexOf('{'),last=trimmed.lastIndexOf('}');if(first<0||last<first)throw new Error('AI_JSON_NOT_FOUND');return JSON.parse(trimmed.slice(first,last+1));}
