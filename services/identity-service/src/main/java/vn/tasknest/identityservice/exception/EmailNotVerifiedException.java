package vn.tasknest.identityservice.exception;
public class EmailNotVerifiedException extends RuntimeException {
    public EmailNotVerifiedException() { super("Vui lòng xác nhận email trước khi đăng nhập"); }
}
