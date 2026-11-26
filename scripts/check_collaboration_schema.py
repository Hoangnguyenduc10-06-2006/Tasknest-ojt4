"""RULE v2.0 regression checks; only called against test-schema's disposable databases."""


def check_collaboration_schema(sql, expect):
    def comment(id, task=1, parent='NULL', level=0, parent_level='NULL', body="'Nội dung trao đổi'", images=0, rejects=None):
        sql(f"INSERT INTO task_comments(id,project_id,task_id,author_user_id,body,parent_comment_id,thread_level,parent_thread_level,image_count,creation_request_id,request_hash) VALUES ({id},1,{task},1,{body},{parent},{level},{parent_level},{images},UUID(),UNHEX(SHA2('request-{id}',256)));", 'work', rejects=rejects)
    comment(10)
    comment(11, parent=10, level=1, parent_level=0)
    comment(12, parent=11, level=1, parent_level=0, rejects=1452)  # third level
    comment(12, task=3, parent=10, level=1, parent_level=0, rejects=1452)  # another task
    comment(12, parent=10, level=1, rejects=3819)  # NULL must not bypass CHECK
    comment(12, body='NULL', rejects=3819)
    comment(12, body='NULL', images=1)
    comment(13, images=6, rejects=3819)
    expect('SELECT COUNT(*) FROM task_comments WHERE id IN (10,11,12);', 3, 'work')
    sql('UPDATE task_comments SET deleted_at=UTC_TIMESTAMP(6),deleted_by=1,body=NULL WHERE id=10;', 'work')
    expect('SELECT COUNT(*) FROM task_comments WHERE parent_comment_id=10;', 1, 'work')
    sql("INSERT INTO task_comments(project_id,task_id,author_user_id,body,creation_request_id,request_hash) SELECT project_id,task_id,author_user_id,'Retry',creation_request_id,request_hash FROM task_comments WHERE id=12;",'work',rejects=1062)

    def file(id, project=1, kind='COMMENT_IMAGE', mime='image/png', size=500, status='UPLOADING', rejects=None):
        sql(f"INSERT INTO stored_files(id,project_id,uploaded_by,upload_request_id,request_hash,storage_key,original_name,file_kind,mime_type,size_bytes,status,created_at,temporary_expires_at) VALUES ({id},{project},1,UUID(),UNHEX(SHA2('request-{id}',256)),'private/{id}','photo.png','{kind}','{mime}',{size},'{status}','2026-10-28','2026-10-29');",'work',rejects=rejects)
    file(1)
    file(2,project=2)
    file(3,kind='PROJECT_DOCUMENT',mime='application/pdf')
    file(4,size=5242881,rejects=3819)
    file(4,kind='PROJECT_DOCUMENT',size=20971521,rejects=3819)
    file(4,mime='image/svg+xml',rejects=3819)
    file(4,mime='application/pdf',rejects=3819)
    file(4,status='READY',rejects=3819)
    sql("INSERT INTO stored_files(project_id,uploaded_by,upload_request_id,request_hash,storage_key,original_name,file_kind,mime_type,size_bytes,created_at,temporary_expires_at) SELECT project_id,uploaded_by,upload_request_id,request_hash,'another-key',original_name,file_kind,mime_type,size_bytes,created_at,temporary_expires_at FROM stored_files WHERE id=1;",'work',rejects=1062)
    sql('INSERT INTO comment_attachments(project_id,task_id,comment_id,slot_no,stored_file_id) VALUES (1,1,12,1,1);','work')
    sql('INSERT INTO comment_attachments(project_id,task_id,comment_id,slot_no,stored_file_id) VALUES (1,1,12,2,2);','work',rejects=1452)
    sql('INSERT INTO comment_attachments(project_id,task_id,comment_id,slot_no,stored_file_id) VALUES (1,1,12,2,3);','work',rejects=1452)
    sql('INSERT INTO comment_attachments(project_id,task_id,comment_id,slot_no,stored_file_id) VALUES (1,1,12,6,1);','work',rejects=3819)
    sql('INSERT INTO comment_attachments(project_id,task_id,comment_id,slot_no,stored_file_id) VALUES (1,1,11,1,1);','work',rejects=1062)

    def resource(id, kind='LINK', url="'https://www.figma.com/design/example'", file='NULL', file_kind='NULL', rejects=None):
        sql(f"INSERT INTO project_resources(id,project_id,resource_type,title,stored_file_id,file_kind,link_url,created_by,creation_request_id,request_hash) VALUES ({id},1,'{kind}','Tài liệu dự án',{file},{file_kind},{url},1,UUID(),UNHEX(SHA2('resource-{id}',256)));",'work',rejects=rejects)
    resource(1)
    resource(2,url="'javascript:alert(1)'",rejects=3819)
    resource(2,url="'https://user:pass@example.test/file'",rejects=3819)
    resource(2,kind='FILE',url='NULL',file=3,file_kind="'PROJECT_DOCUMENT'")
    resource(3,kind='FILE',url='NULL',file=2,file_kind="'PROJECT_DOCUMENT'",rejects=1452)
    resource(3,kind='FILE',url='NULL',file=1,file_kind="'COMMENT_IMAGE'",rejects=3819)
    resource(3,kind='FILE',url='NULL',file=1,rejects=3819)

    sql("INSERT INTO comment_mentions(project_id,task_id,comment_id,mentioned_user_id,slot_no,first_notified_at,first_notification_event_id) VALUES (1,1,11,2,1,'2026-10-28','event-mention-1');",'work')
    sql("UPDATE comment_mentions SET removed_at='2026-10-28' WHERE comment_id=11 AND mentioned_user_id=2; UPDATE comment_mentions SET removed_at=NULL WHERE comment_id=11 AND mentioned_user_id=2;",'work')
    expect("SELECT first_notification_event_id FROM comment_mentions WHERE comment_id=11 AND mentioned_user_id=2;",'event-mention-1','work')
    sql('INSERT INTO comment_mentions(project_id,task_id,comment_id,mentioned_user_id,slot_no) VALUES (1,1,11,2,2);','work',rejects=1062)
    sql('INSERT INTO comment_mentions(project_id,task_id,comment_id,mentioned_user_id,slot_no) VALUES (1,1,11,1,1);','work',rejects=1062)
    sql('INSERT INTO comment_mentions(project_id,task_id,comment_id,mentioned_user_id,slot_no) VALUES (1,1,11,1,11);','work',rejects=3819)
    sql('INSERT INTO comment_mentions(project_id,task_id,comment_id,mentioned_user_id,slot_no) VALUES (1,3,11,1,2);','work',rejects=1452)

    sql('INSERT INTO project_storage_usage(project_id) VALUES (1);','work')
    sql('UPDATE project_storage_usage SET reserved_bytes=524288000 WHERE project_id=1;','work')
    sql('UPDATE project_storage_usage SET reserved_bytes=reserved_bytes+1 WHERE project_id=1;','work',rejects=3819)
    sql('UPDATE project_storage_usage SET used_bytes=1 WHERE project_id=1;','work',rejects=3819)
    sql('UPDATE project_storage_usage SET reserved_bytes=-1 WHERE project_id=1;','work',rejects=3819)
    sql('UPDATE project_storage_usage SET reserved_bytes=0,used_bytes=0 WHERE project_id=1;','work')
    sql("UPDATE stored_files SET status='DELETE_PENDING',deleted_at='2026-10-28',purge_after='2026-10-29' WHERE id=1;",'work')
    sql("UPDATE stored_files SET status='DELETED' WHERE id=1;",'work',rejects=3819)
    sql("UPDATE stored_files SET status='DELETED',purged_at='2026-10-28' WHERE id=1;",'work')

    for n,reasons in ((20,'["REPLY"]'),(21,'["MENTION","REPLY"]')):
        sql(f"INSERT INTO notifications(id,recipient_user_id,event_id,event_type,resource_type,resource_id,title,body,recipient_reasons) VALUES ({n},1,'collaboration-{n}','task.comment.created','COMMENT','11','Trao đổi','Có phản hồi mới','{reasons}');",'notification')
        sql(f"INSERT INTO email_jobs(event_id,recipient_user_id,recipient_email,event_type,purpose,notification_id,template_key,template_data,recipient_reasons) VALUES ('collaboration-{n}',1,'fixture@example.test','task.comment.created','TASK_EVENT',{n},'comment','{{}}','{reasons}');",'notification')
    sql("INSERT INTO email_jobs(event_id,recipient_user_id,recipient_email,event_type,purpose,notification_id,template_key,template_data,recipient_reasons) VALUES ('collaboration-20',1,'fixture@example.test','task.comment.created','TASK_EVENT',20,'comment','{}','[\"MENTION\"]');",'notification',rejects=1062)
    sql("UPDATE email_jobs SET recipient_reasons='[\"ASSIGNEE\"]' WHERE event_id='collaboration-20';",'notification',rejects=3819)
    sql("UPDATE email_jobs SET recipient_reasons='[\"MENTION\",\"MENTION\"]' WHERE event_id='collaboration-20';",'notification',rejects=3819)
    sql("UPDATE notifications SET recipient_reasons='[\"OWNER\"]' WHERE id=20;",'notification',rejects=3819)
