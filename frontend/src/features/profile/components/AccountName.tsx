import { useSession } from '../../auth';

export function AccountName({ userId, name }: { userId: string; name: string }) {
  const session = useSession();
  const self = session.status === 'authenticated' && session.user.id === userId;
  return <span title={name}>{self ? 'Bạn' : name}</span>;
}
