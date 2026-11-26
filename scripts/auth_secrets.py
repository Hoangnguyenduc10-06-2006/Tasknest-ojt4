"""Generate local auth secrets; never print or rotate them implicitly."""
import base64
import secrets
import subprocess


def generate_rsa_private_key():
    pem = subprocess.run(['openssl', 'genpkey', '-algorithm', 'RSA', '-pkeyopt', 'rsa_keygen_bits:2048'],
                         capture_output=True, check=True).stdout
    der = subprocess.run(['openssl', 'pkcs8', '-topk8', '-nocrypt', '-outform', 'DER'],
                         input=pem, capture_output=True, check=True).stdout
    return base64.b64encode(der).decode('ascii')


def generate_auth_secrets():
    return {
        'TASKNEST_PROXY_KEY': secrets.token_hex(32),
        'IDENTITY_JWT_PRIVATE_KEY_BASE64': generate_rsa_private_key(),
        'IDENTITY_OUTBOX_KEY_BASE64': base64.b64encode(secrets.token_bytes(32)).decode('ascii'),
        'IDENTITY_OUTBOX_KEY_ID': 'outbox-' + secrets.token_hex(8),
    }
