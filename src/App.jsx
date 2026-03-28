import { useAuth } from './hooks/useAuth';
import LoginOverlay from './components/Auth/LoginOverlay';

function App() {
  const { user, loading, login, logout } = useAuth();

  if (loading) return null;
  if (!user) return <LoginOverlay onLogin={login} />;

  return (
    <div style={{ padding: '2rem', color: '#ff7700', fontFamily: 'Orbitron' }}>
      VAULT — authenticated as {user.email}
      <button onClick={logout} style={{ marginLeft: '1rem' }}>Logout</button>
    </div>
  );
}

export default App;
