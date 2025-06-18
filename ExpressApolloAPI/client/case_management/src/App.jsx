import React from 'react';
import { ApolloClient, InMemoryCache, ApolloProvider } from '@apollo/client';
import './App.css';

const client = new ApolloClient({
  uri: 'http://localhost:8000/graphql',
  cache: new InMemoryCache(),
});

export default function App() {
  return (
    <ApolloProvider client={client}>
      <div style={{ padding: 20, maxWidth: 900, margin: 'auto' }}>
        <h1>Case Management</h1>
      </div>
    </ApolloProvider>
  );
}
