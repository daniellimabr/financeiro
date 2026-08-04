import { GOOGLE_LOGIN_URL } from "../api/auth";

export function LoginPage() {
  return (
    <main>
      <h1>Financeiro</h1>
      <a href={GOOGLE_LOGIN_URL}>Entrar com Google</a>
    </main>
  );
}
