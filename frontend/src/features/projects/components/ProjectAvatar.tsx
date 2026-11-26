import { useEffect, useState } from 'react';
import { authenticatedAccessToken } from '../../auth';
import { requestBlob } from '../../../shared/api/client';
import { useProjects } from '../hooks/useProjects';
interface ProjectAvatarProps {
  code: string;
  projectId?: string;
  name: string;
  colorClass?: string;
  imageUrl?: string;
  className?: string;
}

export function ProjectAvatar({
  code,
  projectId,
  name,
  colorClass,
  imageUrl,
  className = '',
}: ProjectAvatarProps) {
  const project=useProjects().find(item=>item.id===projectId);
  const [avatar,setAvatar]=useState('');
  useEffect(()=>{let active=true;let object='';if(!projectId||!project?.hasAvatar)return;void authenticatedAccessToken().then(token=>requestBlob(`/api/work/projects/${projectId}/avatar`,token)).then(blob=>{object=URL.createObjectURL(blob);if(active)setAvatar(object);else URL.revokeObjectURL(object);}).catch(()=>{if(active)setAvatar('');});return()=>{active=false;if(object)URL.revokeObjectURL(object);};},[projectId,project?.version,project?.hasAvatar]);
  imageUrl=avatar||imageUrl;
  const fallbackColor =
    colorClass ||
    'bg-gradient-to-br from-indigo-500/20 to-purple-600/20 text-indigo-300 border-indigo-500/30';

  return (
    <div
      title={name}
      aria-label={`Logo dự án ${name}`}
      className={`flex size-10 shrink-0 items-center justify-center rounded-xl border font-bold text-xs tracking-wider shadow-xs select-none ${fallbackColor} ${className}`}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="size-full rounded-xl object-cover"
        />
      ) : (
        code.slice(0, 2).toUpperCase()
      )}
    </div>
  );
}
