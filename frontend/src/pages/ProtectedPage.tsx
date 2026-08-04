import type { CurrentUser } from "../api/auth";

interface ProtectedPageProps {
  user: CurrentUser;
}

export function ProtectedPage({ user }: ProtectedPageProps) {
  return (
    <main>
      <h1>Bem-vindo, {user.name}</h1>
      <p>{user.email}</p>
    </main>
  );
}
