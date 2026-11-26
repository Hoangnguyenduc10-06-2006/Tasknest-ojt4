import { Badge, type BadgeTone } from '../../../shared/ui/Badge';
import type { TaskPriority, TaskStatus } from '../model/task.types';
import { statusLabels } from '../model/task-board';
const statusTone:Record<TaskStatus,BadgeTone>={TODO:'neutral',IN_PROGRESS:'blue',REVIEW:'purple',DONE:'green',CANCELLED:'neutral',BLOCKED:'red'};
export function TaskStatusBadge({status}:{status:TaskStatus}){return <Badge tone={statusTone[status]}>{statusLabels[status]}</Badge>;}
const priorities:Record<TaskPriority,{label:string;tone:BadgeTone}>={LOW:{label:'Thấp',tone:'neutral'},MEDIUM:{label:'Trung bình',tone:'amber'},HIGH:{label:'Cao',tone:'red'},URGENT:{label:'Khẩn cấp',tone:'red'}};
export function TaskPriorityBadge({priority}:{priority:TaskPriority}){return <Badge tone={priorities[priority].tone}>{priorities[priority].label}</Badge>;}
