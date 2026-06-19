import React, { useState, useEffect } from 'react';

export function App() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    document.title = `Count: ${count}`;
  }, [count]);

  return (
    <div>
      <h1>Counter</h1>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}
