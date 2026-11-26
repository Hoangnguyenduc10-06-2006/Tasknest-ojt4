import {useRef,useState} from 'react';
import { Button } from '../../../shared/ui/Button';
import {authenticatedAccessToken} from '../../auth';
import {requestForm} from '../../../shared/api/client';
import {loadProjects} from '../model/project.store';
import {useWorkspace} from '../../workspace';
export function ProjectAvatarEditor({project,version}:{project:string;version:number}) {
  const input=useRef<HTMLInputElement>(null);
  const workspace=useWorkspace();const [pending,setPending]=useState(false);const [message,setMessage]=useState('');
  async function upload(file:File){if(pending||!workspace.userId)return;setPending(true);setMessage('');try{const token=await authenticatedAccessToken(workspace.userId);const body=new FormData();body.set('version',String(version));body.set('file',file);await requestForm(`/api/work/projects/${project}/avatar`,body,token);await loadProjects(workspace.userId);await workspace.refresh();setMessage('Đã lưu ảnh đại diện dự án.');}catch(error){setMessage(error instanceof Error?error.message:'Không thể lưu ảnh.');}finally{setPending(false);}}
  return <div className="flex flex-wrap items-center justify-end gap-3"><input ref={input} className="sr-only" aria-label="Ảnh đại diện dự án" type="file" accept=".png,.jpg,.jpeg" disabled={pending} onChange={event=>{const file=event.target.files?.[0];if(file)void upload(file);event.target.value='';}}/><Button kind="secondary" loading={pending} onClick={()=>input.current?.click()}>Thay ảnh</Button>{message&&<p role="status" className="w-full text-sm text-muted">{message}</p>}</div>;
}
