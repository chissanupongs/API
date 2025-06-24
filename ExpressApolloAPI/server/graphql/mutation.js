import { gql } from "graphql-request";

// 🔁 Mutation สำหรับเปลี่ยนสถานะ account
export const UPDATE_USER_STATUS = gql`
  mutation unlockAccount($id: ID!) {
    unlockAccount(id: $id) {
      id
      user_email
      account_status
    }
  }
`;

export const INCIDENT_EDIT_MUTATION = gql`
  mutation IncidentEdit($id: ID!, $input: [EditInput]!) {
    incidentEdit(id: $id) {
      fieldPatch(input: $input) {
        id
        alert_id
        alert_name
        alert_status
        case_result
      }
    }
  }
`;

export const NOTE_ADD_MUTATION = gql`
  mutation NoteAdd($input: NoteAddInput!) {
    noteAdd(input: $input) {
      id
      action
      content
    }
  }
`;