export function retainedMentions(body: string, ids: string[], members: { id: string; name: string }[], self?: string) {
  return ids.filter(id => {
    if (id === self) return false;
    const member = members.find(item => item.id === id);
    if (!member) return false;
    const token = `@${member.name}`;
    let position = body.indexOf(token);
    while (position !== -1) {
      const after = body.slice(position + token.length);
      if (!after || !/^[\p{L}\p{N}_]/u.test(after)) return true;
      position = body.indexOf(token, position + 1);
    }
    return false;
  });
}
