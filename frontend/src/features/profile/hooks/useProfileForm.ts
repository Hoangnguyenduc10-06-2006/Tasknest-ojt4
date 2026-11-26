import { useEffect, useRef, useState } from 'react';
import { saveProfile, loadAvatar } from '../api/profile.api';
import type { SessionUser } from '../../auth';
import { ApiError } from '../../../shared/api/client';
import {
  validateAvatar,
  validateProfile,
  type ProfileErrors,
  type ProfileValues,
} from '../model/profile.validation';

export function useProfileForm(user: SessionUser) {
  const [values, setValues] = useState<ProfileValues>(() => ({
    fullName: user.fullName,
    jobTitle: user.jobTitle || '',
    bio: user.bio || '',
  }));
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [version, setVersion] = useState(user.version);
  const [selectedPhoto, setSelectedPhoto] = useState<File>();
  const [avatarPublic, setAvatarPublic] = useState(user.avatarPublic ?? false);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [photo, setPhoto] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [message, setMessage] = useState('');
  const [readingPhoto, setReadingPhoto] = useState(false);
  const selection = useRef(0);
  useEffect(
    () => () => {
      selection.current++;
    },
    [],
  );
  useEffect(() => {
    let active = true;
    const photoVersion = selection.current;
    if (user.hasAvatar)
      void loadAvatar(user.id)
        .then((blob) => {
          if (active && selection.current === photoVersion)
            setPhoto(URL.createObjectURL(blob));
        })
        .catch(() => {
          if (active)
            setPhotoError(
              'Không thể tải ảnh đại diện. Vui lòng thử tải lại trang.',
            );
        });
    return () => {
      active = false;
    };
  }, [user.id, user.hasAvatar]);
  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo);
    },
    [photo],
  );
  function update(field: keyof ProfileValues, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setMessage('');
  }
  async function choosePhoto(file?: File) {
    if (!file) return;
    const version = ++selection.current;
    setReadingPhoto(true);
    setPhotoError('');
    setMessage('');
    let url = '';
    try {
      const error = await validateAvatar(file);
      if (version !== selection.current) return;
      if (error) {
        setPhotoError(error);
        return;
      }
      url = URL.createObjectURL(file);
      const image = new Image();
      image.src = url;
      await image.decode();
      if (version !== selection.current) return;
      setPhoto(url);
      setSelectedPhoto(file);
      url = '';
    } catch {
      if (version === selection.current)
        setPhotoError('Không thể đọc ảnh. Vui lòng chọn ảnh khác.');
    } finally {
      if (url) URL.revokeObjectURL(url);
      if (version === selection.current) setReadingPhoto(false);
    }
  }
  async function save() {
    if (busy.current) return;
    const nextErrors = validateProfile(values);
    setErrors(nextErrors);
    setMessage('');
    if (Object.keys(nextErrors).length > 0) return;
    if (version === undefined) {
      setMessage('Không thể tải phiên bản hồ sơ. Vui lòng tải lại trang.');
      return;
    }
    busy.current = true;
    setSaving(true);
    try {
      const saved = await saveProfile(
        user.id,
        {
          fullName: values.fullName.trim(),
          jobTitle: values.jobTitle.trim(),
          bio: values.bio.trim(),
        },
        version,
        selectedPhoto,
        avatarPublic,
      );
      setVersion(saved.version);
      setSelectedPhoto(undefined);
      setValues({
        fullName: saved.fullName,
        jobTitle: saved.jobTitle || '',
        bio: saved.bio || '',
      });
      setMessage('Đã lưu hồ sơ thành công.');
      return saved;
    } catch (error) {
      setMessage(
        error instanceof ApiError && error.status === 409
          ? 'Hồ sơ đã được sửa ở nơi khác. Vui lòng tải lại trang trước khi lưu.'
          : error instanceof Error
            ? error.message
            : 'Không thể lưu hồ sơ. Vui lòng thử lại.',
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  return {
    avatarPublic,
    setAvatarPublic,
    values,
    errors,
    photo,
    photoError,
    readingPhoto,
    saving,
    message,
    update,
    choosePhoto,
    save,
  };
}
