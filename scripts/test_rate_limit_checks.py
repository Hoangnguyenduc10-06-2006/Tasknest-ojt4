import unittest
from unittest.mock import Mock
from rate_limit_checks import check_in_one_window


class FixedWindowCheckTest(unittest.TestCase):
    def test_restarts_only_when_database_proves_window_rollover(self):
        schema = Mock()
        schema.sql.side_effect = ['', '2', '']
        check = Mock(side_effect=[AssertionError('Expected 429, got 200'), None])
        check_in_one_window(schema, 'LOGIN', 'IP', check)
        self.assertEqual(check.call_count, 2)
        self.assertEqual(schema.sql.call_count, 3)

    def test_real_security_failure_is_not_retried_or_hidden(self):
        for windows in ('0', '1'):
            with self.subTest(windows=windows):
                schema = Mock()
                schema.sql.side_effect = ['', windows]
                check = Mock(side_effect=AssertionError('Rate limit failed'))
                with self.assertRaisesRegex(AssertionError, 'Rate limit failed'):
                    check_in_one_window(schema, 'LOGIN', 'IP', check)
                self.assertEqual(check.call_count, 1)

    def test_repeated_rollover_is_bounded_and_still_fails(self):
        schema = Mock()
        schema.sql.side_effect = ['', '2', '', '2', '', '2']
        check = Mock(side_effect=AssertionError('Expected 429'))
        with self.assertRaisesRegex(AssertionError, 'Expected 429'):
            check_in_one_window(schema, 'MAIL', 'GLOBAL', check)
        self.assertEqual(check.call_count, 3)

    def test_network_failure_is_not_mistaken_for_rollover(self):
        schema = Mock()
        check = Mock(side_effect=TimeoutError('Identity unavailable'))
        with self.assertRaises(TimeoutError):
            check_in_one_window(schema, 'LOGIN', 'IP', check)
        self.assertEqual(check.call_count, 1)


if __name__ == '__main__':
    unittest.main()
