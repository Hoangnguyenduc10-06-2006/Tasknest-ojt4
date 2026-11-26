"""Profile persistence/security checks against the disposable auth stack."""
import base64
import struct
import zlib


def png():
    def chunk(kind, data):
        return struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',1,1,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b'\x00\x50\x60\x70'))+chunk(b'IEND',b'')


def check_profile(auth, access):
    initial=auth.expect_status(auth.request('/api/identity/auth/session',access_token=access),200)[1]['data']
    payload={'fullName':'Profile Updated','jobTitle':'Fullstack Developer','bio':'Persistent profile',
             'version':initial['version'],'avatarBase64':base64.b64encode(png()).decode(),
             'userId':'someone-else','email':'forged@example.test','emailVerified':False}
    auth.expect_status(auth.request('/api/identity/profile',payload,method='PUT',csrf=False),403)
    auth.expect_status(auth.request('/api/identity/profile',payload,method='PUT',access_token=access,origin='https://foreign.example.test'),403)
    auth.expect_status(auth.request('/api/identity/profile',payload,method='PUT'),401)
    saved=auth.expect_status(auth.request('/api/identity/profile',payload,method='PUT',access_token=access),200)[1]['data']
    assert saved['email']==auth.email and saved['emailVerified'] is True and saved['id']==initial['id']
    assert saved['hasAvatar'] and saved['version']>initial['version']
    reloaded=auth.expect_status(auth.request('/api/identity/auth/session',access_token=access),200)[1]['data']
    assert (reloaded['fullName'],reloaded['jobTitle'],reloaded['bio'])==('Profile Updated','Fullstack Developer','Persistent profile')
    auth.expect_status(auth.request('/api/identity/profile',payload,method='PUT',access_token=access),409)
    bad={**payload,'version':saved['version'],'fullName':'Must not persist','avatarBase64':base64.b64encode(b'<svg/>').decode()}
    auth.expect_status(auth.request('/api/identity/profile',bad,method='PUT',access_token=access),400)
    assert auth.request('/api/identity/auth/session',access_token=access)[1]['data']['fullName']=='Profile Updated'
    avatar=auth.expect_status(auth.request('/api/identity/profile/avatar',access_token=access),200)
    assert avatar[1].startswith(b'\x89PNG')
    auth.expect_status(auth.request('/api/identity/profile/avatar'),401)
    cover='/api/identity/profile/cover'
    public_cover='/api/identity/public/covers/'+initial['id']
    cover_payload={'imageBase64':base64.b64encode(png()).decode(), 'visible':False}
    auth.expect_status(auth.request(cover),401)
    auth.expect_status(auth.request(cover,cover_payload,method='PUT',access_token=access,origin='https://foreign.example.test'),403)
    auth.expect_status(auth.request(cover,cover_payload,method='PUT',access_token=access),204)
    assert auth.expect_status(auth.request(cover,access_token=access),200)[1].startswith(b'\x89PNG')
    auth.expect_status(auth.request(public_cover),404)
    auth.expect_status(auth.request(cover,{**cover_payload,'imageBase64':'PHN2Zz4='},method='PUT',access_token=access),400)
    auth.expect_status(auth.request(cover,{**cover_payload,'visible':True},method='PUT',access_token=access),204)
    assert auth.expect_status(auth.request(public_cover),200)[1].startswith(b'\x89PNG')
    auth.expect_status(auth.request(cover,method='DELETE',access_token=access),204)
    auth.expect_status(auth.request(public_cover),404)
    print('PASS: profile cover upload, validation, public visibility and removal',flush=True)
    print('PASS: profile text/avatar persist, verified identity cannot be overwritten, stale version 409, CSRF/Origin/auth and invalid image rollback',flush=True)
