import { Dashboard } from "./components/Dashboard";

function App() {
  // Test için örnek bir userId gönderiyoruz
  const testUserId = "11111111-1111-1111-1111-111111111111";

  return (
    <div>
      <Dashboard userId={testUserId} />
    </div>
  );
}

export default App;