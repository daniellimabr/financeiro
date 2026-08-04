import { useCurrentUser } from "./hooks/useCurrentUser";
import { LoginPage } from "./pages/LoginPage";
import { ProtectedPage } from "./pages/ProtectedPage";

function App() {
  const { data: user, isLoading, isError } = useCurrentUser();

  if (isLoading) {
    return <p>Carregando...</p>;
  }

  if (isError || !user) {
    return <LoginPage />;
  }

  return <ProtectedPage user={user} />;
}

export default App;
