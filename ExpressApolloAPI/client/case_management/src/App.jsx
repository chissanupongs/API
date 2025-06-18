import React from 'react';
import { ApolloClient, InMemoryCache, ApolloProvider } from '@apollo/client';
import './App.css';

const client = new ApolloClient({
  uri: 'http://192.168.150.236:32002/graphql',
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
