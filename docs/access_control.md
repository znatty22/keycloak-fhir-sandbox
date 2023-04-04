# Example Access Control Use Cases

## Definitions

- A user is a human that will access the FHIR endpoint via a web application

- A client is a non-human that will access the FHIR endpoint via a script or 
piece of code


## Sign Up / Registration

- When a user or client is created, they will be be granted authority to take 
certain actions (HTTP GET, POST, etc.) on certain data 
(e.g. only Patients tagged with study ID SD_0).

- The actions they can take along with what data they can access should be 
encoded in a set of claims/scopes. 

- If using **OAuth2**, these claims would likely be part of the Bearer token 
granted by the Authority Server

- If **not using OAuth2**, these claims would be stored in the user object that 
the server manages.

### Example user with claims

```yaml
# A read-only, read-specific study user
read-only-user:
  all:
    read: false
    write: false
    delete: false
  studies:
    SD-0:
      read: true
      write: false
      delete: false
    SD-1:
      read: false
      write: false
      delete: false
```

```yaml
# A read-only, read-all study user
read-super-user:
  all:
    read: true
    write: false
    delete: false
  studies:
```

## Study Resources - Tags
- A resource belongs to a study if it contains the study ID in its
`Resource.meta.tag` field.

### Example
```json
{
  "resourceType": "Patient",
  "id": "PT-0-0",
  "identifier": [
    {
      "use": "official",
      "system": "https://app.dewrangle.com/fhir",
      "value": "PT-0-0"
    }
  ],
  "meta": {
    "tag": [
      {
        "code": "SD-0",
        "system": "urn:study_id",
        "display": "SD-0"
      }
    ]
  },
  "gender": "male"
}
```

## Policies

### Read All Policy

- Users or clients must be allowed to perform HTTP GET requests

- Users or clients can send GET requests to view *any* FHIR resource 

### Study Read Policy
- Users or clients must be allowed to perform HTTP GET requests

- When user or client sends a GET request to view FHIR resource(s), they may only view
resource(s) that are tagged with the study ID that they have access to. 

### Study Create/Update Policy
- Users or clients must be allowed to perform HTTP PUT/PATCH requests

- When user or client sends a GET request to view FHIR resource(s), they may only update
resource(s) that are tagged with the study ID that they have access to. 

- If it is an HTTP PUT and the resource does not exist yet, the user will be 
allowed to create the resource and tag it with a study ID it has access to. 

### Study Delete Policy
- Users or clients must be allowed to perform HTTP DELETE requests

- When user or client sends a GET request to view FHIR resource(s), they may only delete
resource(s) that are tagged with the study ID that they have access to. 

## Roles

### Super User
This represents an administrative user that should have authority to do most 
or all actions and have access to all of the data in the server

- Can do any HTTP operation on any FHIR resource 

### Read Only Super User
This represents sort of an overseer. Someone who is at the administrative level
and needs access to all FHIR data but does not want to intentionally or 
unintentionally mutate the data

- Read All Policy

### Study Viewer 
A user or client that only has read access to FHIR data. The viewer will only
be able to view FHIR resources that are linked to studies that the viewer 
has read access to

- Study Read Policy

### Ingest Client
An ingest client is a script or service that will need to create, update, and
potentially delete FHIR resources for one or more studies. The ingest client
should only be able to affect the resources for which it has been granted 
access

- Study Read Policy
- Study Create/Update Policy
- Study Delete Policy
