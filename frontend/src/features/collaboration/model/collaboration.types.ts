export type StoredFile = {id:number;originalName:string;mimeType:string;sizeBytes:number};
export type FileMetadata = {id:number;original_name:string;mime_type:string;size_bytes:number};
export type Comment = {id:number;author_user_id:string;parent_comment_id:number|null;body:string|null;version:number;created_at:string;edited_at:string|null;deleted_at:string|null;reply_count:number;images:FileMetadata[];mentions:string[]};
export type Resource = {id:number;resource_type:'FILE'|'LINK';title:string;description:string|null;link_url:string|null;stored_file_id:number|null;created_by:string;created_at:string;updated_at:string;version:number;original_name:string|null;size_bytes:number|null};
export type Page<T> = {items:T[];total:number;page:number;size:number};
export type CommentInput = {requestId:string;version?:number;parentId:number|null;body:string;imageIds:number[];mentions:string[]};
export type ResourceInput = {requestId:string;version?:number;title:string;description:string;fileId:number|null;url:string|null};
