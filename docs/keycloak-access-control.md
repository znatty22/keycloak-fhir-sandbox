# Design

## Create Custom Roles for FHIR
1. Go to Realm Roles
2. Create whatever roles you want
    - fhir_read_study_all 
    - fhir_write_study_all 
    - fhir_read_study_SD-0

## Setup `fhir` Scope for Access Token
1. Go to Client Scopes
2. Create scope `fhir`
3. Add a mapper to scope
    - Add a mapper for User Realm Roles
    - Set realm role prefix to `fhir_`
    - Set token claim path to `fhir.roles`
    - Select multi-valued

## Setup a new client with FHIR roles
1. Clients > Create Client
2. Enable Client Authentication
    - Select Service Account roles
3. After creation go to Service Account Roles tab
    - Assign the proper FHIR roles
4. Go to Client Scopes tab on Client page
    - Add the `fhir` scope and set it to Default
    - Set other unecessary scopes to Optional

# Keycloak Concepts

- A realm is a tenant

## Roles
- A realm can have a set of roles
- A role is a string or a collection of attributes or key-value pairs which represent
permissions
- A role can be assigned to one or more users or clients
- You can combine roles, this is known as a composite role
    - A composite role inherits all of the role permissions of its individual roles

## Users
- Users are assigned roles via role mappings
- On creation of an OIDC access token, you can configure the user role mappings
so that the roles become claims in the token

## Clients
- You assign roles to a client via the client's associated service account user
- You can create a custom scope like `fhir` and then create role mappings to 
add those roles ^ to that client's scope
- Then you can add that scope to a client so that the access token will have it
```
# Access Token
{
    "iss": "http://keycloak.com/realms/fhir",
    ...
    "fhir": [
        "fhir-read-study-all"
    ]
}
``` 

## Groups
- Groups and roles have some similarities and differences.
- Groups are a collection of users to which you apply roles and attributes
- Roles define types of users and applications assign permissions and 
access control to roles
- Groups could be used to control access to organization data?

