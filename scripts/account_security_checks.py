"""Recovery/session acceptance checks, only called in the disposable mail harness."""
import re
from auth_integration_checks import AuthChecks

def check_account_security(auth,schema,fake,wait):
    fake.status=201
    schema.sql('DELETE FROM auth_rate_limit_buckets;','identity')
    session=AuthChecks(auth.port,schema.sql);session.email=auth.email;session.password=auth.password
    session.request('/api/identity/status')
    login=session.expect_status(session.login(),200)[1]['data'];old=login['accessToken']
    items=session.expect_status(session.request('/api/identity/auth/sessions',access_token=old),200)[1]['data']
    assert any(x['id']==items['currentSessionId'] for x in items['items'])
    session.expect_status(session.request('/api/identity/auth/forgot-password',{'email':'unknown@example.test'}),200)
    session.expect_status(session.request('/api/identity/auth/forgot-password',{'email':auth.email}),200)
    wait(lambda:any('/reset-password?token=' in m['textContent'] and m['to'][0]['email']==auth.email for m in fake.messages),'reset email')
    mail=next(m for m in reversed(fake.messages) if '/reset-password?token=' in m['textContent'] and m['to'][0]['email']==auth.email)
    token=re.search(r'token=([A-Za-z0-9_-]+)',mail['textContent']).group(1)
    assert token not in schema.sql('SELECT payload FROM outbox_events;','identity')
    payload={'token':token,'newPassword':'Recovered-password-123','confirmPassword':'Recovered-password-123'}
    session.expect_status(session.request('/api/identity/auth/reset-password',payload),200)
    session.expect_status(session.request('/api/identity/auth/session',access_token=old),401)
    session.expect_status(session.request('/api/identity/auth/reset-password',payload),400)
    session.expect_status(session.login(),401)
    session.password=payload['newPassword']; login=session.expect_status(session.login(),200)[1]['data'];access=login['accessToken']
    session.expect_status(session.request('/api/identity/auth/change-password',{'currentPassword':'incorrect-password','newPassword':auth.password,'confirmPassword':auth.password},access_token=access),400)
    session.expect_status(session.request('/api/identity/auth/change-password',{'currentPassword':session.password,'newPassword':auth.password,'confirmPassword':auth.password},access_token=access,csrf=False),403)
    session.expect_status(session.request('/api/identity/auth/change-password',{'currentPassword':session.password,'newPassword':auth.password,'confirmPassword':auth.password},access_token=access),200)
    session.expect_status(session.request('/api/identity/auth/session',access_token=access),401)
    session.password=auth.password;access=session.expect_status(session.login(),200)[1]['data']['accessToken']
    listed=session.expect_status(session.request('/api/identity/auth/sessions',access_token=access),200)[1]['data']
    session.expect_status(session.request('/api/identity/auth/sessions/'+listed['currentSessionId']+'/revoke',{},access_token=access),200)
    session.expect_status(session.request('/api/identity/auth/session',access_token=access),401)
    access=session.expect_status(session.login(),200)[1]['data']['accessToken']
    session.expect_status(session.request('/api/identity/auth/logout-all',{},access_token=access),200)
    session.expect_status(session.request('/api/identity/auth/session',access_token=access),401)
    # Existing unverified identity must be recoverable, never overwritten by re-registering.
    body={'fullName':'Unverified recovery','email':'unverified-recovery@example.test','password':auth.password,'confirmPassword':auth.password}
    session.expect_status(session.request('/api/identity/auth/register',body),201)
    session.expect_status(session.request('/api/identity/auth/register',{**body,'password':'New-attacker-password','confirmPassword':'New-attacker-password'}),403)
    assert schema.sql("SELECT full_name FROM users WHERE email='unverified-recovery@example.test';",'identity')=='Unverified recovery'
    schema.sql('DELETE FROM auth_rate_limit_buckets;','identity')
    print('PASS: password reset email/token single-use, encrypted payload, session revocation, old password rejection, change password/CSRF, device list/revoke/logout-all and unverified registration recovery.',flush=True)
