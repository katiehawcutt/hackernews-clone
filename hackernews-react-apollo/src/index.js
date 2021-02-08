import React from "react";
import ReactDOM from "react-dom";
import "./styles/index.css";
import App from "./components/App";
import { AUTH_TOKEN } from "./constants";
import { BrowserRouter } from "react-router-dom";
import { setContext } from "@apollo/client/link/context";
import { split } from "@apollo/client";
import { WebSocketLink } from "@apollo/client/link/ws";
import { getMainDefinition } from "@apollo/client/utilities";

//import all the dependencies we need to wire up the Apollo client, all from @apollo/client
import {
  ApolloProvider,
  ApolloClient,
  createHttpLink,
  InMemoryCache,
} from "@apollo/client";

// create the httpLink that will connect our ApolloClient instance with the GraphQL API. The GraphQL server will be running on http://localhost:4000.
const httpLink = createHttpLink({
  uri: "http://localhost:4000",
});

// This middleware will be invoked every time ApolloClient sends a request to the server. Apollo Links allow us to create middlewares that modify requests before they are sent to the server. We get the authentication token from localStorage if it exists; after that, we return the headers to the context so httpLink can read them.
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem(AUTH_TOKEN);
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    },
  };
});

// instantiate a WebSocketLink that knows about the subscriptions endpoint. The subscriptions endpoint in this case is similar to the HTTP endpoint, except that it uses the ws (WebSocket) protocol instead of http. Notice that we’re also authenticating the WebSocket connection with the user’s token that we retrieve from localStorage.
const wsLink = new WebSocketLink({
  uri: `ws://localhost:4000/graphql`,
  options: {
    reconnect: true,
    connectionParams: {
      authToken: localStorage.getItem(AUTH_TOKEN),
    },
  },
});

// split is used to “route” a request to a specific middleware link. It takes three arguments, the first one is a test function which returns a boolean. The remaining two arguments are again of type ApolloLink. If test returns true, the request will be forwarded to the link passed as the second argument. If false, to the third one.
// In our case, the test function is checking whether the requested operation is a subscription. If it is, it will be forwarded to the wsLink, otherwise (if it’s a query or mutation), the authLink.concat(httpLink) will take care of it

const link = split(
  ({ query }) => {
    const { kind, operation } = getMainDefinition(query);
    return kind === "OperationDefinition" && operation === "subscription";
  },
  wsLink,
  authLink.concat(httpLink)
);

// instantiate ApolloClient by passing in the httpLink and a new instance of an InMemoryCache
const client = new ApolloClient({
  link,
  cache: new InMemoryCache(),
});

// render the root component of our React app. The App is wrapped with the higher-order component ApolloProvider that gets passed the client as a prop.
ReactDOM.render(
  <BrowserRouter>
    <ApolloProvider client={client}>
      <App />
    </ApolloProvider>
  </BrowserRouter>,
  document.getElementById("root")
);
