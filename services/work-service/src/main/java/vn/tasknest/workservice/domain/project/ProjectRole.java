package vn.tasknest.workservice.domain.project;
public enum ProjectRole {
    OWNER, MANAGER, MEMBER, CUSTOMER;
    public boolean canManage() { return this==OWNER || this==MANAGER; }
}
