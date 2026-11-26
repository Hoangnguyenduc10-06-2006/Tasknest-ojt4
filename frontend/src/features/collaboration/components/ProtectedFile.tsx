import {useEffect,useState} from 'react';
import {fileBlob} from '../api/collaboration.api';
export function ProtectedFile({project,id,name,image=false}:{project:string;id:number;name:string;image?:boolean}) {
  const [url,setUrl]=useState('');const [error,setError]=useState('');
  useEffect(()=>{let active=true;let objectUrl='';if(image)void fileBlob(project,id).then(blob=>{objectUrl=URL.createObjectURL(blob);if(active)setUrl(objectUrl);else URL.revokeObjectURL(objectUrl);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};},[project,id,image]);
  async function download(){try{const blob=await fileBlob(project,id);const object=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=object;anchor.download=name;anchor.click();window.setTimeout(()=>URL.revokeObjectURL(object),1000);}catch(error){setError(error instanceof Error?error.message:'Không thể tải tệp.');}}
  return <div className={image ? "comment-attachment" : "space-y-2"}>{image&&url&&<a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Xem ảnh ${name}`}><img src={url} alt={name} className="h-36 w-36 rounded-lg border border-line bg-panel object-cover"/></a>}<button type="button" className="max-w-40 truncate text-left text-xs font-medium text-accent hover:underline" onClick={()=>void download()}>{image ? 'Tải ảnh ↓' : `Tải ${name}`}</button>{error&&<p role="alert" className="text-sm text-danger">{error}</p>}</div>;
}
