import { Icon } from '../../../shared/ui/Icon';
import { Badge } from '../../../shared/ui/Badge';
import { SectionHeader } from '../../../shared/ui/SectionHeader';
import {useCallback,useState,type FormEvent} from 'react';
import {useWorkspace} from '../../workspace';
import {Button} from '../../../shared/ui/Button';
import {Modal} from '../../../shared/ui/Modal';
import {Pagination} from '../../../shared/ui/Pagination';
import {deleteResource,listResources,saveResource,uploadFile,discardFile} from '../api/collaboration.api';
import {useReloadableData as useCollaborationData} from '../../../shared/hooks/useReloadableData';
import type {Resource} from '../model/collaboration.types';
import {FilePicker,type PickedFile} from './FilePicker';
import {ProtectedFile} from './ProtectedFile';
export function ProjectResources({project,role,archived}:{project:string;role:'Owner'|'Manager'|'Member'|'Customer';archived:boolean}) {
  const workspace=useWorkspace();const [search,setSearch]=useState('');const [type,setType]=useState('ALL');const [page,setPage]=useState(0);const [size,setSize]=useState(20);const [editor,setEditor]=useState<{item?:Resource}>();const [removing,setRemoving]=useState<Resource>();const [error,setError]=useState('');const [pending,setPending]=useState(false);
  const load=useCallback(()=>listResources(project,search,type,page,size),[project,search,type,page,size]);const state=useCollaborationData(load);
  const readOnly = archived || state.data?.readOnly;
  async function remove(){if(readOnly||!removing||pending)return;setPending(true);setError('');try{await deleteResource(project,removing.id,removing.version);setRemoving(undefined);state.refresh();}catch(error){setError(error instanceof Error?error.message:'Không thể xóa.');}finally{setPending(false);}}
  const used = state.data?.usage.used_bytes ?? 0;
  const limit = state.data?.usage.limit_bytes ?? 0;
  const usagePercent = limit > 0 ? Math.min(100, used / limit * 100) : 0;
  return <section className="space-y-5">
    <SectionHeader title="Tài liệu & Liên kết" description="Tập trung tài liệu và tài nguyên của dự án tại một nơi." actions={!readOnly && <Button icon="plus" onClick={() => setEditor({})}>Thêm tài liệu / liên kết</Button>} />
    {state.data && <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-4">
      <span className="grid size-10 place-items-center rounded-xl bg-tint text-accent"><Icon name="folder" size={22} /></span>
      <div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap justify-between gap-2 text-xs"><strong>Dung lượng dự án</strong><span className="text-muted">{(used / 1048576).toFixed(2)} / {(limit / 1048576).toFixed(0)} MiB</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-panel" role="meter" aria-label="Dung lượng đã sử dụng" aria-valuemin={0} aria-valuemax={100} aria-valuenow={usagePercent}><div className={`h-full rounded-full ${usagePercent >= 90 ? 'bg-warning' : 'bg-accent'}`} style={{width: `${usagePercent}%`}} /></div>
        <p className="mt-2 text-[11px] text-muted">Còn {(Math.max(0, limit - used) / 1048576).toFixed(2)} MiB · Bao gồm ảnh bình luận.</p>
      </div>
    </div>}
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3">
      <label className="flex min-w-40 flex-1 items-center gap-2 rounded-lg border border-line bg-field px-3 text-muted"><Icon name="search" /><input aria-label="Tìm tài liệu" value={search} onChange={event => {setSearch(event.target.value);setPage(0);}} placeholder="Tìm tài liệu hoặc liên kết..." className="min-w-0 w-full bg-transparent py-2.5 text-xs text-ink outline-none" /></label>
      <select aria-label="Loại tài liệu" value={type} onChange={event => {setType(event.target.value);setPage(0);}} className="rounded-lg border border-line bg-field px-3 py-2.5 text-xs"><option value="ALL">Tất cả tài nguyên</option><option value="FILE">Tệp đính kèm</option><option value="LINK">Liên kết</option></select>
      <label className="flex items-center gap-2 text-xs text-muted">Hiển thị<select aria-label="Số kết quả mỗi trang" className="rounded-lg border border-line bg-field p-2" value={size} onChange={e => {setSize(Number(e.target.value));setPage(0);}}>{[10,20,50].map(value => <option key={value} value={value}>{value} / trang</option>)}</select></label>
    </div>
    {state.error && <p role="alert" className="rounded-xl bg-danger-soft p-4 text-sm text-danger">{state.error} <button onClick={state.refresh} className="ml-2 underline">Thử lại</button></p>}
    {!state.data && !state.error && <p role="status" className="py-10 text-center text-sm text-muted">Đang tải tài liệu…</p>}
    <div className="grid gap-4 lg:grid-cols-2">
      {state.data?.items.map(item => <article key={item.id} className="flex min-w-0 flex-col rounded-2xl border border-line bg-surface p-5 shadow-panel">
        <div className="flex items-start gap-3">
          <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${item.resource_type === 'FILE' ? 'bg-tint text-accent' : 'bg-success-soft text-success'}`}><Icon name={item.resource_type === 'FILE' ? 'paperclip' : 'arrow'} size={22} /></span>
          <div className="min-w-0 flex-1"><h3 className="break-words text-sm font-semibold">{item.title}</h3><p className="mt-1 break-all text-[11px] text-muted">{item.resource_type === 'FILE' ? item.original_name || 'Tệp đính kèm' : 'Liên kết bên ngoài'}</p></div>
          <Badge tone={item.resource_type === 'FILE' ? 'blue' : 'green'}>{item.resource_type === 'FILE' ? 'Tệp' : 'Liên kết'}</Badge>
        </div>
        {item.description && <p className="my-4 whitespace-pre-wrap break-words text-xs leading-6 text-muted">{item.description}</p>}
        <div className="mt-auto space-y-3 pt-4">
          <div className="break-all text-xs">{item.resource_type === 'LINK' && item.link_url ? <a href={item.link_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent">Mở {new URL(item.link_url).hostname} ↗</a> : item.stored_file_id && <ProtectedFile project={project} id={item.stored_file_id} name={item.original_name ?? item.title} />}</div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-[11px] text-muted"><span>{workspace.data?.members.find(member => member.id === item.created_by && member.projectId === project)?.name ?? 'Thành viên cũ'}</span><span>{new Date(item.created_at).toLocaleDateString('vi-VN', {timeZone:'Asia/Ho_Chi_Minh'})}{item.size_bytes ? ` · ${(item.size_bytes / 1048576).toFixed(2)} MiB` : ''}</span></div>
          {!readOnly && ((role === 'Owner' || role === 'Manager') || item.created_by === workspace.userId) && <div className="flex justify-end gap-2"><Button kind="ghost" size="sm" onClick={() => setEditor({item})}>Chỉnh sửa</Button><Button kind="danger" size="sm" onClick={() => {setRemoving(item);setError('');}}>Xóa</Button></div>}
        </div>
      </article>)}
    </div>
    {state.data?.total === 0 && <div className="rounded-2xl border border-dashed border-line bg-surface p-10 text-center"><span className="mx-auto mb-3 grid size-12 place-items-center rounded-xl bg-panel text-muted"><Icon name="folder" size={24} /></span><p className="text-sm font-semibold">{search || type !== 'ALL' ? 'Không có kết quả phù hợp' : 'Chưa có tài liệu hoặc liên kết'}</p><p className="mt-2 text-xs text-muted">{search || type !== 'ALL' ? 'Thử đổi từ khóa hoặc loại tài nguyên.' : 'Thêm tài nguyên để mọi người trong nhóm dễ tìm và sử dụng.'}</p></div>}
    {state.data && <Pagination page={page} total={state.data.total} size={size} onChange={setPage} />}
    {!readOnly && editor && <ResourceEditor key={editor.item?.id ?? 'new'} project={project} initial={editor.item} onClose={() => setEditor(undefined)} onSaved={() => {state.refresh();setEditor(undefined);}} />}
    {!readOnly && removing && <Modal open title="Xóa tài liệu / liên kết" onClose={() => {if(!pending)setRemoving(undefined);}}><p className="mb-4 text-sm text-muted">Mục sẽ bị ẩn và không thể tải tệp qua liên kết cũ.</p>{error && <p role="alert" className="text-danger">{error}</p>}<Button kind="danger" loading={pending} onClick={() => void remove()}>Xác nhận xóa</Button></Modal>}
  </section>;
}
function ResourceEditor({project,initial,onClose,onSaved}:{project:string;initial?:Resource;onClose:()=>void;onSaved:()=>void}) {
  const [title,setTitle]=useState(initial?.title??'');const [description,setDescription]=useState(initial?.description??'');const [kind,setKind]=useState<'FILE'|'LINK'>(initial?.resource_type??'LINK');const [url,setUrl]=useState(initial?.link_url??'');const [files,setFiles]=useState<PickedFile[]>([]);const [requestId]=useState(()=>crypto.randomUUID());const [pending,setPending]=useState(false);const [error,setError]=useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError('');
    try {
      let fileId = initial?.stored_file_id ?? null;
      if (kind === 'FILE' && !initial && files[0]) {
        const uploaded = await uploadFile(project, files[0].file, 'PROJECT_DOCUMENT', crypto.randomUUID());
        fileId = uploaded.data.id;
      }
      try {
        await saveResource(project, {
          requestId, version: initial?.version, title: title.trim(), description: description.trim(),
          fileId: kind === 'FILE' ? fileId : null, url: kind === 'LINK' ? url.trim() : null,
        }, initial?.id);
      } catch (cause) {
        // Discard only unattached uploads. A lost successful save response must not delete a saved resource.
        if (!initial && fileId) await discardFile(project, fileId).catch(() => {});
        throw cause;
      }
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu.');
    } finally {
      setPending(false);
    }
  }
  const control='rounded-xl border border-line bg-field p-3';
  return <Modal open title={initial?'Sửa thông tin tài liệu':'Thêm tài liệu / liên kết'} onClose={()=>{if(!pending)onClose();}}><form onSubmit={submit} className="space-y-4"><label className="grid gap-2 text-sm">Tên hiển thị<input required maxLength={150} className={control} value={title} onChange={e=>setTitle(e.target.value)} disabled={pending}/></label><label className="grid gap-2 text-sm">Mô tả<textarea maxLength={500} className={control} value={description} onChange={e=>setDescription(e.target.value)} disabled={pending}/></label>{!initial&&<label className="grid gap-2 text-sm">Loại mục<select className={control} value={kind} onChange={e=>setKind(e.target.value as 'FILE'|'LINK')} disabled={pending}><option value="LINK">Liên kết</option><option value="FILE">Tệp</option></select></label>}{kind==='LINK'?<label className="grid gap-2 text-sm">Liên kết http/https<input type="url" required maxLength={2048} value={url} onChange={e=>setUrl(e.target.value)} className={control} disabled={pending}/></label>:initial?<p className="text-sm text-muted">{initial.original_name}. Thay nội dung tệp bằng cách xóa mục và thêm tệp mới.</p>:<FilePicker autoUpload={false} project={project} images={false} value={files} onChange={setFiles} disabled={pending}/>}<p className="text-xs text-muted">Liên kết ngoài vẫn chịu quyền của dịch vụ đích. Tệp được kiểm tra quyền trước khi tải.</p>{error&&<p role="alert" className="text-danger">{error}</p>}<Button type="submit" disabled={pending||(kind==='FILE'&&!initial&&!files[0])}>Lưu</Button></form></Modal>;
}
