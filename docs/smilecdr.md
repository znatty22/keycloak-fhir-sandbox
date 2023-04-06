# Smile CDR Auth Design

## Basic Auth

- Create user and store FHIR role in user.authorities
- Store FHIR consent grants in user.notes as a JSON string

### `onAuthenticateSuccess` function

- If the request was a basic auth request
    - Extract fhir claims from user.notes
    - Create the consent grants object and add to userSession.userData

## OIDC Auth 

- Create client/user Keycloak
- Assign FHIR role and consent grants to client/user 
- Create a `fhir` scope with ^ and add it to all access tokens
- Now FHIR role and consent grants will show up in access token under the `fhir`
scope

### `onAuthenticateSuccess` function

- If the request was an OIDC request
    - Extract fhir claims from the access token
    - Create the appropriate FHIR role and add to user.authorities
    - Create the consent grants object and add to userSession.userData
