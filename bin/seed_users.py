#!/usr/bin/env python

import os
import json
import argparse
import time
from pprint import pprint

import requests
from requests.auth import HTTPBasicAuth

from config import (
    DATA_DIR,
    USER_MGMNT_ENDPOINT,
    SEED_USERS_FILEPATH,
)


def create_user(client_id, client_secret, endpoint, user):
    """
    Create Smile CDR user

    Return the response json if creation was successful
    Return None if creation failed due another user with the same
    username already existing
    Raise an exception if user creation fails for any other reason
    """
    headers = {
        "Content-Type": "application/json",
    }
    username = user['username']

    # Extract consent authorizations and store in user.notes as JSON encoded str
    consent = user.get("auth_config", {})
    if consent:
        user["notes"] = json.dumps(consent)
    try:
        resp = requests.post(
            endpoint,
            headers=headers,
            auth=HTTPBasicAuth(client_id, client_secret),
            json=user
        )
        resp.raise_for_status()
        result = resp.json()
        print(f"Created user {username}")
    except requests.exceptions.HTTPError as e:
        if "already exists" in resp.text and resp.status_code == 400:
            result = None
        else:
            print("Problem sending request to FHIR server")
            print(resp.text)
            raise e

    return result


def seed_users(client_id, client_secret, seed_users_filepath):
    """
    Create or update Smile CDR users
    """
    with open(seed_users_filepath, "r") as json_file:
        data = json.load(json_file)

    headers = {
        "Content-Type": "application/json",
    }
    created_users = []
    for user in data:
        node_id = user.pop("nodeId")
        module_id = user.pop("moduleId")
        username = user['username']

        # Try creating the user
        endpoint = f"{USER_MGMNT_ENDPOINT}/{node_id}/{module_id}"
        result = create_user(client_id, client_secret, endpoint, user)

        # Try updating the user bc it already exists
        if not result:
            pid = user.pop("pid", None)
            if not pid:
                raise ValueError(
                    f"Cannot update user {username} without a pid"
                )
            try:
                resp = requests.put(
                    f"{USER_MGMNT_ENDPOINT}/{node_id}/{module_id}/{pid}",
                    headers=headers,
                    auth=HTTPBasicAuth(client_id, client_secret),
                    json=user
                )
                resp.raise_for_status()
                result = resp.json()
                print(f"Updated user {username} with pid {pid}")
            except requests.exceptions.HTTPError as e:
                print("Problem sending request to FHIR server")
                print(resp.text)
                raise e

        user.update(result)
        created_users.append(user)

    with open(seed_users_filepath, "w") as json_file:
        json.dump(created_users, json_file, indent=2)


def cli():
    """
    CLI for running this script
    """
    parser = argparse.ArgumentParser(
        description='Seed user data in FHIR server'
    )
    parser.add_argument(
        "client_id",
        help="Admin ID to authenticate with FHIR server",
    )
    parser.add_argument(
        "client_secret",
        help="Admin secret to authenticate with FHIR server",
    )
    parser.add_argument(
        "seed_users_filepath",
        default=SEED_USERS_FILEPATH,
        help="Path to file with Smile CDR users",
    )
    args = parser.parse_args()

    seed_users(args.client_id, args.client_secret, args.seed_users_filepath)

    print("✅ Seed user data complete")


if __name__ == "__main__":
    cli()
