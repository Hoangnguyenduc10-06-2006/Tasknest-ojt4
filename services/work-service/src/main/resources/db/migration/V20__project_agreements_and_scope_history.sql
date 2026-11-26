CREATE TABLE marketplace_revisions (
    resource_type VARCHAR(8) NOT NULL,
    resource_id BIGINT NOT NULL,
    version BIGINT NOT NULL,
    actor_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    snapshot JSON NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY(resource_type,resource_id,version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;
CREATE TABLE project_agreements (
    project_id BIGINT NOT NULL PRIMARY KEY,
    request_id BIGINT NOT NULL,
    proposal_id BIGINT NOT NULL,
    snapshot JSON NOT NULL,
    kickoff_at DATETIME(6) NULL,
    kickoff_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    roster_snapshot JSON NULL,
    version BIGINT NOT NULL DEFAULT 0,
    milestone_id BIGINT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id),
    FOREIGN KEY(request_id) REFERENCES customer_project_requests(id),
    FOREIGN KEY(proposal_id) REFERENCES team_project_proposals(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;
-- Existing projects are already in progress; do not force them through a new kickoff.
INSERT INTO project_agreements(project_id,request_id,proposal_id,snapshot,kickoff_at,kickoff_by,roster_snapshot)
SELECT r.project_id,r.id,p.id,JSON_OBJECT('title',r.title,'description',r.description,'skills',r.skills,'plan',p.plan,'amount',p.amount,'startsOn',p.starts_on,'endsOn',p.ends_on,'teamId',t.id,'teamName',t.name,'customerId',r.customer_user_id,'customerName',r.customer_name,'requestVersion',p.request_version,'proposalVersion',p.version),COALESCE(e.accepted_at,UTC_TIMESTAMP(6)),t.owner_user_id,JSON_ARRAY()
FROM customer_project_requests r JOIN team_project_proposals p ON p.request_id=r.id AND p.status='ACCEPTED' JOIN dev_teams t ON t.id=p.team_id JOIN team_engagements e ON e.project_id=r.project_id WHERE r.project_id IS NOT NULL;
