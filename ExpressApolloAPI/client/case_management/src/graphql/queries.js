import { gql } from "@apollo/client";

export const GET_CASELIST = gql`
  query {
    users {
      edges {
        node {
          id
          name
          user_email
        }
      }
    }
  }
`;
