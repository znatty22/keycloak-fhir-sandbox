Log = {
  info: (msg) => console.info(msg),
  warn: (msg) => console.warn(msg),
  error: (msg) => console.error(msg),
};

FHIR_CLAIM_PREFIX = "fhir-";
FHIR_CONSENT_CLAIM_PREFIX = "fhir-consent-";
FHIR_ROLE_CLAIM_PREFIX = "fhir-role-";

function extractFhirClaims(theContext) {
  /*
   * Extract FHIR roles and consent grants from the access token
   *
   * Need to account for different versions of Keycloak since the claims
   * are stored differently
   * */
  fhirRoleClaims = theContext.getClaim("fhir_roles");
  fhirConsentClaims = theContext.getClaim("fhir_consent_grants");

  // For current version of Keycloak (21)
  if (fhirRoleClaims && fhirConsentClaims) {
    fhirConsentClaims = fhirConsentClaims.filter((claim) =>
      claim.startsWith(FHIR_CONSENT_CLAIM_PREFIX)
    );

    fhirRoleClaims = fhirRoleClaims.filter((claim) =>
      claim.startsWith(FHIR_ROLE_CLAIM_PREFIX)
    );

    // For backwards compatibility with older Keycloak versions (14)
  } else {
    fhirClaims = theContext.getClaim("fhir");
    fhirConsentClaims = fhirClaims.filter((claim) =>
      claim.startsWith(FHIR_CONSENT_CLAIM_PREFIX)
    );

    fhirRoleClaims = fhirClaims.filter((claim) =>
      claim.startsWith(FHIR_ROLE_CLAIM_PREFIX)
    );
  }
  return {
    fhirRoleClaims,
    fhirConsentClaims,
  };
}

function createConsentGrantObj(fhirConsentClaims) {
  /*
   * Create consent object from list of FHIR consent claim strings
   *
   * */
  addedConsents = {
    all: {
      read: false,
      write: false,
      delete: false,
    },
    study: {},
  };
  consents = fhirConsentClaims.map((consentClaim) => {
    [key, identifier] = consentClaim
      .replace(FHIR_CONSENT_CLAIM_PREFIX, "")
      .split("|");
    [action, entityType] = key.split("-");
    if (identifier === "all") {
      addedConsents.all[action] = true;
    } else {
      identifier in addedConsents.study ||
        (addedConsents.study[identifier] = {
          read: false,
          write: false,
          delete: false,
        });
      addedConsents.study[identifier][action] = true;
    }
    return consentClaim;
  });

  return addedConsents;
}

function addConsentGrantsToSession(consentGrants, theOutcome) {
  // Add consent grants to the user session
  if (consentGrants) {
    theOutcome.setUserData("consentGrants", JSON.stringify(consentGrants));
    Log.info(
      `Added FHIR consent grants to user session: ${JSON.stringify(
        consentGrants
      )}`
    );
  }
  return theOutcome;
}

function handleBasicAuthRequest(theOutcome, theOutcomeFactory, theContext) {
  /*
   * Assign appropriate FHIR role and consent grants based on the authenticated
   * user data
   *
   * Extract the fhir claims from the authenticated user.notes
   * Determine which consent grants should be assigned
   */
  Log.info("******* Handle Basic Auth *******");

  // Extract FHIR consent claims from user.notes in user session

  try {
    fhirConsentClaims = JSON.parse(theOutcome.notes);
  } catch (e) {
    Log.error(
      "Consent authorizations in UserSession.notes has malformed JSON string. Could not parse"
    );
    Log.error(String(e));

    // Create a failure object to return
    var failure = theOutcomeFactory.newFailure();

    // The following properties are optional
    failure.message =
      "Failed to extract consent authorizations from user session";
    failure.unknownUsername = false;
    failure.incorrectPassword = false;

    return failure;
  }
  fhirConsentClaims = fhirConsentClaims.fhir_consent_grants.filter((claim) =>
    claim.startsWith(FHIR_CONSENT_CLAIM_PREFIX)
  );

  // Create consent object from FHIR consent claims
  consentGrants = createConsentGrantObj(fhirConsentClaims);

  // Add consent grants to user session
  addConsentGrantsToSession(consentGrants, theOutcome);
}
function handleOAuth2Request(theOutcome, theOutcomeFactory, theContext) {
  /*
   * Assign appropriate FHIR role and consent grants based on the authenticated
   * user data
   *
   * Extract the fhir claims from the authenticated user's access token
   * Determine which FHIR role should be assigned
   * Determine which consent grants should be assigned
   */
  Log.info("******* Handle OIDC Auth ******* ");

  // Extract fhir claims from token
  ({ fhirRoleClaims, fhirConsentClaims } = extractFhirClaims(theContext));

  // Create Smile CDR role from FHIR role claims
  // Add to user session
  roles = fhirRoleClaims.map((role) => {
    formattedRole = role
      .replace(FHIR_CLAIM_PREFIX, "")
      .replaceAll("-", "_")
      .toUpperCase();
    return formattedRole;
  });

  // Add roles to user session
  if (roles.length > 0) {
    roles.map((role) => {
      try {
        theOutcome.addAuthority(role);
      } catch (e) {
        Log.warn(
          `Role ${role} is not recognized. Will not be added to user session`
        );
      }
    });
  }

  // Create consent object from FHIR consent claims
  consentGrants = createConsentGrantObj(fhirConsentClaims);

  // Add consent grants to user session
  addConsentGrantsToSession(consentGrants, theOutcome);
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

  // Bypass all if superuser
  if (theOutcome.hasAuthority("ROLE_SUPERUSER")) {
    Log.info(`User has role: ROLE_SUPERUSER. Proceeding forward`);
    return theOutcome;
  }

  // Handle OAuth2/OIDC request
  if (typeof theContext.getClaim === "function") {
    theOutcome = handleOAuth2Request(theOutcome, theOutcomeFactory, theContext);

    // Handle Basic Auth request
  } else {
    handleBasicAuthRequest(theOutcome, theOutcomeFactory, theContext);
  }
  Log.info(
    `Roles in user session: ${JSON.stringify(
      theOutcome.authorities.map((a) => String(a))
    )}`
  );

  return theOutcome;
}

outcome = {
  authorities: ["ROLE_FHIR_CLIENT_SUPERUSER"],
  notes: JSON.stringify({
    fhir_consent_grants: [
      "fhir-consent-write-study|SD-0",
      "fhir-consent-delete-study|SD-0",
      "fhir-consent-read-study|all",
    ],
  }),
  hasAuthority: function (role) {
    return this.authorities.includes(role);
  },
  addAuthority: function (role) {
    this.authorities = [role, ...this.authorities];
  },
  setUserData: function (userData) {
    this.userData = userData;
  },
};
context = {
  userData: "",
  fhir: [
    "fhir-role-fhir-client-superuser",
    "fhir-consent-write-study|SD-0",
    "fhir-consent-delete-study|SD-0",
    "fhir-consent-read-study|all",
  ],
  fhir_consent_grants: [
    // "fhir-consent-read-study|SD-0",
    "fhir-consent-write-study|SD-0",
    "fhir-consent-delete-study|SD-0",
    // "fhir-consent-delete-study|all",
    "fhir-consent-read-study|all",
    // "fhir-consent-write-study|all",
  ],
  fhir_roles: ["fhir-role-fhir-client-superuser_ro"],
  // getClaim: function (claim) {
  //   return this[claim];
  // },
};

factory = {
  newFailure: function () {
    return {};
  },
};

onAuthenticateSuccess(outcome, factory, context);
