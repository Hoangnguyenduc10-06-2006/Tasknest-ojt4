import { authenticatedAccessToken } from '../../auth';
import { requestBlob, requestForm, requestJson } from '../../../shared/api/client';
import type {Comment,CommentInput,Page,Resource,ResourceInput,StoredFile} from '../model/collaboration.types';
export async function collaborationRequest<T>(project:string,path:string,body?:unknown,method:'GET'|'POST'|'PUT'='GET') { const accessToken=await authenticatedAccessToken();return requestJson<{data:T}>(`/api/work/projects/${project}/${path}`,{accessToken,body,method}); }
export async function uploadFile(project:string,file:File,kind:'COMMENT_IMAGE'|'PROJECT_DOCUMENT',requestId:string) {const token=await authenticatedAccessToken();const form=new FormData();form.set('kind',kind);form.set('requestId',requestId);form.set('file',file);return requestForm<{data:StoredFile}>(`/api/work/projects/${project}/files`,form,token);}
export const discardFile=(project:string,id:number)=>collaborationRequest(project,`files/${id}/discard`,{},'PUT');
export async function fileBlob(project:string,id:number){return requestBlob(`/api/work/projects/${project}/files/${id}`,await authenticatedAccessToken());}
export const listComments=(project:string,task:string,page:number,size:number,parentId?:number)=>collaborationRequest<Page<Comment>>(project,`tasks/${task}/comments?${new URLSearchParams({page:String(page),size:String(size),...(parentId?{parentId:String(parentId)}:{})})}`);
export const saveComment=(project:string,task:string,input:CommentInput,id?:number)=>collaborationRequest<number>(project,`tasks/${task}/comments${id?`/${id}`:''}`,input,id?'PUT':'POST');
export const deleteComment=(project:string,task:string,id:number,version:number)=>collaborationRequest(project,`tasks/${task}/comments/${id}/delete`,{version},'PUT');
export const listResources=(project:string,search:string,type:string,page:number,size:number)=>collaborationRequest<Page<Resource>&{readOnly?:boolean;usage:{used_bytes:number;limit_bytes:number}}>(project,`resources?${new URLSearchParams({search,type,page:String(page),size:String(size)})}`);
export const saveResource=(project:string,input:ResourceInput,id?:number)=>collaborationRequest<number>(project,`resources${id?`/${id}`:''}`,input,id?'PUT':'POST');
export const deleteResource=(project:string,id:number,version:number)=>collaborationRequest(project,`resources/${id}/delete`,{version},'PUT');
