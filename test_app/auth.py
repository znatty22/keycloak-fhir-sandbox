#!/usr/bin/env python

import os
import json
import argparse
from pprint import pprint
from pathlib import Path

import requests
from requests.auth import HTTPBasicAuth
import jwt
# from dotenv import find_dotenv, load_dotenv

# DOTENV_PATH = find_dotenv()
# if DOTENV_PATH:
#     load_dotenv(DOTENV_PATH)

KEYCLOAK_HOST = os.environ.get("KEYCLOAK_HOST") or "localhost"
KEYCLOAK_PORT = os.environ.get("KEYCLOAK_PORT") or "8080"
KEYCLOAK_DEV_DOMAIN = f"http://{KEYCLOAK_HOST}:{KEYCLOAK_PORT}/realms/fhir-dev"
KEYCLOAK_DEV_CLIENT_ID = "fhir-superuser-client"
KEYCLOAK_DEV_CLIENT_SECRET = "0Fpgo1YGkoszswRoNULq44JVBXBB0HBu"

SMILECDR_HOST = os.environ.get("SMILECDR_HOST") or "localhost"
SMILECDR_PORT = os.environ.get("SMILECDR_PORT") or "4000"
SMILECDR_FHIR_ENDPOINT = "http://{SMILECDR_HOST}:{SMILECDR_PORT}"
SMILECDR_AUDIENCE = "https://kf-api-fhir-smilecdr-dev.org"

domain = KEYCLOAK_DEV_DOMAIN
client_id = KEYCLOAK_DEV_CLIENT_ID
client_secret = KEYCLOAK_DEV_CLIENT_SECRET
send_req = False


def send_request(method, *args, **kwargs):
    print("\n***** Sending request ******")
    print(args)
    pprint(kwargs)
    try:
        requests_op = getattr(requests, method)
        resp = requests_op(*args, **kwargs)
        resp.raise_for_status()
    except requests.exceptions.HTTPError as e:
        print("Problem sending request to endpoint")
        print(resp.text)
        raise e

    return resp


def sandbox(client_id, client_secret):
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
    resp = send_request("get", openid_config_endpoint, headers=headers)
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
    params = {
        "scope": "fhir"
    }
    resp = send_request("post", token_endpoint, data=payload, params=params)
    token_payload = resp.json()
    access_token = token_payload["access_token"]
    pprint(token_payload)

    print("\n****** Introspect Token *************")
    decoded_token = jwt.decode(
        access_token, options={"verify_signature": False}
    )
    pprint(decoded_token)

    if send_req:
        print("\n****** Send FHIR request *************")
        fhir_endpoint = f"{SMILECDR_FHIR_ENDPOINT}/Patient"
        access_token = token_payload["access_token"]
        headers.update(
            {
                "Authorization": f"Bearer {access_token}",
            }
        )
        resp = send_request("get", fhir_endpoint, headers=headers)
        pprint(resp.json())

    return decoded_token


def cli():
    """
    CLI for running this script
    """
    parser = argparse.ArgumentParser(
        description='Get access token for client'
    )
    parser.add_argument(
        "--client_id",
        default=client_id,
        help="Keycloak Client ID",
    )
    parser.add_argument(
        "--client_secret",
        default=client_secret,
        help="Keycloak Client secret",
    )
    args = parser.parse_args()

    sandbox(args.client_id, args.client_secret)


if __name__ == "__main__":
    cli()