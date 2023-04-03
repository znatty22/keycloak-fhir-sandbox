#!/usr/bin/env python

import os
import json
import argparse
from pprint import pprint
from pathlib import Path

import requests
from requests.auth import HTTPBasicAuth
# from dotenv import find_dotenv, load_dotenv

# DOTENV_PATH = find_dotenv()
# if DOTENV_PATH:
#     load_dotenv(DOTENV_PATH)

KEYCLOAK_DEV_DOMAIN = "http://localhost:8080/realms/master"
KEYCLOAK_DEV_CLIENT_ID = "client"
KEYCLOAK_DEV_CLIENT_SECRET = "LrPqhm2dbY8sWQnRjjUDutnW3Mp9PtyF"

SMILECDR_FHIR_ENDPOINT = "http://localhost:4000"
SMILECDR_AUDIENCE = "https://kf-api-fhir-smilecdr-dev.org"

domain = KEYCLOAK_DEV_DOMAIN
client_id = KEYCLOAK_DEV_CLIENT_ID
client_secret = KEYCLOAK_DEV_CLIENT_SECRET
send_req = True


def request(method, *args, **kwargs):
    try:
        requests_op = getattr(requests, method)
        resp = requests_op(*args, **kwargs)
        resp.raise_for_status()
    except requests.exceptions.HTTPError as e:
        print("Problem sending request to endpoint")
        print(resp.text)
        raise e

    return resp


def sandbox():
    """
    Test OAuth2 stuff
    """
    headers = {
        "Content-Type": "application/json",
    }
    # Get OIDC configuration
    print("\n****** Get OIDC Configuration *************")
    openid_config_endpoint = (
        f"{domain}/.well-known/openid-configuration"
    )
    resp = request("get", openid_config_endpoint, headers=headers)
    openid_config = resp.json()
    pprint(openid_config)

    # Authorize to get access token
    print("\n****** Get Access Token *************")
    token_endpoint = openid_config["token_endpoint"]
    payload = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "audience": SMILECDR_AUDIENCE
    }
    resp = request("post", token_endpoint, data=payload)
    token_payload = resp.json()
    access_token = token_payload["access_token"]
    pprint(token_payload)

    if send_req:
        print("\n****** Send FHIR request *************")
        fhir_endpoint = f"{SMILECDR_FHIR_ENDPOINT}/Patient"
        access_token = token_payload["access_token"]
        headers.update(
            {
                "Authorization": f"Bearer {access_token}",
            }
        )
        resp = request("get", fhir_endpoint, headers=headers)
        pprint(resp.json())

    # print("\n****** Introspect Token *************")
    # intro_endpoint = openid_config["introspection_endpoint"]
    # payload = {
    #     "grant_type": "client_credentials",
    #     "client_id": DEV_CLIENT_ID,
    #     "client_secret": DEV_CLIENT_SECRET,
    #     "token": access_token,
    #     "token_type_hint": "access_token"
    #     # "audience": SMILECDR_AUDIENCE
    # }
    # resp = request("post", intro_endpoint, data=payload)
    # body = resp.json()
    # pprint(body)

   # pprint(resp.json())


def cli():
    """
    CLI for running this script
    """
    sandbox()

    print("✅ Test m2m complete")


if __name__ == "__main__":
    cli()
