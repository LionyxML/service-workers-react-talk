import { useState } from "react";
import "./App.css";
import { useEffect } from "react";

function App() {
  const [quote, setQuote] = useState("Loading...");

  useEffect(() => {
    fetch("https://official-joke-api.appspot.com/random_joke")
      .then((r) => r.json())
      .then((j) => setQuote(`${j?.setup} - ${j?.punchline}`))
      .catch(() => setQuote("❌ Error fetching quote."));
  }, []);

  return (
    <>
      <div></div>
      <h1>App1 - Common React App</h1>
      <div className="card">
        <p>{quote}</p>
      </div>
      <button onClick={() => window.location.reload()}>Reload Page</button>
    </>
  );
}

export default App;
