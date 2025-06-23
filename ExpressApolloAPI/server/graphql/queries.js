const { gql } = require("graphql-request");

const GET_INCIDENTS = gql`
  query {
    incidents(orderBy: created_at, orderMode: desc, first: 50) {
      edges {
        node {
          id
          alert_id
          alert_name
          alert_status
          case_result
          notes {
            edges {
              node {
                id
                action
                content
                created_at
              }
            }
          }
        }
      }
    }
  }
`;

const GET_INCIDENT_BY_ID = gql`
  query ($id: String!) {
    incident(id: $id) {
      id
      alert_id
      alert_name
      alert_status
      case_result
      notes {
        edges {
          node {
            id
            action
            content
            created_at
          }
        }
      }
    }
  }
`;

// GraphQL query - users list
const USERS_QUERY = gql`
  query {
    users {
      edges {
        node {
          id
          name
          user_email
          account_status
        }
      }
    }
  }
`;

module.exports = {
  GET_INCIDENTS,
  GET_INCIDENT_BY_ID,
  USERS_QUERY,
};
