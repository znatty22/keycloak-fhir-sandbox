// Log = {
//   info: (msg) => console.info(msg),
//   warn: (msg) => console.warn(msg),
//   error: (msg) => console.error(msg),
// };

function permissionFromHttpOp(httpOp) {
  /*
   * Translate an HTTP operation like GET, PUT, etc to one of the following
   * permissions: read, write, delete
   *
   * If we don't recognize the HTTP operation, then return null
   * */
  switch (httpOp) {
    case "GET":
      action = "read";
      break;
    case "POST":
      action = "write";
      break;
    case "PUT":
      action = "write";
      break;
    case "PUT":
      action = "write";
      break;
    case "DELETE":
      action = "delete";
      break;
    default:
      action = null;
  }
  return action;
}

function validateConsentGrants(consentGrants) {
  /*
   * Validate the consentGrants object
   *
   * Schema:
   * {
   *  all: {
   *    read: boolean,
   *    write: boolean,
   *    delete: boolean
   *  },
   *  study: {
   *    [study_id (optional)]: {
   *      read: boolean,
   *      write: boolean,
   *      delete: boolean
   *    }
   *  },
   *  ...
   * }
   * */
  function checkActions(grantObj) {
    // Ensure a consent grant has a boolean value for each of the valid actions
    let validActions = ["read", "write", "delete"];
    return (
      validActions.every((a) => Object.keys(grantObj).includes(a)) &&
      Object.values(grantObj).every((consent) => typeof consent === "boolean")
    );
  }
  valid =
    typeof consentGrants === "object" &&
    "all" in consentGrants &&
    "study" in consentGrants &&
    checkActions(consentGrants.all);

  if (
    typeof consentGrants.study === "object" &&
    Object.keys(consentGrants.study).length > 0
  ) {
    valid =
      valid &&
      Object.values(consentGrants.study).every((study) => checkActions(study));
  }

  return valid;
}

function isAuthorizedStudyResource(consentGrants, action, theResource) {
  /*
   * Check if the user is authorized to access theResource or create
   * theResource (in the case that it does not exist yet)
   *
   * To access the FHIR resource, ALL of the study_ids in
   * the resource's tag list must be included in the user's authorized
   * study list
   *
   * The only exception to this is if a new FHIR resource is being created
   * and it has no tags. Users are allowed to create and view any FHIR resources
   * that have 0 study tags
   * */

  // *NOTE: Unfortunately Smile CDR requires that the elements in the tags
  // array is only accessed by index so .filter and .every functions
  // do not work here

  Log.info(
    `Evaluate resource ${theResource.resourceType}/${
      theResource.id
    } with tags: ${JSON.stringify(theResource.meta.tag)}`
  );

  // Get study ids for the authorized action
  studyIds = Object.entries(consentGrants.study)
    .filter(([_, grants]) => grants[action])
    .map(([studyId, _]) => studyId);

  // Check that authorized study IDs are ALL part of the resource's tag list
  count = 0;
  for (var i in theResource.meta?.tag) {
    let tag = theResource.meta?.tag[i];
    if (tag.system !== "urn:study_id") {
      continue;
    }
    if (studyIds.includes(tag.code)) {
      count++;
    }
  }
  return count === theResource.meta.tag.length;
}

/**
 * If present, this function is called before every request. It serves two
 * primary purposes:
 *
 * 1. It can be used to proactively determine that a request does not need
 *    to have the consent service applied to it. This is good for
 *    performance, since applying the consent service has performance
 *    implications.
 * 2. It can be used to proactively load consent directives, user
 *    information, etc. that will be used in future methods.
 *
 * @param theRequestDetails  Contains details about the request (e.g. the
 *                           FHIR operation being performed, the HTTP method,
 *                           the URL, etc.
 * @param theUserSession     Contains details about the logged in user and
 *                           their session.
 * @param theContextServices Contains various utility methods for accessing
 *                           relevant information about the request, as well
 *                           as providing a response.
 * @param theClientSession   Contains details about the OIDC client and
 *                           their OAuth2 session.
 */
function consentStartOperation(
  theRequestDetails,
  theUserSession,
  theContextServices,
  theClientSession
) {
  Log.info("******** consentStartOperation ******** ");
  // For superusers, we will skip the rest of the consent service entirely
  if (theUserSession != null && theUserSession.hasAuthority("ROLE_SUPERUSER")) {
    Log.info("User has role ROLE_SUPERUSER. Proceeding forward");
    theContextServices.authorized();
    return;
  }

  // If user has appropriate role, proceed to next step in consent pipeline
  roles = [
    "ROLE_FHIR_CLIENT_SUPERUSER",
    "ROLE_FHIR_CLIENT_SUPERUSER_RO",
    "FHIR_ALL_READ",
    "FHIR_ALL_WRITE",
    "FHIR_ALL_DELETE",
  ];
  if (
    theUserSession != null &&
    roles.some((role) => theUserSession.hasAuthority(role))
  ) {
    Log.info(
      "User has at least one of the authorized roles. Proceeding forward"
    );
    theContextServices.proceed();
    return;
  }
  Log.info(
    "User has not been assigned any of the acceptable roles necessary for consent authorization"
  );
  theContextServices.reject();
}

/**
 * If present, this function is called before every resource that may be returned
 * to the user.
 *
 * @param theRequestDetails  Contains details about the request (e.g. the
 *                           FHIR operation being performed, the HTTP method,
 *                           the URL, etc.
 * @param theUserSession     Contains details about the logged in user and
 *                           their session.
 * @param theContextServices Contains various utility methods for accessing
 *                           relevant information about the request, as well
 *                           as providing a response.
 * @package theResource      The resource that will be accessed.
 * @param theClientSession   Contains details about the OIDC client and
 *                           their OAuth2 session.
 */
function consentCanSeeResource(
  theRequestDetails,
  theUserSession,
  theContextServices,
  theResource,
  theClientSession
) {
  Log.info("******** consentCanSeeResource ******** ");

  // Translate HTTP operation to permission
  httpOp = String(theRequestDetails.requestType);
  action = permissionFromHttpOp(httpOp);
  if (!action) {
    Log.info(`REJECT - Unrecognized HTTP operation ${String(httpOp)}`);
    theContextServices.reject();
    return;
  }
  Log.info(`Requesting ${httpOp.toUpperCase()} operation`);

  // Extract consent authorizations from user session
  try {
    consentGrants = JSON.parse(theUserSession.userData?.consentGrants);
  } catch (e) {
    Log.error(
      "Consent authorizations in UserSession.userData has malformed JSON string. Could not parse"
    );
    theContextServices.reject();
    return;
  }

  // Validate consent grants
  try {
    validateConsentGrants(consentGrants);
  } catch (e) {
    Log.error(
      `Validation of consent grants failed: ${JSON.stringify(consentGrants)}`
    );
    theContextServices.reject();
    return;
  }

  Log.info(`Validated consent grants: ${JSON.stringify(consentGrants)}`);

  // No access due to no permissions
  if (
    consentGrants.study?.length === 0 &&
    Object.values(consentGrants.all).every((val) => !val)
  ) {
    Log.info("Not authorized to access any studies yet");
    theContextServices.reject();
    return;
  }

  // Super user blanket access - read/write/delete all,
  if (consentGrants.all[action]) {
    Log.info(`Authorized to ${action} ALL studies`);
    theContextServices.authorized();
    return;
  }

  // Study specific access
  if (isAuthorizedStudyResource(consentGrants, action, theResource)) {
    Log.info(
      `Authorized to ${action} specific studies, according to consent grants: \n${JSON.stringify(
        consentGrants
      )}`
    );
    theContextServices.authorized();
    return;
  }

  Log.info("Insufficient authorization to access FHIR resources");
  theContextServices.reject();
  return;
}

// ******************************** TEST ********************************
request = {
  requestType: "POST",
};
resource = {
  resourceType: "Patient",
  id: "P1",
  meta: {
    tag: [
      {
        system: "urn:study_id",
        code: "SD-1",
      },
      {
        system: "urn:study_id",
        code: "SD-0",
      },
    ],
  },
};
context = {
  authorized: function () {
    // console.log("Authorized!!!");
  },
  reject: function () {
    // console.log("403 Forbidden!!!");
  },
  proceed: function () {
    // console.log("Proceeding to consent can see resource");
  },
};
user = {
  roles: ["FHIR_ALL_READ", "FHIR_ALL_WRITE"],
  userData: JSON.stringify({
    all: {
      read: false,
      write: false,
      delete: false,
    },
    study: {
      "SD-0": {
        read: true,
        write: false,
        delete: false,
      },
      "SD-1": {
        read: true,
        write: true,
        delete: false,
      },
    },
  }),
  hasAuthority: function (role) {
    return this.roles.includes(role);
  },
};

consentStartOperation(request, user, context);
consentCanSeeResource(request, user, context, resource);
