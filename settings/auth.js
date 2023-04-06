// Log = {
//   info: (msg) => console.info(msg),
//   warn: (msg) => console.warn(msg),
//   error: (msg) => console.error(msg),
// };

FHIR_CLAIM_PREFIX = "fhir-";
FHIR_CONSENT_CLAIM_PREFIX = "fhir-consent-";
FHIR_ROLE_CLAIM_PREFIX = "fhir-role-";

function parseConsentClaims(fhirConsentClaims) {
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
    fhirConsentClaims = JSON.parse(theContext.notes);
  } catch (e) {
    Log.error(
      "Consent authorizations in UserSession.notes has malformed JSON string. Could not parse"
    );
    Log.error(String(e));
  }
  // Create consent object from FHIR consent claims
  consentGrants = parseConsentClaims(
    fhirConsentClaims.filter((claim) =>
      claim.startsWith(FHIR_CONSENT_CLAIM_PREFIX)
    )
  );

  return consentGrants;
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

  fhirClaims = theContext.getClaim("fhir");
  fhirRoleClaims = fhirClaims.filter((claim) =>
    claim.startsWith(FHIR_ROLE_CLAIM_PREFIX)
  );
  fhirConsentClaims = fhirClaims.filter((claim) =>
    claim.startsWith(FHIR_CONSENT_CLAIM_PREFIX)
  );

  // Create FHIR role from FHIR role claims
  roles = fhirRoleClaims.map((role) => {
    formattedRole = role
      .replace(FHIR_CLAIM_PREFIX, "")
      .replaceAll("-", "_")
      .toUpperCase();
    try {
      theOutcome.addAuthority(formattedRole);
    } catch (e) {
      Log.warn(
        `Role ${role} is not recognized. Will not be added to user session`
      );
    }
    return formattedRole;
  });

  // Create consent object from FHIR consent claims
  consentGrants = parseConsentClaims(fhirConsentClaims);

  return {
    roles,
    consentGrants,
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

  // Bypass all if superuser
  if (theOutcome.hasAuthority("ROLE_SUPERUSER")) {
    Log.info(`User has role: ROLE_SUPERUSER. Proceeding forward`);
    return theOutcome;
  }

  roles = [];
  consentGrants = {};

  // Handle OAuth2/OIDC request
  if (typeof theContext.getClaim === "function") {
    ({ roles, consentGrants } = handleOAuth2Request(
      theOutcome,
      theOutcomeFactory,
      theContext
    ));

    // Handle Basic Auth request
  } else {
    consentGrants = handleBasicAuthRequest(
      theOutcome,
      theOutcomeFactory,
      theContext
    );
  }

  // Add roles to user session
  if (roles.length > 0) {
    roles.map((role) => theOutcome.addAuthority(role));
    Log.info(`Added FHIR roles to user session: ${JSON.stringify(roles)}`);
  } else {
    Log.info(
      `FHIR roles in user session: ${JSON.stringify(theOutcome.authorities)}`
    );
  }
  // Add consent grants to the user session
  theOutcome.setUserData("consentGrants", JSON.stringify(consentGrants));
  Log.info(
    `Added FHIR consent grants to user session: ${JSON.stringify(
      consentGrants
    )}`
  );

  return theOutcome;
}

outcome = {
  authorities: ["ROLE_FHIR_CLIENT_SUPERUSER"],
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
  notes: '["fhir-role-fhir-client-superuser", "fhir-consent-read-study|SD-0"]',
  fhir: [
    "fhir-role-fhir-client-superuser",
    // "fhir-consent-read-study|SD-0",
    "fhir-consent-write-study|SD-0",
    "fhir-consent-delete-study|SD-0",
    // "fhir-consent-delete-study|all",
    "fhir-consent-read-study|all",
    // "fhir-consent-write-study|all",
  ],
  getClaim: function () {
    return this.fhir;
  },
};

onAuthenticateSuccess(outcome, null, context);
