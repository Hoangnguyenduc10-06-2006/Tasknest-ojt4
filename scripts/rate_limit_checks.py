"""Keep fixed-window integration assertions from straddling a real clock boundary."""
def check_in_one_window(schema, action, scope, check, attempts=3):
    # This helper is only used against test-auth-mail.py's disposable database.
    # Never retry a failed security assertion unless DB evidence proves rollover.
    for attempt in range(attempts):
        schema.sql('DELETE FROM auth_rate_limit_buckets;', 'identity')
        try:
            check()
            return
        except AssertionError:
            windows = int(schema.sql(
                "SELECT COUNT(DISTINCT window_start) FROM auth_rate_limit_buckets "
                f"WHERE action='{action}' AND scope='{scope}';", 'identity'))
            if windows <= 1 or attempt == attempts - 1:
                raise
            print(f'Fixed-window {action}/{scope} check crossed a clock boundary; restarting with empty test buckets.', flush=True)
