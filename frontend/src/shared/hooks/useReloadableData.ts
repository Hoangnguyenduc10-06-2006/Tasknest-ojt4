import { useCallback,useEffect,useState } from 'react';
export function useReloadableData<T>(load:()=>Promise<{data:T}>) {
  const [data,setData]=useState<T>();const [error,setError]=useState('');const [revision,setRevision]=useState(0);
  const refresh=useCallback(()=>setRevision(value=>value+1),[]);
  useEffect(()=>{let active=true;void load().then(result=>{if(active){setData(result.data);setError('');}}).catch(error=>{if(active)setError(error instanceof Error?error.message:'Không thể tải dữ liệu.');});return()=>{active=false;};},[load,revision]);
  useEffect(()=>{const changed=()=>refresh();window.addEventListener('tasknest:sync',changed);return()=>window.removeEventListener('tasknest:sync',changed);},[refresh]);
  return {data,error,refresh};
}
