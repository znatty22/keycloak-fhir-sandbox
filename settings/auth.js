function onAuthenticateSuccess(theOutcome, theOutcomeFactory, theContext) {
  theOutcome.addAuthority('ROLE_FHIR_CLIENT_SUPERUSER_RO');
  Log.info("!!!!!!!! Authentication Success !!!!!!!!")
	return theOutcome;
}
