Log = {
  info: (msg) => console.info(msg),
  warn: (msg) => console.warn(msg),
  error: (msg) => console.error(msg),
};

function handleBasicAuthRequest(theOutcome, theOutcomeFactory, theContext) {
  /*
   * Assign appropriate FHIR role and consent grants based on the authenticated
   * user data
   *
   * Extract the fhir claims from the authenticated user.notes
   * Determine which consent grants should be assigned
   * Add FHIR consent grants to user session userData
   * Return user session object
   */
  Log.info("******* Basic Auth - onAuthenticateSuccess ******* ");

  return {
    theOutcome,
    theOutcomeFactory,
    theContext,
  };
}
function handleOAuth2Request(theOutcome, theOutcomeFactory, theContext) {
  /*
   * Assign appropriate FHIR role and consent grants based on the authenticated
   * user data
   *
   * Extract the fhir claims from the authenticated user's access token
   * Determine which FHIR role should be assigned
   * Determine which consent grants should be assigned
   * Add FHIR role to user session authorities
   * Add FHIR consent grants to user session userData
   * Return user session object
   */
  Log.info("******* OIDC Auth - onAuthenticateSuccess ******* ");

  // Temporary
  theOutcome.addAuthority("ROLE_FHIR_CLIENT_SUPERUSER_RO");

  fhirClaims = theContext.getClaim("fhir");
  Log.info(JSON.stringify(fhirClaims));

  return {
    theOutcome,
    theOutcomeFactory,
    theContext,
  };
}
function onAuthenticateSuccess(theOutcome, theOutcomeFactory, theContext) {
  /*
   * Assign appropriate FHIR role and consent grants based on the authenticated
   * user data
   *
   **** OIDC User/Client ****
   * Extract the fhir claims from the authenticated user's access token
   * Determine which FHIR role should be assigned
   * Determine which consent grants should be assigned

   **** Smile CDR User ****
   * Extract the fhir claims from the authenticated user.notes
   * Determine which consent grants should be assigned
   * FHIR role should have already been assigned when user was created
   *
   * */

  Log.info("******* onAuthenticateSuccess ******* ");

  // Handle OAuth2/OIDC request
  if (typeof theContext.getClaim === "function") {
    result = handleOAuth2Request(theOutcome, theOutcomeFactory, theContext);

    // Handle Basic Auth request
  } else {
    result = handleBasicAuthRequest(theOutcome, theOutcomeFactory, theContext);
  }

  return result.theOutcome;
}

outcome = {
  role: "",
  addAuthority: function (role) {
    this.role = role;
  },
};
context = {
  fhir: [
    "fhir-role-fhir-client-superuser",
    "fhir-delete-study-all",
    "fhir-read-study-all",
    "fhir-write-study-all",
  ],
  getClaim: function () {
    return this.fhir;
  },
};

onAuthenticateSuccess(outcome, null, context);
